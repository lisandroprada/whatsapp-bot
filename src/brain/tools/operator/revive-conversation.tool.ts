import { FunctionDeclaration, SchemaType } from '@google/generative-ai';
import { Injectable, Logger } from '@nestjs/common';
import { CoreBackendService } from '../../services/core-backend.service';

@Injectable()
export class ReviveConversationTool {
  private readonly logger = new Logger(ReviveConversationTool.name);

  constructor(private readonly coreBackendService: CoreBackendService) {}

  declaration: FunctionDeclaration = {
    name: 'revive_conversation',
    description:
      'Analiza la conversación parada de un lead y propone el mensaje exacto para reactivarla. ' +
      'Usar cuando el operador quiere reflotar un lead dormido, revivir un contacto que no respondió, ' +
      'o necesita un mensaje de seguimiento inteligente. Requiere el número de teléfono del lead.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        phone: {
          type: SchemaType.STRING,
          description:
            'Número de teléfono del lead (formato internacional sin +, ej: 5492804123456). ' +
            'Si el operador da un nombre, buscarlo primero con search_contacts.',
        },
        companyId: {
          type: SchemaType.STRING,
          description: 'ID de la empresa. Se obtiene del contexto del operador — no preguntar al usuario.',
        },
      },
      required: ['phone', 'companyId'],
    },
  };

  async execute(
    args: { phone: string; companyId: string },
    context?: { companyId?: string },
  ) {
    try {
      const companyId = args.companyId || context?.companyId;
      if (!companyId) {
        return { success: false, error: 'No se pudo determinar el companyId para este análisis.' };
      }

      this.logger.log(`[ReviveConversation] Analizando lead ${args.phone} (company: ${companyId})`);

      const result = await this.coreBackendService.reviveLead(args.phone, companyId);

      return {
        success: true,
        analysis: {
          contactName: result.contextSummary?.contactName,
          daysSinceLastActivity: result.contextSummary?.daysSinceLastActivity,
          stage: result.contextSummary?.stage,
          messagesAnalyzed: result.contextSummary?.messagesAnalyzed,
          frictionAnalysis: result.frictionAnalysis,
          emotionalProfile: result.emotionalProfile,
          chosenAngle: result.chosenAngle,
          angleReason: result.angleReason,
        },
        proposedMessage: result.proposedMessage,
        instructions:
          'Mostrá el análisis y el mensaje propuesto al operador. ' +
          'Preguntá si quiere enviarlo tal cual, modificarlo, o descartarlo. ' +
          'Si confirma envío, usá send_whatsapp_to_contact con el número y el mensaje.',
      };
    } catch (error: any) {
      const msg: string = error?.response?.data?.message ?? error?.message ?? 'Error desconocido';
      if (msg.includes('No se encontró lead')) {
        return {
          success: false,
          error: `No encontré ningún lead con el teléfono ${args.phone} en el sistema. ¿El número es correcto?`,
        };
      }
      this.logger.error(`[ReviveConversation] Error: ${msg}`);
      return { success: false, error: `No pude analizar la conversación: ${msg}` };
    }
  }
}
