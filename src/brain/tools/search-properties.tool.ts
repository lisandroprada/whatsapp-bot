import { FunctionDeclaration, SchemaType } from '@google/generative-ai';
import { Injectable, Logger } from '@nestjs/common';
import { CoreBackendService } from '../services/core-backend.service';

@Injectable()
export class SearchPropertiesTool {
  private readonly logger = new Logger(SearchPropertiesTool.name);

  constructor(private readonly coreBackendService: CoreBackendService) {}

  declaration: FunctionDeclaration = {
    name: 'search_properties',
    description: 'Busca y MUESTRA propiedades inmobiliarias disponibles. Úsalo SIEMPRE que el usuario pregunte por alquileres o ventas, ANTES de pedir datos de contacto o agendar reuniones. Debes mostrar las opciones primero.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        operation: {
          type: SchemaType.STRING,
          description: 'Tipo de operación: "rent" para alquiler o "sale" para venta',
          format: 'enum',
          enum: ['rent', 'sale'],
        },
        type: {
          type: SchemaType.STRING,
          description: 'Tipo de propiedad (opcional)',
          format: 'enum',
          enum: ['apartment', 'house', 'duplex', 'local', 'office'],
        },
        city: {
          type: SchemaType.STRING,
          description: 'Ciudad o localidad donde buscar (búsqueda parcial, ej: "playa" para "Playa Unión", "raw" para "Rawson")',
        },
        rooms: {
          type: SchemaType.NUMBER,
          description: 'Cantidad mínima de ambientes/habitaciones',
        },
        maxPrice: {
          type: SchemaType.NUMBER,
          description: 'Precio máximo en pesos argentinos',
        },
      },
      required: ['operation'],
    },
  };

  async execute(
    args: {
      operation: 'rent' | 'sale';
      type?: string;
      city?: string;
      rooms?: number;
      maxPrice?: number;
    },
    context?: { coreClientId?: string; jid?: string },
  ) {
    try {
      this.logger.log(`[SearchPropertiesTool] Searching properties: ${JSON.stringify(args)}`);

      const results = await this.coreBackendService.searchProperties({
        operation: args.operation as 'rent' | 'sale',
        type: args.type as any,
        city: args.city,
        rooms: args.rooms,
        maxPrice: args.maxPrice,
      });

      if (!results || results.length === 0) {
        const cityMsg = args.city ? ` en ${args.city}` : '';
        return {
          success: false,
          message: `No encontramos propiedades disponibles para ${args.operation === 'rent' ? 'alquiler' : 'venta'}${cityMsg} con los filtros especificados.`,
        };
      }

      // Formatear resultados
      const propertiesList = results.slice(0, 5).map((prop: any, index: number) => {
        return `${index + 1}. **${prop.title}**
   📍 ${prop.address} - ${prop.zone}
   🏠 ${prop.type} ${prop.rooms > 0 ? `- ${prop.rooms} amb.` : ''}
   💰 $${prop.price.toLocaleString('es-AR')} ${prop.currency}
   📏 ${prop.surface}m²`;
      }).join('\n\n');

      const moreResults = results.length > 5 ? `\n\n_Mostrando 5 de ${results.length} resultados._` : '';

      return {
        success: true,
        count: results.length,
        properties: results,
        message: `Encontré ${results.length} ${results.length === 1 ? 'propiedad' : 'propiedades'} disponible${results.length === 1 ? '' : 's'}:\n\n${propertiesList}${moreResults}`,
      };
    } catch (error) {
      return {
        error: true,
        message: 'Hubo un error al buscar propiedades. Por favor intenta más tarde.',
      };
    }
  }
}
