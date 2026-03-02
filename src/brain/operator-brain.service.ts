import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  GoogleGenerativeAI,
} from '@google/generative-ai';
import { ConfigService } from '@nestjs/config';
import { Message } from '../whatsapp/schemas/message.schema';
import { OperatorData } from './identity-resolver.service';
import { getOperatorSystemPrompt } from './prompts/operator-system-prompt';
import { GetPendingTasksTool } from './tools/operator/get-pending-tasks.tool';
import { CreateWorkOrderTool } from './tools/operator/create-work-order.tool';
import { GetAgendaTool } from './tools/operator/get-agenda.tool';
import { CreateAgendaActionTool } from './tools/operator/create-agenda-action.tool';
import { EditAgendaActionTool } from './tools/operator/edit-agenda-action.tool';
import { MarkActionDoneTool } from './tools/operator/mark-action-done.tool';
import { SearchPropertiesTool } from './tools/search-properties.tool';
import { SearchContactsTool } from './tools/operator/search-contacts.tool';
import { SendWhatsAppToContactTool } from './tools/operator/send-whatsapp-to-contact.tool';

/**
 * OperatorBrainService — AI assistant for internal operators (employees).
 * Same Gemini 2.5 Flash model and function-calling loop as BrainService,
 * but with operator-specific tools and system prompt.
 */
@Injectable()
export class OperatorBrainService {
  private readonly logger = new Logger(OperatorBrainService.name);
  private readonly genAI: GoogleGenerativeAI;
  private readonly modelName = 'gemini-2.5-flash';
  private readonly maxTurns = 5;

  constructor(
    @InjectModel(Message.name) private readonly messageModel: Model<Message>,
    private readonly configService: ConfigService,
    private readonly getPendingTasksTool: GetPendingTasksTool,
    private readonly createWorkOrderTool: CreateWorkOrderTool,
    private readonly getAgendaTool: GetAgendaTool,
    private readonly createAgendaActionTool: CreateAgendaActionTool,
    private readonly editAgendaActionTool: EditAgendaActionTool,
    private readonly markActionDoneTool: MarkActionDoneTool,
    private readonly searchPropertiesTool: SearchPropertiesTool,
    private readonly searchContactsTool: SearchContactsTool,
    private readonly sendWhatsAppToContactTool: SendWhatsAppToContactTool,
  ) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');

    if (!apiKey) {
      this.logger.error('GEMINI_API_KEY not found. OperatorBrainService will not work.');
      throw new Error('GEMINI_API_KEY is not defined');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.logger.log('OperatorBrainService initialized with Gemini 2.5 Flash');
  }

  /**
   * Process a message from an internal operator.
   */
  async processMessage(
    jid: string,
    text: string,
    operator: OperatorData,
  ): Promise<string> {
    try {
      this.logger.log(
        `[OperatorBrain] Processing message from operator ${operator.name} (${operator.role})`,
      );

      const model = this.genAI.getGenerativeModel({
        model: this.modelName,
        tools: [
          {
            functionDeclarations: [
              this.getPendingTasksTool.declaration,
              this.createWorkOrderTool.declaration,
              this.getAgendaTool.declaration,
              this.createAgendaActionTool.declaration,
              this.editAgendaActionTool.declaration,
              this.markActionDoneTool.declaration,
              this.searchPropertiesTool.declaration,
              this.searchContactsTool.declaration,
              this.sendWhatsAppToContactTool.declaration,
            ],
          },
        ],
      });

      const history = await this.getChatHistory(jid);
      const systemPrompt = getOperatorSystemPrompt(operator);

      const chat = model.startChat({
        history: [
          {
            role: 'user',
            parts: [{ text: systemPrompt }],
          },
          {
            role: 'model',
            parts: [
              {
                text: `Entendido, ${operator.name}. Listo para ayudarte con las tareas del sistema.`,
              },
            ],
          },
          ...history.map((msg) => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }],
          })),
        ],
      });

      let result = await chat.sendMessage(text);
      let response = result.response;
      let functionCalls = response.functionCalls();

      let turns = 0;

      while (functionCalls && functionCalls.length > 0 && turns < this.maxTurns) {
        turns++;
        this.logger.log(`[OperatorBrain] Function call: ${JSON.stringify(functionCalls.map((fc) => fc.name))}`);

        const functionResponses: any[] = [];

        for (const call of functionCalls) {
          this.logger.log(`[OperatorBrain] Executing tool: ${call.name}`);
          let toolResult: any;

          switch (call.name) {
            case 'get_pending_tasks':
              toolResult = await this.getPendingTasksTool.execute(
                call.args as any,
                { agentId: operator.agentId },
              );
              break;

            case 'create_work_order':
              toolResult = await this.createWorkOrderTool.execute(
                call.args as any,
                { agentId: operator.agentId },
              );
              break;

            case 'get_agenda':
              toolResult = await this.getAgendaTool.execute(
                call.args as any,
                { companyId: operator.companyId, userId: operator.userId },
              );
              break;

            case 'create_agenda_action':
              toolResult = await this.createAgendaActionTool.execute(
                call.args as any,
                { companyId: operator.companyId, userId: operator.userId },
              );
              break;

            case 'edit_agenda_action':
              toolResult = await this.editAgendaActionTool.execute(
                call.args as any,
                { companyId: operator.companyId },
              );
              break;

            case 'mark_action_done':
              toolResult = await this.markActionDoneTool.execute(
                call.args as any,
                { companyId: operator.companyId },
              );
              break;

            case 'search_properties':
              toolResult = await this.searchPropertiesTool.execute(
                call.args as any,
                { coreClientId: undefined, jid },
              );
              break;

            case 'search_contacts':
              toolResult = await this.searchContactsTool.execute(
                call.args as any,
                { companyId: operator.companyId },
              );
              break;

            case 'send_whatsapp_to_contact':
              toolResult = await this.sendWhatsAppToContactTool.execute(
                call.args as any,
              );
              break;

            default:
              this.logger.warn(`[OperatorBrain] Unknown tool: ${call.name}`);
              toolResult = { error: `Tool ${call.name} not available for operators` };
          }

          functionResponses.push({
            functionResponse: {
              name: call.name,
              response: toolResult,
            },
          });
        }

        result = await chat.sendMessage(functionResponses);
        response = result.response;
        functionCalls = response.functionCalls();
      }

      if (turns >= this.maxTurns && functionCalls && functionCalls.length > 0) {
        this.logger.warn('[OperatorBrain] Max turns reached with pending function calls');
        return 'Llegué al límite de operaciones para esta solicitud. Intentá dividirla en pasos más simples.';
      }

      let responseText: string;
      try {
        responseText = response.text();
      } catch (textError) {
        this.logger.error('[OperatorBrain] response.text() failed', textError);
        return 'No pude generar una respuesta. Intentá reformular el pedido.';
      }

      this.logger.log('[OperatorBrain] Response generated');
      return responseText;
    } catch (error) {
      this.logger.error('[OperatorBrain] Error processing message:', error?.message ?? error);
      if (error?.message?.includes('429') || error?.message?.includes('quota')) {
        return '⏳ Alcanzamos el límite de consultas a la IA por hoy. Intentá en unos minutos o mañana.';
      }
      return 'Tuve un problema técnico procesando tu solicitud. Intentá de nuevo.';
    }
  }

  private async getChatHistory(
    jid: string,
    limit = 10,
  ): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    try {
      const messages = await this.messageModel
        .find({ jid })
        .sort({ timestamp: -1 })
        .limit(limit)
        .exec();

      messages.reverse();

      return messages.map((msg) => ({
        role: msg.fromMe ? 'assistant' : 'user',
        content: msg.content,
      }));
    } catch (error) {
      this.logger.error('[OperatorBrain] Error retrieving chat history:', error);
      return [];
    }
  }
}
