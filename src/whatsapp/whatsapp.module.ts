import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';
import { WhatsappGateway } from './whatsapp.gateway';
import {
  WhatsappSession,
  WhatsappSessionSchema,
} from './schemas/session.schema';
import { Chat, ChatSchema } from './schemas/chat.schema';
import { Message, MessageSchema } from './schemas/message.schema';
import { Contact, ContactSchema } from './schemas/contact.schema';
import { BrainModule } from '../brain/brain.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WhatsappSession.name, schema: WhatsappSessionSchema },
      { name: Chat.name, schema: ChatSchema },
      { name: Message.name, schema: MessageSchema },
      { name: Contact.name, schema: ContactSchema },
    ]),
    BrainModule,
  ],
  controllers: [WhatsappController],
  providers: [WhatsappService, WhatsappGateway],
})
export class WhatsappModule {}
