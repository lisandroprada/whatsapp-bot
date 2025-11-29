import { FunctionDeclaration, SchemaType } from '@google/generative-ai';
import { Injectable } from '@nestjs/common';
import { CoreBackendService } from '../services/core-backend.service';
import { BrainTool } from './tool.interface';

@Injectable()
export class VerifyIdentityTool implements BrainTool {
  constructor(private readonly coreBackendService: CoreBackendService) {}

  declaration: FunctionDeclaration = {
    name: 'verify_identity',
    description: 'Inicia el proceso de verificación de identidad. Úsalo SOLO cuando el usuario proporcione su DNI o CUIT (7 a 11 dígitos). NO LO USES si el usuario envía un código de 6 dígitos (eso es un OTP).',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        dni: {
          type: SchemaType.STRING,
          description: 'Número de DNI o CUIT del usuario sin puntos ni guiones. Debe tener entre 7 y 11 dígitos.',
        },
      },
      required: ['dni'],
    },
  };

  /**
   * Normaliza y limpia el DNI removiendo caracteres no numéricos
   * y detectando duplicaciones
   */
  private normalizeDni(dni: string): string {
    // Remover todo lo que no sea dígito
    const cleaned = dni.replace(/\D/g, '');
    
    // Detectar si el DNI está duplicado (ej: "59820155982015" -> "5982015")
    // Si la longitud es par y la primera mitad es igual a la segunda mitad
    if (cleaned.length % 2 === 0) {
      const half = cleaned.length / 2;
      const firstHalf = cleaned.substring(0, half);
      const secondHalf = cleaned.substring(half);
      
      if (firstHalf === secondHalf) {
        return firstHalf; // Retornar solo una mitad
      }
    }
    
    return cleaned;
  }

  async execute(args: { dni: string }, context: { jid: string }) {
    try {
      // Normalizar DNI antes de enviar
      const normalizedDni = this.normalizeDni(args.dni);
      
      const result = await this.coreBackendService.validateIdentity(normalizedDni, context.jid);
      
      if (result.success) {
        // El Core Backend ahora envía el OTP por email
        return {
          status: 'otp_generated',
          message: `Hemos encontrado tu cuenta a nombre de **${result.clientName}**. 

Para verificar tu identidad, hemos enviado un código de seguridad a tu email registrado (**${result.maskedEmail}**).

📧 Por favor, revisa tu bandeja de entrada (y spam) y respóndeme con el código de 6 dígitos que recibiste.`,
          action: 'wait_otp_verification',
          clientId: result.clientId,
        };
      } else {
        return {
          status: 'not_found',
          message: 'No encontramos ningún cliente activo con ese DNI/CUIT. ¿Estás seguro que el número es correcto?',
        };
      }
    } catch (error) {
      return {
        error: true,
        message: error.response?.data?.message || error.message || 'Error al validar identidad',
      };
    }
  }
}
