import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { BrainService } from './brain.service';
import { Message, MessageSchema } from '../whatsapp/schemas/message.schema';
import { Chat, ChatSchema } from '../whatsapp/schemas/chat.schema';
import { Contact, ContactSchema } from '../whatsapp/schemas/contact.schema';
import { CoreBackendService } from './services/core-backend.service';
import { CoreBackendMockService } from './services/core-backend-mock.service';
import { AccountStatusTool } from './tools/account-status.tool';
import { CreateComplaintTool } from './tools/create-complaint.tool';
import { VerifyIdentityTool } from './tools/verify-identity.tool';
import { VerifyOtpTool } from './tools/verify-otp.tool';
import { SearchPropertiesTool } from './tools/search-properties.tool';
import { ScheduleMeetingTool } from './tools/schedule-meeting.tool';
import { GetRentalRequirementsTool } from './tools/get-rental-requirements.tool';
import { RequestAppraisalTool } from './tools/request-appraisal.tool';
import { GetAvailableCitiesTool } from './tools/get-available-cities.tool';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },
      { name: Chat.name, schema: ChatSchema },
      { name: Contact.name, schema: ContactSchema },
    ]),
  ],
  providers: [
    BrainService,
    CoreBackendService,
    CoreBackendMockService,
    AccountStatusTool,
    CreateComplaintTool,
    VerifyIdentityTool,
    VerifyOtpTool,
    SearchPropertiesTool,
    ScheduleMeetingTool,
    GetRentalRequirementsTool,
    RequestAppraisalTool,
    GetAvailableCitiesTool,
  ],
  exports: [BrainService, CoreBackendService],
})
export class BrainModule {}
