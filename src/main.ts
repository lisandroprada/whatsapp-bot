import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: ['http://localhost:3001', 'http://localhost:3050', 'http://localhost:3000', 'http://localhost:8080', 'http://localhost:5173'],
    credentials: true,
  });
  await app.listen(3000);
}
bootstrap();
