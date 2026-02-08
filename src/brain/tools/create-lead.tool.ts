import { Injectable } from '@nestjs/common';
import { FunctionDeclaration, SchemaType } from '@google/generative-ai';
import { BrainTool } from './tool.interface';
import { CoreBackendService } from '../services/core-backend.service';

@Injectable()
export class CreateLeadTool implements BrainTool {
  constructor(private readonly coreBackend: CoreBackendService) {}

  readonly declaration: FunctionDeclaration = {
    name: 'create_crm_lead',
    description: 'Crea un nuevo lead (oportunidad) en el sistema CRM cuando el contacto muestra un interés claro en comprar, alquilar o vender una propiedad, o cuando solicita una tasación o visita.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        title: {
          type: SchemaType.STRING,
          description: 'Título descriptivo del lead (ej. "Interés en departamento 2 ambientes", "Solicitud de Tasación")',
        },
        description: {
          type: SchemaType.STRING,
          description: 'Detalles adicionales sobre lo que busca el cliente o el contexto de la conversación.',
        },
        expectedValue: {
          type: SchemaType.NUMBER,
          description: 'Valor estimado de la operación si el cliente lo mencionó.',
        },
        priority: {
          type: SchemaType.STRING,
          description: 'Prioridad asignada al lead según la urgencia detectada.',
          format: 'enum',
          enum: ['BAJA', 'MEDIA', 'ALTA', 'URGENTE'],
        },
      },
      required: ['title'],
    },
  };

  async execute(args: any, context?: any): Promise<any> {
    const { title, description, expectedValue, priority } = args;
    const { coreClientId } = context || {};

    try {
      const result = await this.coreBackend.createLead({
        title,
        description,
        expectedValue,
        priority: priority || 'MEDIA',
        agentId: coreClientId,
        source: 'WHATSAPP_SMART_RESPONSE',
      });

      return result;
    } catch (error) {
      return { 
        success: false, 
        error: 'No se pudo crear el lead en el CRM. Intenta de nuevo más tarde.' 
      };
    }
  }
}
