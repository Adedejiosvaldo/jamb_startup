import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

type Handler = (req: IncomingMessage, res: ServerResponse) => void;

let cached: Promise<Handler> | null = null;

/**
 * Serverless entry (Vercel). Boots Nest once per warm instance and reuses the
 * underlying Express app for every request.
 */
export function getHandler(): Promise<Handler> {
  cached ??= (async () => {
    const app = await NestFactory.create(AppModule, {
      rawBody: true,
      logger: ['error', 'warn', 'log'],
    });
    configureApp(app);
    await app.init();
    return app.getHttpAdapter().getInstance() as Handler;
  })();
  return cached;
}
