import { FunctionDeclaration, SchemaType } from '@google/generative-ai';
import { Injectable } from '@nestjs/common';
import { CoreBackendService } from '../services/core-backend.service';
import { BrainTool } from './tool.interface';

@Injectable()
export class CreateComplaintTool implements BrainTool {
  constructor(private readonly coreBackendService: CoreBackendService) {}

  declaration: FunctionDeclaration = {
    name: 'create_complaint',
    description: 'Crea un reclamo o ticket de soporte técnico para el cliente. Úsalo cuando el usuario reporte problemas de mantenimiento, desperfectos o quejas sobre la propiedad.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        description: {
          type: SchemaType.STRING,
          description: 'Descripción detallada del problema o reclamo que reporta el usuario.',
        },
        category: {
          type: SchemaType.STRING,
          format: 'enum',
          description: 'Categoría del problema: plumbing (plomería), electric (electricidad), heating (calefacción), cleaning (limpieza), security (seguridad), other (otro).',
          enum: ['plumbing', 'electric', 'heating', 'cleaning', 'security', 'other'],
        },
        urgency: {
          type: SchemaType.STRING,
          format: 'enum',
          description: 'Urgencia del reclamo: low (baja), medium (media), high (alta), urgent (urgente). Si no se especifica, asumir medium.',
          enum: ['low', 'medium', 'high', 'urgent'],
        },
      },
      required: ['description', 'category'],
    },
  };

  async execute(
    args: { description: string; category: string; urgency?: string },
    context: { coreClientId?: string; jid?: string },
  ) {
    if (!context.coreClientId) {
      return {
        error: true,
        message: 'Para crear un reclamo necesitas estar registrado. Por favor, verifica tu identidad primero proporcionando tu DNI/CUIT.',
        requires_auth: true,
      };
    }

    try {
      const result = await this.coreBackendService.createComplaint({
        clientId: context.coreClientId,
        category: (args.category as any) || 'other',
        description: args.description,
        urgency: (args.urgency as any) || 'medium',
        whatsappJid: context.jid,
      });

      if (result.success) {
        return {
          status: 'created',
          message: `✅ ${result.message}

Tu reclamo ha sido registrado con el número **#${result.ticketId.substring(result.ticketId.length - 6)}**.

Nuestro equipo lo revisará pronto y te contactaremos para coordinar la solución.

¿Hay algo más en lo que pueda ayudarte?`,
          ticketId: result.ticketId,
        };
      } else {
        return {
          error: true,
          message: 'No pudimos crear el reclamo. Por favor, intenta nuevamente.',
        };
      }
    } catch (error) {
      return {
        error: true,
        message: error.response?.data?.message || error.message || 'Error al crear el reclamo. Por favor, intenta nuevamente.',
      };
    }
  }
}
