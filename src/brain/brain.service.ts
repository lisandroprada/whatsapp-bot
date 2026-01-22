import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  GoogleGenerativeAI,
  GenerativeModel,
  FunctionCall,
} from '@google/generative-ai';
import { Message } from '../whatsapp/schemas/message.schema';
import { Chat } from '../whatsapp/schemas/chat.schema';
import { AiConfig } from './schemas/ai-config.schema';
import { getSystemPrompt, SYSTEM_PROMPT_BASE } from './prompts/system-prompt';
import { AccountStatusTool } from './tools/account-status.tool';
import { CreateComplaintTool } from './tools/create-complaint.tool';
import { VerifyIdentityTool } from './tools/verify-identity.tool';
import { VerifyOtpTool } from './tools/verify-otp.tool';
import { ConfigService } from '@nestjs/config';
import { SearchPropertiesTool } from './tools/search-properties.tool';
import { ScheduleMeetingTool } from './tools/schedule-meeting.tool';
import { GetRentalRequirementsTool } from './tools/get-rental-requirements.tool';
import { RequestAppraisalTool } from './tools/request-appraisal.tool';
import { GetAvailableCitiesTool } from './tools/get-available-cities.tool';

/**
 * BrainService - Orquestador de Google Gemini AI
 * Maneja procesamiento de mensajes, contexto conversacional y Function Calling
 */
@Injectable()
export class BrainService {
  private readonly logger = new Logger(BrainService.name);
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private readonly modelName = 'gemini-2.5-flash';
  private readonly tools: any; // Keep this for dynamic tool execution

  constructor(
    @InjectModel(Message.name) private readonly messageModel: Model<Message>,
    @InjectModel(Chat.name) private readonly chatModel: Model<Chat>,
    @InjectModel(AiConfig.name) private readonly aiConfigModel: Model<AiConfig>,
    private readonly configService: ConfigService,
    private readonly accountStatusTool: AccountStatusTool,
    private readonly createComplaintTool: CreateComplaintTool,
    private readonly verifyIdentityTool: VerifyIdentityTool,
    private readonly verifyOtpTool: VerifyOtpTool,
    private readonly searchPropertiesTool: SearchPropertiesTool,
    private readonly scheduleMeetingTool: ScheduleMeetingTool,
    private readonly getRentalRequirementsTool: GetRentalRequirementsTool,
    private readonly requestAppraisalTool: RequestAppraisalTool,
    private readonly getAvailableCitiesTool: GetAvailableCitiesTool,
  ) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');

    if (!apiKey) {
      this.logger.error(
        'GEMINI_API_KEY not found in environment variables. AI features will not work.',
      );
      throw new Error('GEMINI_API_KEY is not defined');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.logger.log('BrainService initialized with Gemini 2.5 Flash');

    this.model = this.genAI.getGenerativeModel({
      model: this.modelName,
      tools: [
        {
          functionDeclarations: [
            this.accountStatusTool.declaration,
            this.createComplaintTool.declaration,
            this.verifyIdentityTool.declaration,
            this.verifyOtpTool.declaration,
            this.searchPropertiesTool.declaration,
            this.scheduleMeetingTool.declaration,
            this.getRentalRequirementsTool.declaration,
            this.requestAppraisalTool.declaration,
          ],
        },
      ],
    });

    // Mapeo de herramientas para ejecución
    this.tools = {
      [this.accountStatusTool.declaration.name]: this.accountStatusTool,
      [this.createComplaintTool.declaration.name]: this.createComplaintTool,
      [this.verifyIdentityTool.declaration.name]: this.verifyIdentityTool,
      [this.verifyOtpTool.declaration.name]: this.verifyOtpTool,
      [this.searchPropertiesTool.declaration.name]: this.searchPropertiesTool,
      [this.scheduleMeetingTool.declaration.name]: this.scheduleMeetingTool,
      [this.getRentalRequirementsTool.declaration.name]: this.getRentalRequirementsTool,
      [this.requestAppraisalTool.declaration.name]: this.requestAppraisalTool,
    };
  }

  /**
   * Procesa un mensaje de texto usando Gemini AI con soporte para Function Calling
   */
  async processMessage(
    jid: string,
    text: string,
    isRegistered: boolean,
    clientName?: string,
    coreClientId?: string, // Nuevo parámetro para contexto de herramientas
  ): Promise<string> {
    try {
      this.logger.log(
        `[Brain] Processing message from ${clientName || jid} (${
          isRegistered ? 'REGISTERED' : 'GUEST'
        })`,
      );

      // 1. Configurar modelo con herramientas
      const model = this.genAI.getGenerativeModel({
        model: this.modelName,
        tools: [
          {
            functionDeclarations: [
              this.accountStatusTool.declaration,
              this.createComplaintTool.declaration,
              this.verifyIdentityTool.declaration,
              this.verifyOtpTool.declaration,
              this.searchPropertiesTool.declaration,
              this.scheduleMeetingTool.declaration,
              this.getRentalRequirementsTool.declaration,
              this.requestAppraisalTool.declaration,
              this.getAvailableCitiesTool.declaration,
            ],
          },
        ],
      });

      // 2. Construir historial y prompt
      const history = await this.getChatHistory(jid);
      
      // Obtener prompt base dinámico (desde DB o default)
      const basePrompt = await this.getStoredSystemPrompt();
      
      // Construir contexto de usuario
      let userContext = '';
      if (isRegistered && clientName) {
        userContext = `\n### CURRENT USER CONTEXT\nUsuario: **${clientName}**\nEstado: CLIENTE REGISTRADO ✅\nPermisos: Puede acceder a información de saldo, pagos, contratos y reclamos.\n`;
      } else if (isRegistered && !clientName) {
        userContext = `\n### CURRENT USER CONTEXT\nEstado: CLIENTE REGISTRADO ✅\nPermisos: Puede acceder a información administrativa.\n`;
      } else {
        userContext = `\n### CURRENT USER CONTEXT\nEstado: INVITADO (No Registrado) ⚠️\nRestricciones: NO puede acceder a datos sensibles. Debe validar identidad primero.\n`;
      }

      const systemPrompt = basePrompt + userContext;

      const chat = model.startChat({
        history: [
          {
            role: 'user',
            parts: [{ text: systemPrompt }],
          },
          {
            role: 'model',
            parts: [{ text: 'Entendido. Actuaré como el Asistente Virtual de Propietas siguiendo estas directivas.' }],
          },
          ...history.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }],
          })),
        ],
      });

      // 3. Enviar mensaje inicial
      let result = await chat.sendMessage(text);
      let response = result.response;
      let functionCalls = response.functionCalls();

      // 4. Loop de Function Calling (manejo de múltiples turnos)
      // Gemini puede decidir llamar a una función, nosotros la ejecutamos y le devolvemos el resultado.
      // Repetimos hasta que Gemini genere una respuesta de texto final.
      const maxTurns = 5;
      let turns = 0;

      while (functionCalls && functionCalls.length > 0 && turns < maxTurns) {
        turns++;
        this.logger.log(`[Brain] Function call detected: ${JSON.stringify(functionCalls)}`);

        const functionResponses = [];

        for (const call of functionCalls) {
          this.logger.log(`[Brain] Executing tool: ${call.name}`);
          let toolResult;
          switch (call.name) {
            case 'check_account_status':
              toolResult = await this.accountStatusTool.execute({}, { coreClientId });
              break;
            case 'create_complaint':
              toolResult = await this.createComplaintTool.execute(call.args as any, { coreClientId, jid });
              break;
            case 'verify_identity':
              toolResult = await this.verifyIdentityTool.execute(call.args as any, { jid });
              break;
            case 'verify_otp':
              toolResult = await this.verifyOtpTool.execute(call.args as any, { jid });
              break;
            case 'search_properties':
              toolResult = await this.searchPropertiesTool.execute(call.args as any, { coreClientId, jid });
              break;
            case 'schedule_meeting':
              toolResult = await this.scheduleMeetingTool.execute(call.args as any, { coreClientId, jid });
              break;
            case 'get_rental_requirements':
              toolResult = await this.getRentalRequirementsTool.execute(call.args as any);
              break;
            case 'request_appraisal':
              toolResult = await this.requestAppraisalTool.execute(call.args as any);
              break;
            case 'get_available_cities':
              toolResult = await this.getAvailableCitiesTool.execute();
              break;
            default:
              this.logger.error(`[Brain] Tool not found or not implemented: ${call.name}`);
              toolResult = { error: `Tool ${call.name} not found or not implemented` };
          }

          functionResponses.push({
            functionResponse: {
              name: call.name,
              response: toolResult,
            },
          });
        }

        // Enviar resultados de vuelta a Gemini
        result = await chat.sendMessage(functionResponses);
        response = result.response;
        functionCalls = response.functionCalls();
      }

      const responseText = response.text();
      this.logger.log('[Brain] Response generated successfully');
      return responseText;
    } catch (error) {
      this.logger.error('[Brain] Error processing message', error);
      return 'Disculpa, tuve un problema técnico procesando tu solicitud. ¿Podrías intentarlo de nuevo?';
    }
  }

  /**
   * Procesar imagen enviada por el usuario (Multimodalidad)
   * @param imagePath Ruta local de la imagen descargada
   * @param caption Caption del mensaje (opcional)
   * @param jid WhatsApp JID del usuario
   */
  async processImage(
    imagePath: string,
    caption: string,
    jid: string,
  ): Promise<string> {
    try {
      this.logger.log(`[Brain] Processing image from ${jid}`);

      // TODO: Implementar en Fase 5 (Multimodalidad)
      // Por ahora, respuesta básica
      return 'He recibido tu imagen. Funcionalidad de análisis de imágenes en desarrollo. 📷';
    } catch (error) {
      this.logger.error('[Brain] Error processing image:', error);
      return 'No pude analizar la imagen en este momento.';
    }
  }

  /**
   * Recuperar historial de chat de MongoDB
   * @param jid WhatsApp JID
   * @param limit Cantidad de mensajes a recuperar
   */
  private async getChatHistory(
    jid: string,
    limit: number = 10,
  ): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    try {
      const messages = await this.messageModel
        .find({ jid })
        .sort({ timestamp: -1 }) // Más recientes primero
        .limit(limit)
        .exec();

      // Invertir para orden cronológico
      messages.reverse();

      // Convertir a formato simple
      return messages.map((msg) => ({
        role: msg.fromMe ? 'assistant' : 'user',
        content: msg.content,
      }));
    } catch (error) {
      this.logger.error('Error retrieving chat history:', error);
      return [];
    }
  }

  /**
   * Obtener el System Prompt almacenado en DB o el default
   */
  async getStoredSystemPrompt(): Promise<string> {
    try {
      const config = await this.aiConfigModel.findOne({ key: 'system_prompt_rules' });
      return config ? config.value : SYSTEM_PROMPT_BASE;
    } catch (error) {
      this.logger.error('Error fetching stored system prompt:', error);
      return SYSTEM_PROMPT_BASE;
    }
  }

  /**
   * Actualizar el System Prompt en DB
   */
  async updateSystemPrompt(prompt: string, updatedBy: string = 'admin'): Promise<AiConfig> {
    return this.aiConfigModel.findOneAndUpdate(
      { key: 'system_prompt_rules' },
      { value: prompt, updatedBy },
      { upsert: true, new: true }
    );
  }

  /**
   * Revisar el prompt propuesto con IA
   */
  async reviewPrompt(prompt: string): Promise<string> {
    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      
      const reviewPrompt = `
      Actúa como un experto en Prompt Engineering y Seguridad de IA.
      Revisa el siguiente System Prompt propuesto para un bot inmobiliario.
      
      Analiza:
      1. Claridad de instrucciones.
      2. Tono adecuado (profesional pero cercano).
      3. Posibles conflictos o ambigüedades.
      4. Seguridad (que no incite a revelar datos sensibles sin validación).
      
      PROMPT PROPUESTO:
      """
      ${prompt}
      """
      
      Devuelve un breve reporte con:
      - Puntos Fuertes
      - Riesgos Detectados (si los hay)
      - Sugerencias de Mejora
      
      Si el prompt es seguro y bueno, confírmalo.
      `;

      const result = await model.generateContent(reviewPrompt);
      return result.response.text();
    } catch (error) {
      this.logger.error('Error reviewing prompt:', error);
      throw new Error('Failed to review prompt with AI');
    }
  }
}
