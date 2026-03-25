import { Injectable, Logger } from '@nestjs/common';
import { FunctionDeclaration, SchemaType } from '@google/generative-ai';
import { CoreBackendService } from '../services/core-backend.service';

@Injectable()
export class RequestShowingTool {
  private readonly logger = new Logger(RequestShowingTool.name);

  constructor(private readonly coreBackendService: CoreBackendService) {}

  declaration: FunctionDeclaration = {
    name: 'request_showing',
    description:
      'Inicia el proceso de solicitud de visita a una propiedad de ALQUILER. ' +
      'Crea un registro en el CRM y le indica al cliente qué documentación debe enviar. ' +
      'Úsalo cuando el cliente confirme que quiere visitar una propiedad para alquilar. ' +
      'NO uses schedule_meeting para alquileres — usá este en su lugar.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        propertyId: {
          type: SchemaType.STRING,
          description: 'ID de la propiedad (del resultado de search_properties).',
        },
        propertyAddress: {
          type: SchemaType.STRING,
          description: 'Dirección de la propiedad para mostrar al cliente.',
        },
        preferredDate: {
          type: SchemaType.STRING,
          description:
            'Fecha preferida en ISO 8601. Resolvé expresiones relativas con la fecha actual del sistema.',
        },
        clientName: {
          type: SchemaType.STRING,
          description: 'Nombre del cliente si está disponible en el contexto.',
        },
      },
      required: [],
    },
  };

  async execute(
    args: {
      propertyId?: string;
      propertyAddress?: string;
      preferredDate?: string;
      clientName?: string;
    },
    context: { coreClientId?: string; jid?: string },
  ): Promise<{ success: boolean; caseId?: string; message: string }> {
    try {
      this.logger.log(
        `[RequestShowingTool] jid=${context.jid} property=${args.propertyAddress || args.propertyId}`,
      );

      const result = await this.coreBackendService.requestShowing({
        propertyId: args.propertyId,
        propertyAddress: args.propertyAddress,
        preferredDate: args.preferredDate,
        clientName: args.clientName,
        clientJid: context.jid,
        clientCoreId: context.coreClientId,
      });

      return {
        success: true,
        caseId: result.caseId,
        message: 'Solicitud de visita registrada en el CRM.',
      };
    } catch (error) {
      this.logger.error('[RequestShowingTool] Error creating showing request', error);
      return {
        success: false,
        message: 'Error al registrar la solicitud. Igual comunicá los requisitos al cliente.',
      };
    }
  }
}
