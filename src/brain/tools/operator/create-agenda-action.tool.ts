import { FunctionDeclaration, SchemaType } from '@google/generative-ai';
import { Injectable, Logger } from '@nestjs/common';
import { CoreBackendService } from '../../services/core-backend.service';

@Injectable()
export class CreateAgendaActionTool {
  private readonly logger = new Logger(CreateAgendaActionTool.name);

  constructor(private readonly coreBackendService: CoreBackendService) {}

  declaration: FunctionDeclaration = {
    name: 'create_agenda_action',
    description:
      'Agrega un evento, recordatorio o tarea a la agenda del operador. Acepta fechas en lenguaje natural (ej: "mañana", "el viernes", "en 3 días", "15/03") y opcionalmente una hora ("a las 10", "a las 14:30").',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        title: {
          type: SchemaType.STRING,
          description: 'Título o descripción breve del evento. Ej: "Llamar a García por renovación"',
        },
        dateText: {
          type: SchemaType.STRING,
          description:
            'Fecha y hora en lenguaje natural o ISO. Ejemplos: "mañana a las 10", "el viernes", "2026-03-15T10:00:00", "en 3 días a las 14:30"',
        },
        type: {
          type: SchemaType.STRING,
          description: 'Tipo de evento (opcional). Por defecto: RECORDATORIO',
          format: 'enum',
          enum: ['RECORDATORIO', 'TAREA', 'LLAMADA', 'REUNION', 'VISITA', 'OTRO'],
        },
        notes: {
          type: SchemaType.STRING,
          description: 'Notas adicionales o contexto del evento (opcional)',
        },
      },
      required: ['title', 'dateText'],
    },
  };

  async execute(
    args: { title: string; dateText: string; type?: string; notes?: string },
    context: { companyId: string; userId: string },
  ) {
    try {
      this.logger.log(
        `[CreateAgendaActionTool] "${args.title}" para ${args.dateText}`,
      );

      const result = await this.coreBackendService.createOperatorAction({
        companyId: context.companyId,
        userId: context.userId,
        title: args.title,
        dateText: args.dateText,
        type: args.type,
        notes: args.notes,
      });

      return result;
    } catch (error) {
      this.logger.error('[CreateAgendaActionTool] Error:', error.message);
      return { success: false, error: true, message: 'Error al crear el evento en la agenda.' };
    }
  }
}
