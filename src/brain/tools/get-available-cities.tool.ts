import { Injectable, Logger } from '@nestjs/common';
import { FunctionDeclaration, SchemaType } from '@google/generative-ai';
import { CoreBackendService } from '../services/core-backend.service';

@Injectable()
export class GetAvailableCitiesTool {
  private readonly logger = new Logger(GetAvailableCitiesTool.name);

  constructor(private readonly coreBackendService: CoreBackendService) {}

  declaration: FunctionDeclaration = {
    name: 'get_available_cities',
    description: 'Obtiene la lista de ciudades donde hay propiedades disponibles para alquiler o venta. Úsalo cuando el usuario pregunte "¿En qué ciudades tienen propiedades?" o "¿Dónde tienen disponibilidad?"',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
      required: [],
    },
  };

  async execute() {
    try {
      this.logger.log('[GetAvailableCitiesTool] Fetching available cities');
      
      const cities = await this.coreBackendService.getAvailableCities();

      if (!cities || cities.length === 0) {
        return {
          success: false,
          message: 'No hay propiedades disponibles en este momento.',
        };
      }

      // Formatear respuesta
      const citiesList = cities.map((city: any) => {
        const operations = [];
        if (city.rent > 0) operations.push(`${city.rent} en alquiler`);
        if (city.sale > 0) operations.push(`${city.sale} en venta`);
        
        return `• **${city.city}**: ${operations.join(' y ')}`;
      }).join('\n');

      return {
        success: true,
        cities,
        message: `Tenemos propiedades disponibles en las siguientes ciudades:\n\n${citiesList}`,
      };
    } catch (error) {
      this.logger.error('[GetAvailableCitiesTool] Error fetching cities', error);
      return {
        success: false,
        message: 'Hubo un error al consultar las ciudades disponibles. Por favor, intenta de nuevo más tarde.',
      };
    }
  }
}
