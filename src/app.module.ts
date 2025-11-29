import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { BrainModule } from './brain/brain.module';
import { MongooseModule } from '@nestjs/mongoose';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      serveRoot: '/',
      exclude: ['/api*', '/whatsapp*'], // Excluir rutas API
    }),
    WhatsappModule,
    BrainModule,
    MongooseModule.forRoot('mongodb://localhost/nest-whatsapp'),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
