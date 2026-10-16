import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ENV, Env } from './config/env';
import { configureApp } from './configure-app';

async function bootstrap(): Promise<void> {
  // rawBody: Paystack webhook signatures are computed over the exact bytes.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  configureApp(app);
  const env = app.get<Env>(ENV);
  await app.listen(env.PORT);
  Logger.log(`API listening on :${env.PORT} (${env.NODE_ENV})`, 'Bootstrap');
}

void bootstrap();
