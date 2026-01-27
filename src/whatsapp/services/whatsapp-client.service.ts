import { Injectable, Logger } from '@nestjs/common';
import { CoreBackendService } from '../../brain/services/core-backend.service';
import {
  PhoneValidatorUtil,
  PhoneValidationResult,
} from '../../utils/phone-validator.util';

export interface WhatsAppManagementResult {
  success: boolean;
  message?: string;
  data?: any;
  validation?: PhoneValidationResult;
  errors?: string[];
  suggestions?: {
    example: string;
    placeholder: string;
    inputMask: string;
  };
}

/**
 * Servicio para gestión completa de números de WhatsApp
 * Integra validación, formateo y comunicación con Core Backend
 */
@Injectable()
export class WhatsAppClientService {
  private readonly logger = new Logger(WhatsAppClientService.name);

  constructor(private readonly coreBackendService: CoreBackendService) {}

  /**
   * Actualizar número de WhatsApp de un cliente con validación completa
   */
  async updateClientWhatsApp(
    clientId: string,
    phone: string,
    options: {
      verified?: boolean;
      skipValidation?: boolean;
    } = {},
  ): Promise<WhatsAppManagementResult> {
    try {
      this.logger.log(`Updating WhatsApp for client ${clientId}: ${phone}`);

      // Validar número si no se omite validación
      if (!options.skipValidation) {
        const validation = PhoneValidatorUtil.validateArgentinePhone(phone);

        if (!validation.isValid) {
          return {
            success: false,
            message: 'Número de teléfono inválido',
            validation,
            errors: validation.errors,
            suggestions: this.getValidationSuggestions(),
          };
        }

        // Usar número formateado
        phone = validation.formattedPhone!;
      }

      // Actualizar en Core Backend
      const result = await this.coreBackendService.updateClientWhatsApp(
        clientId,
        {
          phone,
          whatsappJid: PhoneValidatorUtil.phoneToJid(phone),
          autoDetected:
            PhoneValidatorUtil.validateArgentinePhone(phone).isMobile,
          verified: options.verified || false,
        },
      );

      return {
        success: true,
        message: 'Número de WhatsApp actualizado correctamente',
        data: {
          ...result,
          displayFormat: PhoneValidatorUtil.formatForDisplay(phone),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to update WhatsApp for client ${clientId}`,
        error,
      );
      return {
        success: false,
        message: 'Error interno al actualizar número de WhatsApp',
        errors: [error.message],
      };
    }
  }

  /**
   * Obtener información de WhatsApp de un cliente
   */
  async getClientWhatsApp(clientId: string): Promise<WhatsAppManagementResult> {
    try {
      const result = await this.coreBackendService.getClientWhatsApp(clientId);

      if (!result) {
        return {
          success: false,
          message: 'Cliente no tiene número de WhatsApp configurado',
          suggestions: this.getValidationSuggestions(),
        };
      }

      return {
        success: true,
        data: {
          ...result,
          displayFormat: result.phone
            ? PhoneValidatorUtil.formatForDisplay(result.phone)
            : null,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get WhatsApp info for client ${clientId}`,
        error,
      );
      return {
        success: false,
        message: 'Error al obtener información de WhatsApp del cliente',
        errors: [error.message],
      };
    }
  }

  /**
   * Verificar disponibilidad de WhatsApp para un número
   */
  async verifyWhatsAppNumber(phone: string): Promise<WhatsAppManagementResult> {
    try {
      // Validación local primero
      const localValidation = PhoneValidatorUtil.validateArgentinePhone(phone);

      if (!localValidation.isValid) {
        return {
          success: false,
          message: 'Número de teléfono inválido',
          validation: localValidation,
          errors: localValidation.errors,
          suggestions: this.getValidationSuggestions(),
        };
      }

      // Verificación con Core Backend
      const result = await this.coreBackendService.verifyWhatsAppNumber(
        localValidation.formattedPhone!,
      );

      return {
        success: true,
        message: result.hasWhatsApp
          ? 'Número de WhatsApp verificado'
          : 'Número no tiene WhatsApp disponible',
        data: {
          ...result,
          validation: localValidation,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to verify WhatsApp number ${phone}`, error);
      return {
        success: false,
        message: 'Error al verificar número de WhatsApp',
        errors: [error.message],
        suggestions: this.getValidationSuggestions(),
      };
    }
  }

  /**
   * Auto-detectar números de WhatsApp desde números móviles existentes
   */
  async autoDetectWhatsAppFromMobiles(clientIds: string[]): Promise<{
    processed: number;
    updated: number;
    failed: number;
    results: Array<{
      clientId: string;
      success: boolean;
      phone?: string;
      whatsappJid?: string;
      error?: string;
    }>;
  }> {
    const results = [];
    let updated = 0;
    let failed = 0;

    for (const clientId of clientIds) {
      try {
        // Obtener información actual del cliente
        const current = await this.getClientWhatsApp(clientId);

        if (current.success && current.data?.phone) {
          const phone = current.data.phone;
          const validation = PhoneValidatorUtil.validateArgentinePhone(phone);

          if (validation.isMobile && validation.hasWhatsApp) {
            // Auto-actualizar como WhatsApp disponible
            const updateResult = await this.updateClientWhatsApp(
              clientId,
              phone,
              { verified: false, skipValidation: true },
            );

            if (updateResult.success) {
              updated++;
              results.push({
                clientId,
                success: true,
                phone: validation.formattedPhone!,
                whatsappJid: validation.whatsappJid,
              });
            } else {
              failed++;
              results.push({
                clientId,
                success: false,
                error: updateResult.message || 'Error desconocido',
              });
            }
          } else {
            results.push({
              clientId,
              success: false,
              phone,
              error: 'Número no es móvil o no tiene WhatsApp',
            });
          }
        } else {
          results.push({
            clientId,
            success: false,
            error: 'Cliente no tiene número de teléfono',
          });
        }
      } catch (error) {
        failed++;
        results.push({
          clientId,
          success: false,
          error: error.message,
        });
      }
    }

    return {
      processed: clientIds.length,
      updated,
      failed,
      results,
    };
  }

  /**
   * Obtener sugerencias de validación para mostrar al usuario
   */
  private getValidationSuggestions() {
    return {
      example: PhoneValidatorUtil.getExample(),
      placeholder: PhoneValidatorUtil.getPlaceholder(),
      inputMask: PhoneValidatorUtil.getInputMask(),
    };
  }

  /**
   * Sincronizar contactos de WhatsApp detectados
   */
  async syncDetectedContacts(
    contacts: Array<{
      jid: string;
      name?: string;
    }>,
  ): Promise<WhatsAppManagementResult> {
    try {
      const validatedContacts = contacts
        .map((contact) => {
          const phone = PhoneValidatorUtil.jidToPhone(contact.jid);
          const validation = PhoneValidatorUtil.validateArgentinePhone(phone);

          return {
            jid: contact.jid,
            phone,
            name: contact.name,
            verified: validation.isValid && validation.hasWhatsApp,
          };
        })
        .filter((contact) => contact.verified); // Solo contactos válidos

      if (validatedContacts.length === 0) {
        return {
          success: true,
          message:
            'No se encontraron contactos válidos de WhatsApp para sincronizar',
          data: { syncedCount: 0, contacts: [] },
        };
      }

      const result =
        await this.coreBackendService.syncWhatsAppContacts(validatedContacts);

      return {
        success: true,
        message: `${result.syncedCount} contactos sincronizados correctamente`,
        data: result,
      };
    } catch (error) {
      this.logger.error('Failed to sync WhatsApp contacts', error);
      return {
        success: false,
        message: 'Error al sincronizar contactos de WhatsApp',
        errors: [error.message],
      };
    }
  }
}
