import { FunctionDeclaration, SchemaType } from '@google/generative-ai';
import { Injectable, Logger } from '@nestjs/common';
import { CoreBackendService } from '../../services/core-backend.service';

@Injectable()
export class EditAgendaActionTool {
  private readonly logger = new Logger(EditAgendaActionTool.name);

  constructor(private readonly coreBackendService: CoreBackendService) {}

  declaration: FunctionDeclaration = {
    name: 'edit_agenda_action',
    description:
      'Edita o reprograma un evento existente en la agenda. Puede cambiar la fecha, el título, el tipo o las notas. Usar este tool en lugar de create_agenda_action cuando el usuario quiere modificar o reprogramar algo que ya existe. Se necesita el ID del evento, que se obtiene consultando la agenda con get_agenda.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        actionId: {
          type: SchemaType.STRING,
          description: 'ID del evento a modificar (obtenido con get_agenda)',
        },
        dateText: {
          type: SchemaType.STRING,
          description:
            'Nueva fecha/hora en lenguaje natural o ISO. Ejemplos: "el sábado", "28/02", "2026-03-01T10:00:00". Omitir si solo se cambia título u otros campos.',
        },
        title: {
          type: SchemaType.STRING,
          description: 'Nuevo título del evento (opcional)',
        },
        type: {
          type: SchemaType.STRING,
          description: 'Nuevo tipo de evento (opcional)',
          format: 'enum',
          enum: ['RECORDATORIO', 'TAREA', 'LLAMADA', 'REUNION', 'VISITA', 'OTRO'],
        },
        notes: {
          type: SchemaType.STRING,
          description: 'Nuevas notas del evento (opcional)',
        },
      },
      required: ['actionId'],
    },
  };

  async execute(
    args: { actionId: string; dateText?: string; title?: string; type?: string; notes?: string },
    context: { companyId: string },
  ) {
    try {
      this.logger.log(
        `[EditAgendaActionTool] actionId=${args.actionId} dateText=${args.dateText ?? '-'} title=${args.title ?? '-'}`,
      );

      const result = await this.coreBackendService.updateOperatorAction(
        args.actionId,
        context.companyId,
        {
          dateText: args.dateText,
          title: args.title,
          type: args.type,
          notes: args.notes,
        },
      );

      return result;
    } catch (error) {
      this.logger.error('[EditAgendaActionTool] Error:', error.message);
      return { success: false, error: true, message: 'Error al editar el evento.' };
    }
  }
}
