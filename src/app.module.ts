import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { MongooseModule } from '@nestjs/mongoose';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      serveRoot: '/',
      exclude: ['/api*', '/whatsapp*'], // Excluir rutas API
    }),
    WhatsappModule,
    MongooseModule.forRoot('mongodb://localhost/nest-whatsapp'),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
