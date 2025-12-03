import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { WhatsappService } from './whatsapp.service';
import { SendMessageDto } from './dto/send-message.dto';
// import { SendMediaDto } from './dto/send-media.dto';
import { ApiKeyGuard } from './guards/api-key.guard';

@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

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
}
