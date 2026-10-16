import { INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ENV, Env } from './config/env';

/** Shared by main.ts and e2e tests so both run the same middleware stack. */
export function configureApp(app: INestApplication): void {
  const env = app.get<Env>(ENV);
  const express = app as NestExpressApplication;
  express.disable('x-powered-by');
  // Behind Cloudflare / the platform load balancer: trust one proxy hop for client IPs.
  express.set('trust proxy', 1);
  app.enableCors({
    origin: env.CORS_ORIGINS.split(',').map((o) => o.trim()),
    credentials: false,
  });
  app.enableShutdownHooks();
}
