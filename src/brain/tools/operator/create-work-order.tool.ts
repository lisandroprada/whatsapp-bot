import { FunctionDeclaration, SchemaType } from '@google/generative-ai';
import { Injectable, Logger } from '@nestjs/common';
import { CoreBackendService } from '../../services/core-backend.service';

@Injectable()
export class CreateWorkOrderTool {
  private readonly logger = new Logger(CreateWorkOrderTool.name);

  constructor(private readonly coreBackendService: CoreBackendService) {}

  declaration: FunctionDeclaration = {
    name: 'create_work_order',
    description:
      'Crea una nueva orden de trabajo (OT) en el sistema. Usar cuando el operador quiere registrar una tarea de mantenimiento o reparación.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        description: {
          type: SchemaType.STRING,
          description: 'Descripción detallada del trabajo a realizar',
        },
        urgency: {
          type: SchemaType.STRING,
          description: 'Nivel de prioridad: BAJA, NORMAL, ALTA, URGENTE',
          format: 'enum',
          enum: ['BAJA', 'NORMAL', 'ALTA', 'URGENTE'],
        },
        propertyReference: {
          type: SchemaType.STRING,
          description: 'Referencia de la propiedad (dirección, código, etc.) — opcional',
        },
      },
      required: ['description'],
    },
  };

  async execute(
    args: { description: string; urgency?: string; propertyReference?: string },
    context: { agentId: string },
  ) {
    try {
      this.logger.log(
        `[CreateWorkOrderTool] agentId=${context.agentId} description="${args.description}"`,
      );

      const result = await this.coreBackendService.createOperatorWorkOrder({
        agentId: context.agentId,
        description: args.description,
        urgency: args.urgency,
        propertyReference: args.propertyReference,
      });

      return {
        success: true,
        workOrderId: result.workOrderId,
        status: result.status,
        message: `✅ Orden de trabajo creada exitosamente.\nID: ${result.workOrderId}\nEstado: ${result.status}`,
      };
    } catch (error) {
      this.logger.error('[CreateWorkOrderTool] Error:', error.message);
      return { success: false, error: true, message: 'Error al crear la orden de trabajo.' };
    }
  }
}
