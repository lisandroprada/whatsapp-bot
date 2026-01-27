import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  UseGuards,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { WhatsappService } from './whatsapp.service';
import { WhatsAppClientService } from './services/whatsapp-client.service';
import { SendMessageDto } from './dto/send-message.dto';
import {
  UpdateClientWhatsAppDto,
  VerifyWhatsAppDto,
  SyncWhatsAppContactsDto,
} from './dto/whatsapp-client.dto';
// import { SendMediaDto } from './dto/send-media.dto';
import { ApiKeyGuard } from './guards/api-key.guard';
import { PhoneValidatorUtil } from '../utils/phone-validator.util';

@Controller('whatsapp')
export class WhatsappController {
  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly whatsappClientService: WhatsAppClientService,
  ) {}

  @Post('session/connect')
  connect() {
    return this.whatsappService.connect();
  }

  @Get('session/status')
  getStatus() {
    return this.whatsappService.getStatus();
  }

  @Post('session/disconnect')
  @UseGuards(ApiKeyGuard)
  disconnect() {
    return this.whatsappService.disconnect();
  }

  @Post('session/clear')
  @UseGuards(ApiKeyGuard)
  clearSession() {
    return this.whatsappService.logoutAndClearSession();
  }

  @Post('message/send/text')
  @UseGuards(ApiKeyGuard)
  sendText(@Body() sendMessageDto: SendMessageDto) {
    return this.whatsappService.sendText(
      sendMessageDto.to,
      sendMessageDto.text,
    );
  }

  @Post('message/send/media')
  @UseGuards(ApiKeyGuard)
  @UseInterceptors(FileInterceptor('file'))
  sendMedia(
    @Body('to') to: string,
    @Body('caption') caption: string,
    @Body('mediaType') mediaType: 'image' | 'video' | 'document',
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.whatsappService.sendMediaUpload(to, caption, file, mediaType);
  }

  @Get('chats')
  @UseGuards(ApiKeyGuard)
  getChats() {
    return this.whatsappService.getChats();
  }

  @Get('messages/:jid')
  @UseGuards(ApiKeyGuard)
  getMessages(@Param('jid') jid: string) {
    return this.whatsappService.getMessages(jid);
  }

  @Get('contact/:jid/profile-picture')
  @UseGuards(ApiKeyGuard)
  getProfilePicture(@Param('jid') jid: string) {
    return this.whatsappService.getProfilePicture(jid);
  }

  @Post('chat/:jid/read')
  @UseGuards(ApiKeyGuard)
  markAsRead(@Param('jid') jid: string) {
    return this.whatsappService.markAsRead(jid);
  }

  // ========== Gestión de Números WhatsApp ==========

  /**
   * Actualizar número de WhatsApp de un cliente
   */
  @Put('client/:clientId/whatsapp')
  @UseGuards(ApiKeyGuard)
  async updateClientWhatsApp(
    @Param('clientId') clientId: string,
    @Body() updateDto: UpdateClientWhatsAppDto,
  ) {
    return this.whatsappClientService.updateClientWhatsApp(
      clientId,
      updateDto.phone,
      { verified: updateDto.verified },
    );
  }

  /**
   * Obtener información de WhatsApp de un cliente
   */
  @Get('client/:clientId/whatsapp')
  @UseGuards(ApiKeyGuard)
  async getClientWhatsApp(@Param('clientId') clientId: string) {
    return this.whatsappClientService.getClientWhatsApp(clientId);
  }

  /**
   * Verificar si un número tiene WhatsApp disponible
   */
  @Post('verify-number')
  @UseGuards(ApiKeyGuard)
  async verifyWhatsAppNumber(@Body() verifyDto: VerifyWhatsAppDto) {
    return this.whatsappClientService.verifyWhatsAppNumber(verifyDto.phone);
  }

  /**
   * Auto-detectar WhatsApp para múltiples clientes
   */
  @Post('auto-detect')
  @UseGuards(ApiKeyGuard)
  async autoDetectWhatsApp(@Body() { clientIds }: { clientIds: string[] }) {
    return this.whatsappClientService.autoDetectWhatsAppFromMobiles(clientIds);
  }

  /**
   * Sincronizar contactos de WhatsApp detectados
   */
  @Post('sync-contacts')
  @UseGuards(ApiKeyGuard)
  async syncWhatsAppContacts(@Body() syncDto: SyncWhatsAppContactsDto) {
    return this.whatsappClientService.syncDetectedContacts(
      syncDto.contacts.map((c) => ({ jid: c.jid, name: c.name })),
    );
  }

  /**
   * Utilidades para validación frontend
   */
  @Get('utils/phone-validation')
  getPhoneValidationUtils() {
    return {
      inputMask: PhoneValidatorUtil.getInputMask(),
      example: PhoneValidatorUtil.getExample(),
      placeholder: PhoneValidatorUtil.getPlaceholder(),
      mobileAreaCodes: [
        '911',
        '915',
        '916',
        '280',
        '281',
        '297',
        '299',
        '261',
        '263',
        '264',
        '266',
        '351',
        '353',
        '354',
        '358',
        '376',
        '379',
        '381',
        '383',
        '385',
      ], // Algunos ejemplos más comunes
    };
  }

  /**
   * Validar número de teléfono (endpoint utilitario para frontend)
   */
  @Post('utils/validate-phone')
  validatePhone(@Body() { phone }: { phone: string }) {
    const validation = PhoneValidatorUtil.validateArgentinePhone(phone);

    return {
      ...validation,
      suggestions: !validation.isValid
        ? {
            example: PhoneValidatorUtil.getExample(),
            placeholder: PhoneValidatorUtil.getPlaceholder(),
            inputMask: PhoneValidatorUtil.getInputMask(),
          }
        : undefined,
    };
  }

  /**
   * Verificar específicamente si un número es móvil (para backoffice)
   */
  @Post('utils/is-mobile')
  isMobileNumber(@Body() { phone }: { phone: string }) {
    const isMobile = PhoneValidatorUtil.isMobileNumber(phone);
    const isChubutMobile = PhoneValidatorUtil.isChubutMobile(phone);
    const cleaned = PhoneValidatorUtil.cleanPhoneNumber(phone);

    return {
      phone: phone,
      cleaned: cleaned,
      isMobile: isMobile,
      isChubutMobile: isChubutMobile,
      explanation: isMobile
        ? 'Número móvil válido para WhatsApp'
        : 'Número no es móvil - WhatsApp requiere números celulares',
      formattedPhone: isMobile
        ? PhoneValidatorUtil.normalizeArgentinePhone(phone)
        : null,
      displayFormat: isMobile
        ? PhoneValidatorUtil.formatForDisplay(phone)
        : null,
    };
  }

  /**
   * Endpoint específico para validar números de Chubut
   */
  @Post('utils/validate-chubut')
  validateChubutNumber(@Body() { phone }: { phone: string }) {
    const isChubutMobile = PhoneValidatorUtil.isChubutMobile(phone);
    const generalValidation = PhoneValidatorUtil.validateArgentinePhone(phone);

    return {
      phone: phone,
      isValidChubut: isChubutMobile,
      isValidMobile: generalValidation.isMobile,
      isValid: generalValidation.isValid,
      details: {
        formatted: generalValidation.formattedPhone,
        display: generalValidation.displayFormat,
        whatsappJid: generalValidation.whatsappJid,
      },
      message: isChubutMobile
        ? 'Número de Chubut válido para WhatsApp'
        : 'No es un número móvil de Chubut',
    };
  }
}
