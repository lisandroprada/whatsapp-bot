import { FunctionDeclaration, SchemaType } from '@google/generative-ai';
import { Injectable } from '@nestjs/common';
import { CoreBackendService } from '../services/core-backend.service';
import { BrainTool } from './tool.interface';

@Injectable()
export class AccountStatusTool implements BrainTool {
  constructor(private readonly coreBackendService: CoreBackendService) {}

  declaration: FunctionDeclaration = {
    name: 'check_account_status',
    description: 'Consulta el estado de cuenta, saldo pendiente y deuda del cliente actual. Úsalo cuando el usuario pregunte cuánto debe, su saldo o estado de cuenta.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {}, // No requiere parámetros, usa el contexto del usuario
    },
  };

  async execute(_args: any, context: { coreClientId?: string }) {
    if (!context.coreClientId) {
      return {
        error: 'Usuario no identificado. No se puede consultar el saldo de un usuario invitado.',
        requires_auth: true,
      };
    }

    try {
      const status = await this.coreBackendService.getAccountStatus(context.coreClientId);
      return status;
    } catch (error) {
      return {
        error: `Error al consultar saldo: ${error.message}`,
      };
    }
  }
}
