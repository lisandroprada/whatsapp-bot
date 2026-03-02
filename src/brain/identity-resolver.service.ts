import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Chat } from '../whatsapp/schemas/chat.schema';
import { CoreBackendService } from './services/core-backend.service';

export interface OperatorData {
  userId: string;
  agentId: string;
  name: string;
  role: string;
  companyId: string;
}

export interface IdentityResolutionResult {
  isOperator: boolean;
  operatorData?: OperatorData;
}

@Injectable()
export class IdentityResolverService {
  private readonly logger = new Logger(IdentityResolverService.name);

  constructor(
    @InjectModel(Chat.name) private readonly chatModel: Model<Chat>,
    private readonly coreBackendService: CoreBackendService,
  ) {}

  /**
   * Resolve the identity of a WhatsApp JID.
   * Returns cached result from Chat if available; otherwise queries the backend.
   */
  async resolve(jid: string): Promise<IdentityResolutionResult> {
    try {
      const chat = await this.chatModel.findOne({ jid }).lean();

      // Return cached result if already resolved (only if companyId is also cached)
      if (chat && chat.isOperator && chat.operatorAgentId && (chat as any).operatorCompanyId) {
        this.logger.log(`[IdentityResolver] Cache hit for ${jid}: OPERATOR (${chat.operatorAgentId})`);
        return {
          isOperator: true,
          operatorData: {
            userId: (chat as any).operatorUserId ?? chat.operatorAgentId,
            agentId: chat.operatorAgentId,
            name: chat.name || 'Operador',
            role: 'ADMIN',
            companyId: (chat as any).operatorCompanyId ?? '',
          },
        };
      }

      // If already marked as non-operator (and was explicitly cached), skip
      if (chat && chat.isOperator === false && chat.operatorAgentId === null) {
        // isOperator was explicitly set to false — but we only cache 'true' results,
        // so we always re-check for new chats where isOperator defaults to false.
        // Only skip if we have already queried the backend (operatorAgentId would be '' if we had).
        // For simplicity: always query the backend on the first message and cache.
      }

      // Query backend
      const result = await this.coreBackendService.resolveOperator(jid);

      if (result.isOperator) {
        this.logger.log(
          `[IdentityResolver] ${jid} identified as OPERATOR: ${result.name} (${result.role})`,
        );

        // Cache in Chat document
        await this.chatModel.updateOne(
          { jid },
          {
            $set: {
              isOperator: true,
              operatorAgentId: result.agentId,
              operatorUserId: result.userId ?? result.agentId,
              operatorCompanyId: result.companyId,
              name: result.name,
            },
          },
          { upsert: true },
        );

        return {
          isOperator: true,
          operatorData: {
            userId: result.userId ?? result.agentId,
            agentId: result.agentId,
            name: result.name,
            role: result.role,
            companyId: result.companyId,
          },
        };
      }

      this.logger.log(`[IdentityResolver] ${jid} identified as CLIENT/GUEST`);
      return { isOperator: false };
    } catch (error) {
      this.logger.error(`[IdentityResolver] Error resolving identity for ${jid}:`, error.message);
      return { isOperator: false };
    }
  }
}
