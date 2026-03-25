import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { BrainService } from './brain.service';
import { BrainController } from './brain.controller';
import { IdentityResolverService } from './identity-resolver.service';
import { OperatorBrainService } from './operator-brain.service';
import { Message, MessageSchema } from '../whatsapp/schemas/message.schema';
import { Chat, ChatSchema } from '../whatsapp/schemas/chat.schema';
import { Contact, ContactSchema } from '../whatsapp/schemas/contact.schema';
import { AiConfig, AiConfigSchema } from './schemas/ai-config.schema';
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
import { CreateLeadTool } from './tools/create-lead.tool';
import { GetPendingTasksTool } from './tools/operator/get-pending-tasks.tool';
import { CreateWorkOrderTool } from './tools/operator/create-work-order.tool';
import { GetAgendaTool } from './tools/operator/get-agenda.tool';
import { CreateAgendaActionTool } from './tools/operator/create-agenda-action.tool';
import { EditAgendaActionTool } from './tools/operator/edit-agenda-action.tool';
import { MarkActionDoneTool } from './tools/operator/mark-action-done.tool';
import { SearchContactsTool } from './tools/operator/search-contacts.tool';
import { SendWhatsAppToContactTool } from './tools/operator/send-whatsapp-to-contact.tool';
import { RequestShowingTool } from './tools/request-showing.tool';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },
      { name: Chat.name, schema: ChatSchema },
      { name: Contact.name, schema: ContactSchema },
      { name: AiConfig.name, schema: AiConfigSchema },
    ]),
  ],
  controllers: [BrainController],
  providers: [
    BrainService,
    IdentityResolverService,
    OperatorBrainService,
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
    CreateLeadTool,
    GetPendingTasksTool,
    CreateWorkOrderTool,
    GetAgendaTool,
    CreateAgendaActionTool,
    EditAgendaActionTool,
    MarkActionDoneTool,
    SearchContactsTool,
    SendWhatsAppToContactTool,
    RequestShowingTool,
  ],
  exports: [BrainService, IdentityResolverService, OperatorBrainService, CoreBackendService],
})
export class BrainModule {}
