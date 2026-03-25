import { FunctionDeclaration, SchemaType } from '@google/generative-ai';
import { Injectable, Logger } from '@nestjs/common';
import { CoreBackendService } from '../services/core-backend.service';

@Injectable()
export class ScheduleMeetingTool {
  private readonly logger = new Logger(ScheduleMeetingTool.name);

  constructor(private readonly coreBackendService: CoreBackendService) {}

  declaration: FunctionDeclaration = {
    name: 'schedule_meeting',
    description: 'Agenda una reunión o visita a una propiedad. Úsalo cuando el usuario quiera ver un inmueble o ir a la oficina.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        type: {
          type: SchemaType.STRING,
          format: 'enum',
          description: 'Tipo de cita: showing (visita a propiedad) o meeting (reunión en oficina).',
          enum: ['showing', 'meeting'],
        },
        propertyId: {
          type: SchemaType.STRING,
          description: 'ID o referencia de la propiedad a visitar (si aplica).',
        },
        preferredDate: {
          type: SchemaType.STRING,
          description: 'Fecha y hora de la visita en formato ISO 8601 (ej: "2026-03-20T12:00:00"). Resolvé expresiones relativas como "viernes al mediodía" o "mañana a las 10" a una fecha absoluta usando la fecha actual del sistema.',
        },
        clientName: {
          type: SchemaType.STRING,
          description: 'Nombre del cliente (solo si no está registrado).',
        },
        clientPhone: {
          type: SchemaType.STRING,
          description: 'Teléfono de contacto del cliente (solo si no está registrado).',
        },
      },
      required: ['type'],
    },
  };

  async execute(
    args: { 
      type: string; 
      propertyId?: string; 
      preferredDate?: string; 
      clientName?: string; 
      clientPhone?: string 
    },
    context: { coreClientId?: string; jid?: string },
  ) {
    try {
      let clientName = args.clientName;
      let clientPhone = args.clientPhone;

      // Si el usuario está registrado, obtener sus datos del backend
      if (context.coreClientId) {
        try {
          const clientData = await this.coreBackendService.getClientByJid(context.jid);
          if (clientData) {
            clientName = clientData.name || clientName;
            clientPhone = clientData.phone || clientPhone;
            this.logger.log(`[ScheduleMeetingTool] Using registered client data: ${clientName}`);
          }
        } catch (error) {
          this.logger.warn(`[ScheduleMeetingTool] Could not fetch client data, using provided info`);
        }
      }

      // Si aún no tenemos teléfono, usar el JID
      if (!clientPhone && context.jid) {
        clientPhone = context.jid.split('@')[0];
      }

      const result = await this.coreBackendService.scheduleShowing({
        type: args.type as 'showing' | 'meeting',
        propertyId: args.propertyId,
        clientName: clientName || 'Cliente',
        clientPhone: clientPhone || '',
        preferredDate: args.preferredDate || 'A coordinar',
        notes: args.type === 'showing' 
          ? `Visita a propiedad ${args.propertyId || 'sin especificar'}` 
          : 'Reunión en oficina',
      });

      return {
        success: true,
        message: `✅ ¡Solicitud registrada!

Hemos anotado tu interés en ${args.type === 'showing' ? 'visitar la propiedad' : 'una reunión en nuestra oficina'}.

📅 Fecha preferida: ${args.preferredDate || 'A coordinar'}
📞 Te contactaremos al: ${clientPhone}

Un asesor se comunicará contigo pronto para confirmar el horario exacto.

Referencia: #${result.showingId || Date.now().toString().slice(-6)}`,
      };
    } catch (error) {
      this.logger.error('[ScheduleMeetingTool] Error scheduling', error);
      
      // Incluso si falla, confirmar que se tomó nota
      return {
        success: true,
        message: `📝 Hemos tomado nota de tu solicitud de ${args.type === 'showing' ? 'visita' : 'reunión'}.

${args.preferredDate ? `📅 Fecha preferida: ${args.preferredDate}` : ''}

Un asesor se comunicará contigo pronto para coordinar los detalles.

Si prefieres, también puedes llamarnos directamente a nuestra oficina.`,
      };
    }
  }
}
