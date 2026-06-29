import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for development and mobile app (MUST be first middleware)
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:19000',
      'http://localhost:19001',
      'http://127.0.0.1:19000',
      'http://127.0.0.1:19001',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 200,
  });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}

void bootstrap();
