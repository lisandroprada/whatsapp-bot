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
} from '@whiskeysockets/baileys';
import { initAuthCreds } from '@whiskeysockets/baileys/lib/Utils/auth-utils';
import { Boom } from '@hapi/boom';
import * as qrcode from 'qrcode';
import { writeFileSync } from 'fs';
import { join } from 'path';

import { WhatsappSession } from './schemas/session.schema';
import { WhatsappGateway } from './whatsapp.gateway';
import { Chat } from './schemas/chat.schema';
import { Message } from './schemas/message.schema';
import { Contact } from './schemas/contact.schema';
import { BrainService } from '../brain/brain.service';
import { CoreBackendService } from '../brain/services/core-backend.service';

@Injectable()
export class WhatsappService implements OnModuleInit {
  private sock: any;
  private status: string = 'closed';
  private qr: string = '';
  private qrBase64: string = '';
  private readonly logger = new Logger(WhatsappService.name);
  private readonly instanceName = 'my-instance'; // Hardcoded for single session

  constructor(
    @InjectModel(WhatsappSession.name)
    private readonly sessionModel: Model<WhatsappSession>,
    @InjectModel(Chat.name) private readonly chatModel: Model<Chat>,
    @InjectModel(Message.name) private readonly messageModel: Model<Message>,
    @InjectModel(Contact.name) private readonly contactModel: Model<Contact>,
    private readonly whatsappGateway: WhatsappGateway,
    private readonly brainService: BrainService,
    private readonly coreBackendService: CoreBackendService,
  ) {}

  async onModuleInit() {
    this.connect();
  }

  async connect() {
    if (this.status === 'open' || this.status === 'connecting') {
      this.whatsappGateway.sendLog('Connection already in progress or open.');
      return { status: this.status };
    }
    this.status = 'connecting';
    this.whatsappGateway.sendStatus(this.status);
    this.whatsappGateway.sendLog('Starting connection...');

    const { state, saveCreds } = await this.getAuthState();

    const { version, isLatest } = await fetchLatestBaileysVersion();
    this.whatsappGateway.sendLog(
      `Using WA v${version.join('.')}, isLatest: ${isLatest}`,
    );

    this.sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, {
          trace: (msg: any) => this.logger.verbose(msg),
          debug: (msg: any) => this.logger.debug(msg),
          info: (msg: any) => this.logger.log(msg),
          warn: (msg: any) => this.logger.warn(msg),
          error: (msg: any) => this.logger.error(msg),
          fatal: (msg: any) => this.logger.error(msg),
        } as any),
      },
      logger: {
        ...this.logger,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        child: (_bindings: any) => ({
          ...this.logger,
          trace: (msg: any) => this.logger.verbose(msg),
          debug: (msg: any) => this.logger.debug(msg),
          info: (msg: any) => this.logger.log(msg),
          warn: (msg: any) => this.logger.warn(msg),
          error: (msg: any) => this.logger.error(msg),
          fatal: (msg: any) => this.logger.error(msg),
        }),
        trace: (msg: any) => this.logger.verbose(msg),
        debug: (msg: any) => this.logger.debug(msg),
        info: (msg: any) => this.logger.log(msg),
        warn: (msg: any) => this.logger.warn(msg),
        error: (msg: any) => this.logger.error(msg),
        fatal: (msg: any) => this.logger.error(msg),
      } as any,
    });

    this.sock.ev.on(
      'connection.update',
      this.handleConnectionUpdate.bind(this),
    );
    this.sock.ev.on('creds.update', saveCreds);
    this.sock.ev.on('messages.upsert', this.handleMessagesUpsert.bind(this));

    return { status: 'connecting' };
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
      if (
        messageType === 'imageMessage' ||
        messageType === 'videoMessage' ||
        messageType === 'audioMessage'
      ) {
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
          default:
            fileExtension = 'bin';
            mimeType = 'application/octet-stream';
            break;
        }

        const originalFileName = 
          message.message[messageType]?.fileName || 
          `media_${Date.now()}.${fileExtension}`;
        const fileName = `${Date.now()}.${fileExtension}`;
        const filePath = join(process.cwd(), 'public', 'media', fileName);
        writeFileSync(filePath, mediaBuffer as Buffer);
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
              unreadCount: 0
              // No borramos coreClientId para no desvincular, solo limpiar chat
              // Si se quiere desvincular, usar /unlink (futuro)
            } 
          }
        );

        await this.sendText(jid, '🔄 *Chat reiniciado*\n\nHe borrado el historial de esta conversación. Soy un bot con memoria nueva. ¿En qué puedo ayudarte?');
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
   * Procesar mensaje usando BrainService
   */
  private async processByBrain(message: any, jid: string) {
    try {
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

      // 2. Intentar vincular con Core Backend (auto-link)
      if (!chat.coreClientId) {
        await this.tryLinkClientFromCore(jid, chat);
        // Recargar chat después del link
        chat = await this.chatModel.findOne({ jid });
      }

      // 3. Verificar si debe responder el bot
      const shouldBotRespond = chat.mode === 'BOT' && chat.isBotActive !== false;

      if (!shouldBotRespond) {
        this.logger.log(
          `[Brain] Bot disabled for ${jid} (mode: ${chat.mode}, active: ${chat.isBotActive})`,
        );
        return;
      }

      // 4. Obtener nombre del cliente si está registrado
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

      // 5. Determinar si es usuario registrado
      const isRegistered = !!chat.coreClientId;

      // 6. Extraer texto del mensaje
      const textContent =
        message.message?.conversation ||
        message.message?.extendedTextMessage?.text ||
        '';

      if (!textContent) {
        this.logger.log('[Brain] No text content, skipping AI response');
        return;
      }

      // 7. Procesar con Brain
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
      await this.sendText(jid, aiResponse);

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
   * Intenta vincular automáticamente el JID con un cliente del Core Backend
   */
  private async tryLinkClientFromCore(jid: string, chat: any) {
    try {
      const coreClient = await this.coreBackendService.getClientByJid(jid);

      if (coreClient) {
        this.logger.log(`[AutoLink] Found client in Core: ${coreClient.name}`);

        // Actualizar chat con ID del Core y nombre
        await this.chatModel.updateOne(
          { jid },
          {
            coreClientId: coreClient.id,
            name: coreClient.name, // Guardar nombre del cliente
          },
        );

        // Actualizar o crear contacto con nombre
        await this.contactModel.updateOne(
          { jid },
          {
            name: coreClient.name,
            phone: coreClient.phone,
            isVerified: true,
            metadata: coreClient,
          },
          { upsert: true },
        );

        this.logger.log(`[AutoLink] Linked ${jid} to Core client ${coreClient.id} (${coreClient.name})`);
      }
    } catch (error) {
      this.logger.warn(`[AutoLink] Could not link ${jid} to Core:`, error.message);
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
        this.whatsappGateway.sendLog('Credentials loaded from database.');
      } catch (error) {
        this.whatsappGateway.sendLog(
          'Failed to parse stored credentials, starting fresh',
        );
      }
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
    if (qr) {
      this.qr = qr;
      this.whatsappGateway.sendLog('QR code generated. Scan with WhatsApp.');
      qrcode.toDataURL(qr, (err, url) => {
        if (err) {
          this.logger.error('Error generating QR code', err);
          return;
        }
        // Extract base64 part from data URL
        this.qrBase64 = url.split(',')[1] || '';
        this.whatsappGateway.sendQrCode(url);
      });
    }

    if (connection) {
      this.status = connection;
      this.whatsappGateway.sendStatus(this.status);
    }

    if (connection === 'close') {
      const shouldReconnect =
        (lastDisconnect.error as Boom)?.output?.statusCode !==
        DisconnectReason.loggedOut;
      this.whatsappGateway.sendLog(
        `Connection closed due to ${lastDisconnect.error}, reconnecting: ${shouldReconnect}`,
      );
      if (shouldReconnect) {
        setTimeout(() => this.connect(), 5000);
      }
    } else if (connection === 'open') {
      this.whatsappGateway.sendLog('Connection opened successfully.');
    }
  }

  getStatus() {
    return { status: this.status, qr: this.qrBase64 };
  }

  async sendText(to: string, text: string) {
    if (this.status !== 'open') {
      throw new Error('WhatsApp is not connected');
    }

    // 1. Enviar mensaje por WhatsApp
    await this.sock.sendMessage(to, { text });

    // 2. Guardar mensaje en MongoDB (fromMe: true porque lo envía el bot/operador)
    const message = new this.messageModel({
      jid: to,
      fromMe: true,
      type: 'conversation',
      content: text,
      timestamp: new Date(),
    });

    await message.save();

    // 3. Actualizar último mensaje del chat
    await this.chatModel.updateOne(
      { jid: to },
      {
        $set: { lastMessage: message },
      },
      { upsert: true },
    );

    // 4. Emitir evento WebSocket para que el frontend se actualice
    const messageData = message.toJSON();
    this.logger.log(`[WebSocket] Emitting new-message event:`, {
      jid: messageData.jid,
      fromMe: messageData.fromMe,
      content: messageData.content?.substring(0, 50),
    });
    this.whatsappGateway.sendNewMessage(messageData);

    this.logger.log(`[Manual] Message sent to ${to} via operator/API`);

    return { success: true, message: message.toJSON() };
  }

  async sendMediaUpload(
    to: string,
    caption: string,
    file: Express.Multer.File,
    mediaType: 'image' | 'video' | 'document',
  ) {
    if (this.status !== 'open') {
      throw new Error('WhatsApp is not connected');
    }
    if (!file) {
      throw new Error('No file uploaded');
    }

    // 1. Enviar media por WhatsApp
    await this.sock.sendMessage(to, {
      [mediaType]: file.buffer,
      mimetype: file.mimetype,
      caption: caption,
    });

    // 2. Guardar archivo localmente
    const fileName = `${Date.now()}_${file.originalname}`;
    const filePath = join(process.cwd(), 'public', 'media', fileName);
    writeFileSync(filePath, file.buffer);

    // 3. Guardar mensaje en MongoDB con metadata
    const message = new this.messageModel({
      jid: to,
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
      { jid: to },
      {
        $set: { lastMessage: message },
      },
      { upsert: true },
    );

    // 5. Emitir evento WebSocket
    this.whatsappGateway.sendNewMessage(message.toJSON());

    this.logger.log(`[Manual] Media sent to ${to} via operator/API`);

    return { success: true, message: message.toJSON() };
  }

  async disconnect() {
    if (this.sock) {
      await this.sock.logout();
      this.sock = null;
      this.status = 'closed';
      this.qr = '';
      this.qrBase64 = '';
      this.whatsappGateway.sendLog('Disconnected successfully.');
      this.whatsappGateway.sendStatus('closed');
    }
    return { status: 'disconnected' };
  }

  async logoutAndClearSession() {
    await this.disconnect();
    await this.sessionModel.deleteOne({ instanceName: this.instanceName });
    this.whatsappGateway.sendLog('Session credentials cleared from database.');
    this.logger.log('Session credentials cleared from database.');
    return { status: 'cleared' };
  }

  async getChats() {
    return this.chatModel.find().sort({ 'lastMessage.timestamp': -1 }).lean();
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
