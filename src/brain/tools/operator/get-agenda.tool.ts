import { FunctionDeclaration, SchemaType } from '@google/generative-ai';
import { Injectable, Logger } from '@nestjs/common';
import { CoreBackendService } from '../../services/core-backend.service';

@Injectable()
export class GetAgendaTool {
  private readonly logger = new Logger(GetAgendaTool.name);

  constructor(private readonly coreBackendService: CoreBackendService) {}

  declaration: FunctionDeclaration = {
    name: 'get_agenda',
    description:
      'Consulta la agenda del día para el operador. Muestra todos los eventos: contratos, órdenes de trabajo, ajustes, vencimientos de expensas, inspecciones y recordatorios manuales. Si no se especifica fecha, muestra la agenda de hoy.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        date: {
          type: SchemaType.STRING,
          description:
            'Fecha en formato ISO (YYYY-MM-DD). Por defecto es hoy. Ejemplos: "2026-02-26", "2026-03-01"',
        },
      },
      required: [],
    },
  };

  async execute(
    args: { date?: string },
    context: { companyId: string; userId: string },
  ) {
    try {
      this.logger.log(
        `[GetAgendaTool] companyId=${context.companyId} userId=${context.userId} date=${args.date || 'hoy'}`,
      );

      const result = await this.coreBackendService.getOperatorAgenda(
        context.companyId,
        args.date,
        context.userId,
      );

      return {
        success: true,
        text: result.text,
        eventCount: result.events?.length ?? 0,
      };
    } catch (error) {
      this.logger.error('[GetAgendaTool] Error:', error.message);
      return { success: false, error: true, message: 'Error al consultar la agenda.' };
    }
  }
}
