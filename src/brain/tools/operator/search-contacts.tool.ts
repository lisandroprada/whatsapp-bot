import { FunctionDeclaration, SchemaType } from '@google/generative-ai';
import { Injectable, Logger } from '@nestjs/common';
import { CoreBackendService } from '../../services/core-backend.service';

@Injectable()
export class SearchContactsTool {
  private readonly logger = new Logger(SearchContactsTool.name);

  constructor(private readonly coreBackendService: CoreBackendService) {}

  declaration: FunctionDeclaration = {
    name: 'search_contacts',
    description:
      'Busca contactos (clientes, propietarios, inquilinos) en el sistema por nombre parcial. ' +
      'Usá esta herramienta cuando el operador menciona el nombre de una persona y querés verificar si está en la base de datos, ' +
      'obtener su teléfono para notificarla, o confirmar de quién se trata antes de crear un evento.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        name: {
          type: SchemaType.STRING,
          description:
            'Nombre o apellido parcial a buscar. Ejemplos: "Celina", "García", "Emiliano López"',
        },
      },
      required: ['name'],
    },
  };

  async execute(
    args: { name: string },
    context: { companyId: string },
  ): Promise<{
    found: boolean;
    contacts: Array<{
      id: string;
      name: string;
      primaryPhone: string | null;
      phones: string[];
      email: string | null;
    }>;
    message: string;
  }> {
    try {
      this.logger.log(
        `[SearchContactsTool] Searching: "${args.name}" companyId=${context.companyId}`,
      );

      const result = await this.coreBackendService.searchContacts(
        args.name,
        context.companyId,
      );

      const contacts = result.contacts ?? [];

      if (contacts.length === 0) {
        return {
          found: false,
          contacts: [],
          message: `No se encontraron contactos con el nombre "${args.name}" en el sistema.`,
        };
      }

      const names = contacts.map((c: any) => c.name).join(', ');
      return {
        found: true,
        contacts,
        message: `Encontré ${contacts.length} contacto(s): ${names}.`,
      };
    } catch (error) {
      this.logger.error('[SearchContactsTool] Error:', error.message);
      return {
        found: false,
        contacts: [],
        message: 'Error al buscar contactos.',
      };
    }
  }
}
