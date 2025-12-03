import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3001', 'http://localhost:3050', 'http://localhost:3000', 'http://localhost:8080', 'http://localhost:5173'],
    credentials: true,
  },
})
export class WhatsappGateway {
  @WebSocketServer()
  server: Server;

  sendNewMessage(message: any) {
    console.log('[WhatsappGateway] Broadcasting new-message event to all clients:', {
      jid: message.jid,
      fromMe: message.fromMe,
      type: message.type,
    });
    this.server.emit('new-message', message);
  }

  sendQrCode(qr: string) {
    this.server.emit('qr', { qr });
  }

  sendStatus(status: string) {
    this.server.emit('status', { status });
  }

  sendLog(message: string) {
    this.server.emit('log', { message });
  }
}
