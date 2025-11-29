import { FunctionDeclaration, SchemaType } from '@google/generative-ai';
import { Injectable } from '@nestjs/common';
import { CoreBackendService } from '../services/core-backend.service';
import { BrainTool } from './tool.interface';

@Injectable()
export class VerifyOtpTool implements BrainTool {
  constructor(private readonly coreBackendService: CoreBackendService) {}

  declaration: FunctionDeclaration = {
    name: 'verify_otp',
    description: 'Verifica el código de seguridad OTP. Úsalo SIEMPRE que el usuario envíe un número de 6 dígitos, especialmente después de haber solicitado validación de identidad.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        otp: {
          type: SchemaType.STRING,
          description: 'Código OTP de 6 dígitos que el usuario proporcionó.',
        },
      },
      required: ['otp'],
    },
  };

  async execute(args: { otp: string }, context: { jid: string }) {
    console.log({args, context});
    try {
      // Limpiar el OTP (solo dígitos)
      const cleanedOtp = args.otp.replace(/\D/g, '');

      if (cleanedOtp.length !== 6) {
        return {
          error: true,
          message: 'El código debe tener exactamente 6 dígitos. Por favor, verifica e intenta nuevamente.',
        };
      }
      console.log({cleanedOtp});

      const result = await this.coreBackendService.verifyOTP('', cleanedOtp, context.jid);

      if (result.success) {
        return {
          status: 'verified',
          message: `¡Perfecto, ${result.clientName}! ✅

Tu identidad ha sido verificada exitosamente. Ahora puedes consultar tu saldo, crear reclamos y acceder a toda la información de tu cuenta.

¿En qué puedo ayudarte hoy?`,
          clientId: result.clientId,
          clientName: result.clientName,
        };
      } else {
        return {
          error: true,
          message: result.message || 'Código incorrecto. Por favor, verifica e intenta nuevamente.',
        };
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message;
      
      return {
        error: true,
        message: errorMessage || 'Error al verificar el código. Por favor, intenta nuevamente.',
      };
    }
  }
}
