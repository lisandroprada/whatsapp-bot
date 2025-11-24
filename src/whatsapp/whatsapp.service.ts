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
// import axios from 'axios';
import { Chat } from './schemas/chat.schema';
import { Message } from './schemas/message.schema';

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
    private readonly whatsappGateway: WhatsappGateway,
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
        switch (messageType) {
          case 'imageMessage':
            fileExtension = 'jpg';
            break;
          case 'videoMessage':
            fileExtension = 'mp4';
            break;
          case 'audioMessage':
            fileExtension = 'ogg';
            break;
          default:
            fileExtension = 'bin';
            break;
        }

        const fileName = `${Date.now()}.${fileExtension}`;
        const filePath = join(process.cwd(), 'public', 'media', fileName);
        writeFileSync(filePath, mediaBuffer as Buffer);
        content = `/media/${fileName}`;
      } else {
        content =
          message.message?.conversation ||
          message.message?.extendedTextMessage?.text ||
          '';
      }

      if (!content) return; // Do not save messages with no content

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
    } catch (error) {
      this.logger.error('Failed to process message upsert', error);
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
    return this.sock.sendMessage(to, { text });
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
    return this.sock.sendMessage(to, {
      [mediaType]: file.buffer,
      mimetype: file.mimetype,
      caption: caption,
    });
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

  async getMessages(jid: string) {
    return this.messageModel.find({ jid }).sort({ timestamp: 1 }).lean();
  }
}
