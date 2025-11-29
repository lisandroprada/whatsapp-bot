import { FunctionDeclaration, SchemaType } from '@google/generative-ai';
import { Injectable } from '@nestjs/common';
import { BrainTool } from './tool.interface';

@Injectable()
export class RequestAppraisalTool implements BrainTool {
  declaration: FunctionDeclaration = {
    name: 'request_appraisal',
    description: 'Solicita una tasación de una propiedad. Úsalo cuando el usuario quiera saber cuánto vale su casa o departamento para venderlo o alquilarlo.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        propertyType: {
          type: SchemaType.STRING,
          format: 'enum',
          description: 'Tipo de propiedad a tasar.',
          enum: ['apartment', 'house', 'duplex', 'local', 'office', 'land'],
        },
        address: {
          type: SchemaType.STRING,
          description: 'Dirección aproximada de la propiedad.',
        },
        contactName: {
          type: SchemaType.STRING,
          description: 'Nombre de contacto.',
        },
        contactPhone: {
          type: SchemaType.STRING,
          description: 'Teléfono de contacto.',
        },
      },
      required: ['propertyType', 'address', 'contactName'],
    },
  };

  async execute(args: { 
    propertyType: string; 
    address: string; 
    contactName: string; 
    contactPhone?: string 
  }) {
    // Aquí se conectaría con un endpoint real de tasaciones
    // Por ahora simulamos el registro exitoso
    
    return {
      success: true,
      message: `Hemos recibido tu solicitud de tasación para ${args.propertyType} en ${args.address}.

Un tasador profesional se pondrá en contacto contigo al ${args.contactPhone || 'número de este chat'} dentro de las próximas 24 horas hábiles para coordinar una visita.

Referencia: #TAS-${Date.now().toString().slice(-6)}`,
    };
  }
}
