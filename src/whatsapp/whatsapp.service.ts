import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  AuthenticationState,
  makeCacheableSignalKeyStore,
  BufferJSON,
  downloadMediaMessage,
  Browsers,
} from '@whiskeysockets/baileys';
import { initAuthCreds } from '@whiskeysockets/baileys/lib/Utils/auth-utils';
import { Boom } from '@hapi/boom';
import * as qrcode from 'qrcode';
import * as fs from 'fs';
import { join } from 'path';

import { WhatsappSession } from './schemas/session.schema';
import { WhatsappGateway } from './whatsapp.gateway';
import { Chat } from './schemas/chat.schema';
import { Message } from './schemas/message.schema';
import { Contact } from './schemas/contact.schema';
import { BrainService } from '../brain/brain.service';
import { CoreBackendService } from '../brain/services/core-backend.service';
import { IdentityResolverService } from '../brain/identity-resolver.service';
import { OperatorBrainService } from '../brain/operator-brain.service';
import { MessageQueueService, MessagePriority } from './services/message-queue.service';

@Injectable()
export class WhatsappService implements OnModuleInit {
  private sock: any;
  private status: string = 'close';
  private qr: string = '';
  private qrBase64: string = '';
  private readonly logger = new Logger(WhatsappService.name);
  private readonly instanceName = 'my-instance'; // Hardcoded for single session

  // --- Anti-ban: reconexión con backoff exponencial ---
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 10;
  private readonly BASE_RECONNECT_DELAY_MS = 5_000;

  // --- Control global del brain de IA ---
  private isBotGloballyEnabled = true;

  constructor(
    @InjectModel(WhatsappSession.name)
    private readonly sessionModel: Model<WhatsappSession>,
    @InjectModel(Chat.name) private readonly chatModel: Model<Chat>,
    @InjectModel(Message.name) private readonly messageModel: Model<Message>,
    @InjectModel(Contact.name) private readonly contactModel: Model<Contact>,
    private readonly whatsappGateway: WhatsappGateway,
    private readonly brainService: BrainService,
    private readonly coreBackendService: CoreBackendService,
    private readonly identityResolverService: IdentityResolverService,
    private readonly operatorBrainService: OperatorBrainService,
    private readonly messageQueueService: MessageQueueService,
  ) {}

  async onModuleInit() {
    this.connect();
  }

  /**
   * Conexión manual (desde UI o al iniciar el módulo).
   * Siempre resetea el contador de reintentos para que no quede bloqueado
   * tras una racha de fallos automáticos previos.
   */
  async connect() {
    this.reconnectAttempts = 0;
    return this._doConnect();
  }

  private async _doConnect() {
    try {
      if (this.status === 'open' || this.status === 'connecting') {
        this.logger.log('Connection already in progress or open.');
        return { status: this.status };
      }
      this.status = 'connecting';
      this.whatsappGateway.sendStatus(this.status);
      this.whatsappGateway.sendLog('Starting connection...');
      this.logger.log('Starting connection attempt...');

      const { state, saveCreds } = await this.getAuthState();

      const pinoLogger = {
        level: 'error',
        trace: () => {},
        debug: () => {},
        info: () => {},
        warn: (msg: any) => this.logger.warn(`[Baileys Warn] ${msg}`),
        error: (msg: any) => this.logger.error(`[Baileys Error] ${msg}`),
        fatal: (msg: any) => this.logger.error(`[Baileys Fatal] ${msg}`),
        child: () => pinoLogger,
      };

      // Forzar una versión estable si falla la detección automática
      let version: any = [2, 3000, 1015901307]; // Fallback version
      try {
        const remoteVersion = await fetchLatestBaileysVersion();
        version = remoteVersion.version;
        this.logger.log(`Using WA v${version.join('.')}`);
      } catch (e) {
        this.logger.warn(`Failed to fetch latest version, using fallback. Error: ${e.message}`);
      }

      this.sock = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, pinoLogger as any),
        },
        printQRInTerminal: false,
        logger: pinoLogger as any,
        // Anti-ban: identidad de dispositivo realista
        browser: Browsers.macOS('Chrome'),
      });

      this.sock.ev.on('connection.update', (update: any) => {
        this.logger.log(`[ConnectionUpdate] ${JSON.stringify(update)}`);
        this.handleConnectionUpdate(update);
      });
      this.sock.ev.on('creds.update', saveCreds);
      this.sock.ev.on('messages.upsert', this.handleMessagesUpsert.bind(this));

      return { status: 'connecting' };
    } catch (error) {
      this.logger.error(`[Connect ERROR] ${error.message}`);
      this.status = 'close';
      return { status: 'error', message: error.message };
    }
  }

  private async handleMessagesUpsert(m: any) {
    const message = m.messages[0];
    if (message.key.remoteJid === 'status@broadcast') {
      return;
    }

    // Ignorar mensajes propios
    if (message.key.fromMe) {
      return;
    }

    const jid = message.key.remoteJid;
    const messageType = Object.keys(message.message || {})[0];
    let content = 'Unsupported message type';

    try {
      const isDocumentType =
        messageType === 'documentMessage' ||
        messageType === 'documentWithCaptionMessage';
      const isMediaType =
        messageType === 'imageMessage' ||
        messageType === 'videoMessage' ||
        messageType === 'audioMessage' ||
        isDocumentType;

      if (isMediaType) {
        const mediaBuffer = await downloadMediaMessage(message, 'buffer', {});

        let fileExtension: string;
        let mimeType: string;
        switch (messageType) {
          case 'imageMessage':
            fileExtension = 'jpg';
            mimeType = message.message.imageMessage?.mimetype || 'image/jpeg';
            break;
          case 'videoMessage':
            fileExtension = 'mp4';
            mimeType = message.message.videoMessage?.mimetype || 'video/mp4';
            break;
          case 'audioMessage':
            fileExtension = 'ogg';
            mimeType = message.message.audioMessage?.mimetype || 'audio/ogg';
            break;
          case 'documentMessage':
          case 'documentWithCaptionMessage': {
            const docMsg =
              message.message.documentMessage ||
              message.message.documentWithCaptionMessage?.message?.documentMessage;
            mimeType = docMsg?.mimetype || 'application/octet-stream';
            const ext = mimeType.includes('pdf') ? 'pdf' : 'bin';
            fileExtension = ext;
            break;
          }
          default:
            fileExtension = 'bin';
            mimeType = 'application/octet-stream';
            break;
        }

        const originalFileName =
          message.message[messageType]?.fileName ||
          message.message.documentWithCaptionMessage?.message?.documentMessage?.fileName ||
          `media_${Date.now()}.${fileExtension}`;
        const fileName = `${Date.now()}.${fileExtension}`;
        const filePath = join(process.cwd(), 'public', 'media', fileName);
        fs.writeFileSync(filePath, mediaBuffer as Buffer);
        content = `/media/${fileName}`;

        // Store metadata for frontend
        const newMessage = new this.messageModel({
          jid,
          fromMe: message.key.fromMe,
          type: messageType,
          content: content,
          fileName: originalFileName,
          fileSize: (mediaBuffer as Buffer).length,
          mimeType: mimeType,
          timestamp: new Date(message.messageTimestamp * 1000),
        });

        await newMessage.save();

        await this.chatModel.updateOne(
          { jid },
          {
            $set: { lastMessage: newMessage, name: message.pushName || jid },
            $inc: { unreadCount: 1 },
          },
          { upsert: true },
        );

        this.whatsappGateway.sendNewMessage(newMessage.toJSON());

        // ===== SHOWING PRE-QUALIFICATION: intercept docs if there's an active showing =====
        if (messageType === 'imageMessage' || isDocumentType) {
          const chat = await this.chatModel.findOne({ jid });
          if (chat?.activeShowingCaseId) {
            await this.handleShowingDocument(jid, chat, content, originalFileName, mimeType);
            return;
          }
        }

        // Process by brain
        await this.processByBrain(message, jid);
        return; // Exit early since we already saved
      } else {
        content =
          message.message?.conversation ||
          message.message?.extendedTextMessage?.text ||
          '';
      }

      // Text message handling
      if (!content) return; // Do not save messages with no content

      // ===== COMANDOS DE DESARROLLO =====
      if (content.trim().toLowerCase() === '/reset') {
        this.logger.log(`[Dev] Reset command received from ${jid}`);
        
        // 1. Borrar historial de mensajes
        await this.messageModel.deleteMany({ jid });
        
        // 2. Resetear chat (quitar modo bot, limpiar contexto)
        await this.chatModel.updateOne(
          { jid },
          { 
            $set: { 
              isBotActive: true,
              mode: 'BOT',
              lastMessage: null,
              unreadCount: 0,
              activeShowingCaseId: null,
              showingDocsReceived: [],
              // No borramos coreClientId para no desvincular, solo limpiar chat
            }
          }
        );

        await this.sendText(jid, '🔄 *Chat reiniciado*\n\nHe borrado el historial de esta conversación. Soy un bot con memoria nueva. ¿En qué puedo ayudarte?');
        return;
      }

      // Comando: /modo-operador — activa el modo interno (requiere ser User del sistema)
      if (content.trim().toLowerCase() === '/modo-operador') {
        const identity = await this.identityResolverService.resolve(jid);

        if (identity.isOperator) {
          this.logger.log(`[Cmd] /modo-operador activado para ${jid} (${identity.operatorData?.name})`);
          await this.sendText(
            jid,
            `✅ *Modo operador activado*\n\nHola ${identity.operatorData?.name}. Podés pedirme tareas pendientes, crear órdenes de trabajo o buscar propiedades.\n\nEscribí */modo-cliente* para volver al modo externo.`,
          );
        } else {
          this.logger.log(`[Cmd] /modo-operador denegado para ${jid} (no es usuario del sistema)`);
          await this.sendText(
            jid,
            '⛔ No tenés permisos para activar el modo operador. Este número no está registrado como usuario del sistema.',
          );
        }
        return;
      }

      // Comando: /modo-cliente — desactiva el modo operador y vuelve al flujo externo
      if (content.trim().toLowerCase() === '/modo-cliente') {
        await this.chatModel.updateOne(
          { jid },
          { $set: { isOperator: false, operatorAgentId: null } },
        );
        this.logger.log(`[Cmd] /modo-cliente activado para ${jid}`);
        await this.sendText(
          jid,
          '👤 *Modo cliente activado*\n\nAhora te atiendo como usuario externo. Escribí */modo-operador* para volver al modo interno.',
        );
        return;
      }

      // Comando especial: /mail (probar envío de email)
      if (content.trim().toLowerCase() === '/mail') {
        try {
          // Obtener email del cliente si está registrado
          const chat = await this.chatModel.findOne({ jid });
          let testEmail = 'lisandro.prada@gmail.com'; // Email por defecto

          if (chat?.coreClientId) {
            const clientData = await this.coreBackendService.getClientByJid(jid);
            if (clientData?.email) {
              testEmail = clientData.email;
            }
          }

          // Llamar al endpoint de prueba de email
          const response = await this.coreBackendService.testEmail(testEmail);

          await this.sendText(
            jid,
            `📧 Test de Email\n\n✅ Email enviado a: ${testEmail}\n\nRevisa tu bandeja de entrada (y spam).`,
          );
        } catch (error) {
          this.logger.error('[Mail Test] Error:', error);
          await this.sendText(
            jid,
            `❌ Error al enviar email de prueba\n\nDetalles: ${error.message}`,
          );
        }

        return;
      }

      const newMessage = new this.messageModel({
        jid,
        fromMe: message.key.fromMe,
        type: messageType,
        content: content,
        timestamp: new Date(message.messageTimestamp * 1000),
      });

      await newMessage.save();

      await this.chatModel.updateOne(
        { jid },
        {
          $set: { lastMessage: newMessage, name: message.pushName || jid },
          $inc: { unreadCount: 1 },
        },
        { upsert: true },
      );

      this.whatsappGateway.sendNewMessage(newMessage.toJSON());

      // ===== BRAIN INTEGRATION =====
      // Procesar mensaje con IA si el chat está en modo BOT
      await this.processByBrain(message, jid);
    } catch (error) {
      this.logger.error('Failed to process message upsert', error);
    }
  }

  async markAsRead(jid: string) {
    try {
      this.logger.log(`[markAsRead] Attempting to mark as read: ${jid}`);
      
      // 1. Update database
      const result = await this.chatModel.updateOne({ jid }, { $set: { unreadCount: 0 } });
      
      this.logger.log(`[markAsRead] Update result for ${jid}: matched=${result.matchedCount}, modified=${result.modifiedCount}`);

      // 2. Send read receipt to WhatsApp (optional but good practice)
      // This requires knowing the message IDs to mark as read, which is complex.
      // For now, we just reset the counter in our DB.
      // If we wanted to be thorough, we'd need to track unread message IDs.
      
      // 3. Notify frontend via gateway
      // We can send a chat update event
      // this.whatsappGateway.server.emit('chat-update', { jid, unreadCount: 0 });

      return { success: true, result };
    } catch (error) {
      this.logger.error(`Error marking chat as read: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Maneja un archivo recibido como parte del proceso de pre-calificación de visita.
   * Determina si es doc del titular o garante y responde en consecuencia.
   */
  private async handleShowingDocument(
    jid: string,
    chat: any,
    fileUrl: string,
    fileName: string,
    mimeType: string,
  ) {
    const docsReceived: string[] = chat.showingDocsReceived ?? [];
    const isTitularReceived = docsReceived.includes('titular');
    const isGaranteReceived = docsReceived.includes('garante');

    // Determine which doc this is
    const docType = isTitularReceived ? 'garante' : 'titular';

    this.logger.log(`[Showing] ${jid} sent doc → type=${docType} case=${chat.activeShowingCaseId}`);

    // Attach to CRM case in backend
    try {
      await this.coreBackendService.attachShowingDocument(chat.activeShowingCaseId, {
        docType,
        fileUrl,
        fileName,
      });
    } catch (err) {
      this.logger.error('[Showing] Failed to attach document to case', err);
    }

    // Update chat state
    const newDocs = [...docsReceived, docType];
    await this.chatModel.updateOne({ jid }, { $set: { showingDocsReceived: newDocs } });

    if (docType === 'titular') {
      // First doc received — ask for guarantor
      await this.sendText(
        jid,
        `✅ ¡Recibí el recibo de sueldo del *titular*!\n\n` +
        `Ahora necesito el recibo de sueldo del *garante* para completar el proceso.\n\n` +
        `Recordá que el garante:\n` +
        `• No puede ser jubilado\n` +
        `• No puede ser cónyuge ni pareja del titular\n` +
        `• El alquiler no puede superar el 30% de sus ingresos netos\n\n` +
        `Cuando lo tengas, enviámelo y te confirmo la visita. 📄`,
      );
    } else {
      // Both docs received
      await this.sendText(
        jid,
        `✅ ¡Perfecto! Recibí toda la documentación:\n\n` +
        `📄 Recibo titular ✅\n` +
        `📄 Recibo garante ✅\n\n` +
        `Un asesor revisará los documentos y te confirmará la visita en las próximas horas.\n\n` +
        `¡Muchas gracias por tu confianza! 🏠`,
      );

      // Clear active showing state
      await this.chatModel.updateOne(
        { jid },
        { $set: { activeShowingCaseId: null, showingDocsReceived: [] } },
      );

      // Update CRM case status to EN_PROCESO via backend
      try {
        await this.coreBackendService.attachShowingDocument(chat.activeShowingCaseId, {
          docType: 'complete',
          fileUrl: '',
          fileName: 'Documentación completa recibida vía WhatsApp',
        });
      } catch (_) { /* non-critical */ }
    }
  }

  /**
   * Procesar mensaje usando BrainService
   */
  private async processByBrain(message: any, jid: string) {
    try {
      // Guard global: si el brain está desactivado, no responder en ningún chat
      if (!this.isBotGloballyEnabled) {
        this.logger.log(`[Brain] Bot desactivado globalmente, ignorando mensaje de ${jid}`);
        return;
      }

      // 1. Buscar o crear chat
      let chat = await this.chatModel.findOne({ jid });

      if (!chat) {
        // Primera vez que escribe - crear chat en modo BOT
        chat = await this.chatModel.create({
          jid,
          name: message.pushName || jid,
          isBotActive: true,
          mode: 'BOT',
          coreClientId: null,
        });

        this.logger.log(`[Brain] New chat created for ${jid}`);
      }

      // 2. Routing: operator mode is set explicitly via /modo-operador command.
      // 3. If operator — route to OperatorBrainService (skip client auto-link)
      if (chat.isOperator && chat.operatorAgentId) {
        // 3a. Verify bot mode
        const shouldBotRespond = chat.mode === 'BOT' && chat.isBotActive !== false;
        if (!shouldBotRespond) {
          this.logger.log(`[Brain] Bot disabled for operator ${jid}`);
          return;
        }

        const textContent =
          message.message?.conversation ||
          message.message?.extendedTextMessage?.text ||
          '';

        if (!textContent) return;

        this.logger.log(`[Brain] Routing to OperatorBrain for ${chat.name || jid}`);

        const aiResponse = await this.operatorBrainService.processMessage(
          jid,
          textContent,
          {
            userId: (chat as any).operatorUserId ?? chat.operatorAgentId,
            agentId: chat.operatorAgentId,
            name: chat.name || 'Operador',
            role: 'ADMIN',
            companyId: (chat as any).operatorCompanyId ?? '',
          },
        );

        await this.sendText(jid, aiResponse, { incomingMessageKey: message.key });
        return;
      }

      // 4. Client flow — attempt auto-link
      // Clear stale MongoDB ObjectIds (24-char hex) stored from the old system
      const isStaleMongoId = /^[a-f0-9]{24}$/i.test(chat.coreClientId || '');
      if (isStaleMongoId) {
        this.logger.log(`[Brain] Clearing stale MongoDB coreClientId for ${jid}`);
        await this.chatModel.updateOne({ jid }, { $set: { coreClientId: null } });
        chat.coreClientId = null;
      }

      if (!chat.coreClientId) {
        await this.tryLinkClientFromCore(jid, chat, message.pushName);
        // Recargar chat después del link
        chat = await this.chatModel.findOne({ jid });
      }

      // 5. Verificar si debe responder el bot
      const shouldBotRespond = chat.mode === 'BOT' && chat.isBotActive !== false;

      if (!shouldBotRespond) {
        this.logger.log(
          `[Brain] Bot disabled for ${jid} (mode: ${chat.mode}, active: ${chat.isBotActive})`,
        );
        return;
      }

      // 6. Obtener nombre del cliente si está registrado
      let clientName: string | undefined;
      if (chat.coreClientId) {
        // Primero intentar desde el chat (guardado en tryLinkClientFromCore)
        clientName = chat.name;

        // Si no está en chat, buscar en contactos
        if (!clientName) {
          const contact = await this.contactModel.findOne({ jid });
          clientName = contact?.name;
        }
      }

      // 7. Determinar si es usuario registrado
      const isRegistered = !!chat.coreClientId;

      // 8. Extraer texto del mensaje
      const textContent =
        message.message?.conversation ||
        message.message?.extendedTextMessage?.text ||
        '';

      if (!textContent) {
        this.logger.log('[Brain] No text content, skipping AI response');
        return;
      }

      // 9. Procesar con Brain (cliente externo)
      this.logger.log(
        `[Brain] Processing message for ${clientName || jid} (${isRegistered ? 'REGISTERED' : 'GUEST'})`,
      );

      const aiResponse = await this.brainService.processMessage(
        jid,
        textContent,
        isRegistered,
        clientName,
        chat.coreClientId,
      );

      // 8. Enviar respuesta por WhatsApp (sendText ya guarda en DB y emite evento)
      await this.sendText(jid, aiResponse, { incomingMessageKey: message.key });

      // 9. Guardar respuesta del bot en MongoDB
      // const botMessage = new this.messageModel({
      //   jid,
      //   fromMe: true,
      //   type: 'conversation',
      //   content: aiResponse,
      //   timestamp: new Date(),
      // });

      // await botMessage.save();

      // await this.chatModel.updateOne(
      //   { jid },
      //   {
      //     $set: { lastMessage: botMessage },
      //   },
      // );

      // this.whatsappGateway.sendNewMessage(botMessage.toJSON());

      this.logger.log(`[Brain] Response sent to ${jid}`);
    } catch (error) {
      this.logger.error('[Brain] Error processing by brain:', error);
      // No enviamos mensaje de error al usuario para evitar loops
    }
  }

  /**
   * Intenta vincular automáticamente el JID con un cliente del Core Backend.
   * Si no existe, crea un registro PROSPECT provisional con el nombre de WhatsApp.
   */
  private async tryLinkClientFromCore(jid: string, chat: any, pushName?: string) {
    try {
      const coreClient = await this.coreBackendService.getClientByJid(jid);

      if (coreClient) {
        this.logger.log(`[AutoLink] Found client in Core: ${coreClient.name}`);

        await this.chatModel.updateOne(
          { jid },
          { coreClientId: coreClient.id, name: coreClient.name },
        );

        await this.contactModel.updateOne(
          { jid },
          { name: coreClient.name, phone: coreClient.phone, isVerified: true, metadata: coreClient },
          { upsert: true },
        );

        this.logger.log(`[AutoLink] Linked ${jid} to Core client ${coreClient.id} (${coreClient.name})`);
        return;
      }

      // Not found in Core — create provisional PROSPECT
      const phone = jid.split('@')[0];
      const name = pushName || chat.name || phone;

      this.logger.log(`[AutoLink] No Core client found for ${jid} — creating PROSPECT "${name}"`);

      const prospect = await this.coreBackendService.createProspect({ name, phone, jid });

      if (prospect?.id) {
        await this.chatModel.updateOne(
          { jid },
          { coreClientId: prospect.id, name },
        );
        await this.contactModel.updateOne(
          { jid },
          { name, phone, isVerified: false },
          { upsert: true },
        );
        this.logger.log(`[AutoLink] Created PROSPECT ${prospect.documentNumber} → id=${prospect.id}`);
      }
    } catch (error) {
      this.logger.warn(`[AutoLink] Could not link/create ${jid}:`, error.message);
    }
  }

  private async getAuthState(): Promise<{
    state: AuthenticationState;
    saveCreds: () => Promise<void>;
  }> {
    const session = await this.sessionModel
      .findOne({ instanceName: this.instanceName })
      .lean();

    let creds: any = null;
    let keys: any = {};

    if (session && session.creds) {
      try {
        const parsedSession = JSON.parse(
          session.creds as unknown as string,
          BufferJSON.reviver,
        );
        creds = parsedSession.creds;
        keys = parsedSession.keys || {};
        keys = parsedSession.keys || {};
        this.whatsappGateway.sendLog('Credentials loaded from database.');
        fs.appendFileSync('debug.log', `[${new Date().toISOString()}] Credentials loaded from database. Keys types: ${Object.keys(keys).join(', ')}\n`);
      } catch (error) {
        this.whatsappGateway.sendLog(
          'Failed to parse stored credentials, starting fresh',
        );
        fs.appendFileSync('debug.log', `[${new Date().toISOString()}] Failed to parse stored credentials: ${error.message}\n`);
      }
    } else {
        fs.appendFileSync('debug.log', `[${new Date().toISOString()}] No session found in database for ${this.instanceName}\n`);
    }

    // If no valid credentials found, initialize new ones
    if (!creds) {
      creds = initAuthCreds();
      this.whatsappGateway.sendLog(
        'Initialized new authentication credentials',
      );
    }

    // Create a proper key store implementation
    const keyStore = {
      get: async (type: string, ids: string[]) => {
        const data: { [id: string]: any } = {};
        for (const id of ids) {
          if (keys[type] && keys[type][id]) {
            data[id] = keys[type][id];
          }
        }
        return data;
      },
      set: async (data: any) => {
        for (const type in data) {
          if (!keys[type]) keys[type] = {};
          for (const id in data[type]) {
            keys[type][id] = data[type][id];
          }
        }
      },
    };

    const authState = {
      creds,
      keys: keyStore,
    };

    return {
      state: authState,
      saveCreds: async () => {
        const sessionData = {
          creds: authState.creds,
          keys,
        };
        const newCreds = JSON.stringify(sessionData, BufferJSON.replacer, 2);
        await this.sessionModel.updateOne(
          { instanceName: this.instanceName },
          { $set: { creds: newCreds } },
          { upsert: true },
        );
        this.whatsappGateway.sendLog('Credentials saved to database.');
      },
    };
  }

  private async handleConnectionUpdate(update: any) {
    const { connection, lastDisconnect, qr } = update;
    fs.appendFileSync('debug.log', `[${new Date().toISOString()}] Connection Update: ${JSON.stringify(update)}\n`);
    
    if (qr) {
      this.qr = qr;
      this.logger.log('New QR code generated');
      this.whatsappGateway.sendLog('QR code generated. Scan with WhatsApp.');
      qrcode.toDataURL(qr, (err, url) => {
        if (err) {
          this.logger.error('Error generating QR code', err);
          return;
        }
        // Extract base64 part from data URL
        const base64 = url.split(',')[1] || '';
        this.qrBase64 = base64;
        this.whatsappGateway.sendQrCode(url);
        this.logger.log('QR base64 updated in state');
      });
    }

    if (connection) {
      this.status = connection;
      this.whatsappGateway.sendStatus(this.status);
      this.logger.log(`Connection status updated: ${connection}`);
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;

      this.logger.error(
        `[Connection] Cerrada. Code: ${statusCode}. Error: ${lastDisconnect?.error}`,
      );

      // --- Anti-ban: detectar baneo (403) vs logout normal (401) ---
      if (statusCode === 403) {
        // Posible ban de WhatsApp — pausar cola y alertar sin reconectar
        this.messageQueueService.pause('Posible baneo detectado (403)');
        this.whatsappGateway.sendStatus('banned');
        this.whatsappGateway.sendLog(
          '⚠️ ALERTA CRÍTICA: Cuenta posiblemente baneada por WhatsApp (código 403). ' +
          'Todos los envíos pausados. Contactar soporte de Rentia de inmediato.',
        );
        this.logger.error('[ALERT] Posible baneo de WhatsApp (403). Cola pausada. NO se reintenta.');
        return; // No reconectar
      }

      if (statusCode === DisconnectReason.loggedOut) {
        // Logout explícito — limpiar sesión y esperar nuevo QR
        this.messageQueueService.pause('Sesión cerrada (401)');
        this.qr = '';
        this.qrBase64 = '';
        this.logger.log('[Connection] Logout detectado — eliminando credenciales de DB');
        this.whatsappGateway.sendLog('Sesión cerrada. Escaneá el QR nuevamente para reconectar.');
        this.sessionModel
          .deleteOne({ instanceName: this.instanceName })
          .exec()
          .catch(() => {});
        return;
      }

      // Código 515: WhatsApp pide reinicio limpio del socket
      if (statusCode === 515) {
        this.logger.warn('[Connection] Código 515 (restart required) — reconectando inmediatamente');
        this.whatsappGateway.sendLog('Reconexión requerida por el servidor (515)...');
        this.status = 'close';
        setTimeout(() => this._doConnect(), 2_000);
        return;
      }

      // Otros motivos de desconexión — reconectar con backoff exponencial
      this.whatsappGateway.sendLog(
        `Conexión perdida (código ${statusCode}). Reconectando con backoff...`,
      );
      this.scheduleReconnect();

    } else if (connection === 'open') {
      // Resetear contador de reintentos al conectar exitosamente
      this.reconnectAttempts = 0;
      // Reanudar cola si estaba pausada por desconexión temporal
      if (this.messageQueueService.paused) {
        this.messageQueueService.resume();
      }
      this.qr = '';
      this.qrBase64 = '';
      this.whatsappGateway.sendLog('Conexión establecida correctamente.');
      this.logger.log('[Connection] Abierta exitosamente. QR limpiado.');
    }
  }

  getStatus() {
    return {
      status: this.status,
      qr: this.qrBase64,
      hasQr: !!this.qrBase64,
      botEnabled: this.isBotGloballyEnabled,
    };
  }

  setBotEnabled(enabled: boolean) {
    this.isBotGloballyEnabled = enabled;
    const msg = enabled
      ? 'Bot de IA activado globalmente.'
      : 'Bot de IA desactivado. Las conversaciones deben ser atendidas manualmente.';
    this.logger.log(`[Brain] ${msg}`);
    this.whatsappGateway.sendLog(msg);
    this.whatsappGateway.sendBotStatus(enabled);
    return { botEnabled: this.isBotGloballyEnabled };
  }

  /**
   * Envía un mensaje de texto con humanización completa y gestión de cola.
   *
   * @param to      - Número o JID destino
   * @param text    - Texto a enviar
   * @param opts    - Opciones: priority (HIGH/NORMAL), incomingMessageKey (para marcar como leído)
   *
   * Para notificaciones proactivas/bulk usar sendBulkText() — no bloquea el caller.
   */
  async sendText(
    to: string,
    text: string,
    opts: { priority?: MessagePriority; incomingMessageKey?: any } = {},
  ) {
    if (this.status !== 'open') {
      throw new Error(`WhatsApp no está conectado (estado actual: ${this.status})`);
    }
    if (!this.sock) {
      throw new Error('WhatsApp socket no inicializado');
    }

    // Resolver JID antes de encolar para detectar problemas temprano
    const jid = await this.resolveJid(to);
    this.logger.log(`[sendText] Encolando para ${jid} (prioridad: ${opts.priority ?? 'HIGH'})`);

    return this.messageQueueService.enqueue(
      () => this.executeHumanizedSend(jid, text, opts.incomingMessageKey),
      opts.priority ?? 'HIGH',
    );
  }

  /**
   * Encola una notificación proactiva con prioridad NORMAL (15-30s entre mensajes).
   * Fire-and-forget: no espera a que el mensaje sea efectivamente enviado.
   */
  sendBulkText(to: string, text: string): void {
    if (this.status !== 'open') {
      this.logger.warn(`[sendBulk] Omitiendo (no conectado): ${to}`);
      return;
    }
    void this.resolveJid(to).then((jid) => {
      this.messageQueueService
        .enqueue(() => this.executeHumanizedSend(jid, text), 'NORMAL')
        .catch((err) =>
          this.logger.error(`[sendBulk] Falló para ${jid}: ${err.message}`),
        );
    });
  }

  /**
   * Ciclo de vida humanizado de un envío:
   * 1. Marcar mensaje entrante como leído (si corresponde)
   * 2. Activar estado "escribiendo..."
   * 3. Delay dinámico que imita velocidad de tipeo humana
   * 4. Enviar mensaje
   * 5. Limpiar estado de presencia
   * 6. Persistir en DB y emitir evento WS
   */
  private async executeHumanizedSend(
    jid: string,
    text: string,
    incomingMessageKey?: any,
  ): Promise<{ success: boolean; message: any }> {
    // Paso C: Marcar mensaje entrante como leído antes de responder
    if (incomingMessageKey) {
      try {
        await this.sock.readMessages([incomingMessageKey]);
      } catch (e) {
        this.logger.warn(`[Humanize] readMessages falló: ${e.message}`);
      }
    }

    // Paso A: Activar estado "escribiendo..."
    try {
      await this.sock.sendPresenceUpdate('composing', jid);
    } catch (e) {
      this.logger.warn(`[Humanize] sendPresenceUpdate falló: ${e.message}`);
    }

    // Paso B: Delay dinámico — imita velocidad de tipeo humana (máx 8s)
    const typingDelay = Math.min(
      text.length * 50 + this.randomBetween(1_000, 3_000),
      8_000,
    );
    await this.sleep(typingDelay);

    // Enviar el mensaje
    await this.sock.sendMessage(jid, { text });
    this.logger.log(`[sendText] Mensaje enviado a ${jid}`);

    // Limpiar estado de presencia (best-effort)
    this.sock.sendPresenceUpdate('paused', jid).catch(() => {});

    // Persistir en DB + emitir evento WebSocket
    return this.persistOutgoingMessage(jid, text);
  }

  /** Resuelve un número de teléfono al JID correcto, preservando @lid si ya existe en chats. */
  private async resolveJid(to: string): Promise<string> {
    if (to.includes('@')) return to;
    const phone = to.replace(/\D/g, '');
    const existing = await this.chatModel
      .findOne({ jid: { $regex: phone } })
      .lean();
    return existing?.jid ?? `${phone}@s.whatsapp.net`;
  }

  /** Guarda el mensaje saliente en MongoDB y emite el evento WebSocket. */
  private async persistOutgoingMessage(
    jid: string,
    text: string,
  ): Promise<{ success: boolean; message: any }> {
    const message = new this.messageModel({
      jid,
      fromMe: true,
      type: 'conversation',
      content: text,
      timestamp: new Date(),
    });
    await message.save();

    const existingChat = await this.chatModel.findOne({ jid }).lean();
    let contactName: string | undefined;
    if (!existingChat?.name) {
      const contact = await this.contactModel.findOne({ jid }).lean();
      contactName = contact?.name ?? undefined;
    }

    await this.chatModel.updateOne(
      { jid },
      {
        $set: {
          lastMessage: message,
          ...(contactName && { name: contactName }),
        },
      },
      { upsert: true },
    );

    const messageData = message.toJSON();
    if (this.whatsappGateway?.server) {
      this.whatsappGateway.sendNewMessage(messageData);
    }

    this.logger.log(`[sendText] Persistido en DB y emitido WS para ${jid}`);
    return { success: true, message: messageData };
  }

  async sendMediaUpload(
    to: string,
    caption: string,
    file: Express.Multer.File,
    mediaType: 'image' | 'video' | 'document',
  ) {
    try {
      this.logger.log(`[sendMedia] Initiated to ${to}. Type: ${mediaType}. Status: ${this.status}`);
      
      if (this.status !== 'open') {
        throw new Error(`WhatsApp is not connected (status: ${this.status})`);
      }
      if (!file) {
        throw new Error('No file uploaded');
      }
      if (!this.sock) {
        throw new Error('WhatsApp socket is not initialized');
      }

      const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;

      // 1. Enviar media por WhatsApp
      await this.sock.sendMessage(jid, {
        [mediaType]: file.buffer,
        mimetype: file.mimetype,
        caption: caption,
      });
      this.logger.log(`[sendMedia] Baileys sendMedia success for ${jid}`);

      // 2. Guardar archivo localmente
      const fileName = `${Date.now()}_${file.originalname}`;
      const filePath = join(process.cwd(), 'public', 'media', fileName);
      fs.writeFileSync(filePath, file.buffer);

      // 3. Guardar mensaje en MongoDB con metadata
      const message = new this.messageModel({
        jid,
        fromMe: true,
        type: `${mediaType}Message`,
        content: `/media/${fileName}`,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        timestamp: new Date(),
      });

      await message.save();

      // 4. Actualizar último mensaje del chat
      await this.chatModel.updateOne(
        { jid: jid },
        {
          $set: { lastMessage: message },
        },
        { upsert: true },
      );

      // 5. Emitir evento WebSocket
      if (this.whatsappGateway && this.whatsappGateway.server) {
        this.whatsappGateway.sendNewMessage(message.toJSON());
      }

      this.logger.log(`[Manual] Media sent to ${jid} via operator/API`);

      return { success: true, message: message.toJSON() };
    } catch (error) {
      this.logger.error(`[sendMedia] Error: ${error.message}`, error.stack);
      throw error;
    }
  }

  // ─────────────────────────────────────────────
  // Helpers anti-ban / utilidades internas
  // ─────────────────────────────────────────────

  /**
   * Programa un reintento de conexión con backoff exponencial + jitter.
   * Base: 5s → 10s → 20s → 40s … máx 120s. Máx 10 reintentos.
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      this.logger.error(
        '[Reconnect] Máximo de reintentos alcanzado. Intervención manual requerida.',
      );
      this.whatsappGateway.sendStatus('failed');
      this.whatsappGateway.sendLog(
        'ERROR: Máximo de reintentos de conexión alcanzado. Revisá el servidor.',
      );
      return;
    }

    const base = this.BASE_RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts);
    const jitter = Math.floor(Math.random() * 2_000);
    const delay = Math.min(base + jitter, 120_000);

    this.reconnectAttempts++;
    this.logger.warn(
      `[Reconnect] Intento ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS} en ${Math.round(delay / 1000)}s`,
    );
    this.whatsappGateway.sendLog(
      `Reconectando en ${Math.round(delay / 1000)}s (intento ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})...`,
    );

    setTimeout(() => this._doConnect(), delay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  private randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  async disconnect() {
    this.logger.log('Disconnecting WhatsApp socket...');
    if (this.sock) {
      try {
        await this.sock.logout();
      } catch (e) {
        this.logger.warn(`Error during logout: ${e.message}`);
      }
      this.sock = null;
      this.status = 'close';
      this.qr = '';
      this.qrBase64 = '';
      this.whatsappGateway.sendLog('Disconnected successfully.');
      this.whatsappGateway.sendStatus('closed');
    }
    return { status: 'disconnected' };
  }

  async logoutAndClearSession(): Promise<{ status: string; result: any }> {
    this.logger.log('Cleaning up session and clearing credentials...');
    // Force status to closed to prevent reconnection attempts during cleanup
    this.status = 'close';
    
    await this.disconnect();
    
    // Explicitly clear memory state
    this.qr = '';
    this.qrBase64 = '';
    
    const result = await this.sessionModel.deleteOne({ instanceName: this.instanceName });
    this.whatsappGateway.sendLog('Session credentials cleared from database.');
    this.logger.log(`Session credentials cleared from database. Result: ${JSON.stringify(result)}`);
    
    return { status: 'cleared', result };
  }

  async getChats() {
    const chats: any[] = await this.chatModel.find().sort({ 'lastMessage.timestamp': -1 }).lean();
    
    // Background refresh of avatars if needed
    chats.forEach(chat => {
      const lastUpdate = chat.avatarUpdatedAt ? new Date(chat.avatarUpdatedAt).getTime() : 0;
      const now = new Date().getTime();
      const needsRefresh = (now - lastUpdate > 24 * 60 * 60 * 1000); // 24 hours
      
      if (needsRefresh && this.sock && this.status === 'open') {
        this.refreshAvatar(chat.jid).catch(err => 
          this.logger.debug(`Background avatar refresh failed for ${chat.jid}: ${err.message}`)
        );
      }
    });

    return chats;
  }

  async refreshAvatar(jid: string): Promise<string | null> {
    try {
      const avatarUrl = await this.getProfilePicture(jid);
      await this.chatModel.updateOne(
        { jid },
        { 
          avatarUrl, 
          avatarUpdatedAt: new Date() 
        }
      );
      return avatarUrl;
    } catch (error) {
      this.logger.error(`Error refreshing avatar for ${jid}: ${error.message}`);
      return null;
    }
  }

  async getProfilePicture(jid: string): Promise<string | null> {
    try {
      if (!this.sock) {
        throw new Error('WhatsApp socket not initialized');
      }
      
      // Ensure JID is in correct format
      const formattedJid = jid.includes('@s.whatsapp.net') ? jid : `${jid}@s.whatsapp.net`;
      
      const ppUrl = await this.sock.profilePictureUrl(formattedJid, 'image');
      return ppUrl;
    } catch (error) {
      // 401/404 are expected for contacts without profile picture or privacy settings
      if (error?.data === 401 || error?.data === 404) {
        // this.logger.debug(`No profile picture for ${jid} (Privacy/None)`);
        return null;
      }
      
      this.logger.warn(`Could not fetch profile picture for ${jid}: ${error.message}`);
      return null;
    }
  }

  async getMessages(jid: string) {
    return this.messageModel.find({ jid }).sort({ timestamp: 1 }).lean();
  }
}
