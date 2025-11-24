import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:8080'],
    credentials: true,
  },
})
export class WhatsappGateway {
  @WebSocketServer()
  server: Server;

  sendNewMessage(message: any) {
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
