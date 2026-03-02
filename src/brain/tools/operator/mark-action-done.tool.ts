import { FunctionDeclaration, SchemaType } from '@google/generative-ai';
import { Injectable, Logger } from '@nestjs/common';
import { CoreBackendService } from '../../services/core-backend.service';

@Injectable()
export class MarkActionDoneTool {
  private readonly logger = new Logger(MarkActionDoneTool.name);

  constructor(private readonly coreBackendService: CoreBackendService) {}

  declaration: FunctionDeclaration = {
    name: 'mark_action_done',
    description:
      'Marca una tarea o recordatorio de la agenda como realizado. Se necesita el ID del evento, que se obtiene consultando la agenda con get_agenda.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        actionId: {
          type: SchemaType.STRING,
          description: 'ID del evento/recordatorio a marcar como realizado',
        },
      },
      required: ['actionId'],
    },
  };

  async execute(
    args: { actionId: string },
    context: { companyId: string },
  ) {
    try {
      this.logger.log(`[MarkActionDoneTool] actionId=${args.actionId}`);

      const result = await this.coreBackendService.markOperatorActionDone(
        args.actionId,
        context.companyId,
      );

      return result;
    } catch (error) {
      this.logger.error('[MarkActionDoneTool] Error:', error.message);
      return { success: false, error: true, message: 'Error al actualizar el evento.' };
    }
  }
}
