import { FunctionDeclaration, SchemaType } from '@google/generative-ai';
import { Injectable, Logger } from '@nestjs/common';
import { CoreBackendService } from '../../services/core-backend.service';

@Injectable()
export class GetPendingTasksTool {
  private readonly logger = new Logger(GetPendingTasksTool.name);

  constructor(private readonly coreBackendService: CoreBackendService) {}

  declaration: FunctionDeclaration = {
    name: 'get_pending_tasks',
    description:
      'Lista las órdenes de trabajo del sistema. Puede filtrar por estado (PRESUPUESTO, VISADO, APROBADO, etc.) y limitar resultados.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        status: {
          type: SchemaType.STRING,
          description:
            'Estado de las órdenes a filtrar (opcional). Valores: PRESUPUESTO, VISADO, APROBADO, COMPLETADO, CANCELADO',
          format: 'enum',
          enum: ['PRESUPUESTO', 'VISADO', 'APROBADO', 'COMPLETADO', 'CANCELADO'],
        },
        limit: {
          type: SchemaType.NUMBER,
          description: 'Cantidad máxima de resultados a devolver (por defecto 10)',
        },
      },
      required: [],
    },
  };

  async execute(
    args: { status?: string; limit?: number },
    context: { agentId: string },
  ) {
    try {
      this.logger.log(
        `[GetPendingTasksTool] agentId=${context.agentId} status=${args.status || 'all'}`,
      );

      const workOrders = await this.coreBackendService.getOperatorWorkOrders(
        context.agentId,
        args.status,
      );

      const limited = args.limit ? workOrders.slice(0, args.limit) : workOrders.slice(0, 10);

      if (!limited || limited.length === 0) {
        return {
          success: true,
          count: 0,
          message: args.status
            ? `No hay órdenes de trabajo con estado ${args.status}.`
            : 'No hay órdenes de trabajo registradas.',
        };
      }

      const list = limited
        .map(
          (wo: any, i: number) =>
            `${i + 1}. [${wo.id.slice(-6)}] ${wo.description || '(sin descripción)'}\n   Estado: ${wo.status} | Prioridad: ${wo.priority || 'NORMAL'}\n   Propiedad: ${wo.property || 'N/A'} | Pagador: ${wo.payer}`,
        )
        .join('\n\n');

      return {
        success: true,
        count: limited.length,
        workOrders: limited,
        message: `${limited.length} orden${limited.length !== 1 ? 'es' : ''} de trabajo:\n\n${list}`,
      };
    } catch (error) {
      this.logger.error('[GetPendingTasksTool] Error:', error.message);
      return { success: false, error: true, message: 'Error al consultar órdenes de trabajo.' };
    }
  }
}
