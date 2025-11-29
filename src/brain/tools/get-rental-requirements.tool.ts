import { FunctionDeclaration, SchemaType } from '@google/generative-ai';
import { Injectable } from '@nestjs/common';
import { BrainTool } from './tool.interface';

@Injectable()
export class GetRentalRequirementsTool implements BrainTool {
  declaration: FunctionDeclaration = {
    name: 'get_rental_requirements',
    description: 'Proporciona la lista de requisitos necesarios para alquilar una propiedad.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        type: {
          type: SchemaType.STRING,
          format: 'enum',
          description: 'Tipo de alquiler: housing (vivienda) o commercial (comercial).',
          enum: ['housing', 'commercial'],
        },
      },
      required: ['type'],
    },
  };

  async execute(args: { type: string }) {
    if (args.type === 'commercial') {
      return {
        requirements: [
          'Mes de alquiler por adelantado',
          'Mes de depósito en garantía',
          'Garantía propietaria o seguro de caución',
          'Comisión inmobiliaria (5% del total del contrato)',
          'Constancia de inscripción en AFIP',
          'Últimos 3 balances certificados (si es sociedad)',
        ],
        message: 'Para alquileres comerciales solicitamos garantía propietaria o seguro de caución, además de la documentación fiscal correspondiente.',
      };
    }

    return {
      requirements: [
        'Mes de alquiler por adelantado',
        'Mes de depósito en garantía',
        'Garantía propietaria o recibos de sueldo (sujeto a aprobación)',
        'Comisión inmobiliaria',
        'DNI del inquilino y garantes',
        'Demostración de ingresos (últimos 3 recibos de sueldo)',
      ],
      message: 'Para vivienda trabajamos con garantía propietaria o recibos de sueldo de terceros que tripliquen el valor del alquiler.',
    };
  }
}
