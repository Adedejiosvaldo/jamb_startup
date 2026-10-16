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
  // On Vercel the API is public under /api (vercel.json rewrite to the `api` service).
  // Strip that prefix if the platform forwards it, so routes stay /v1/... and /health
  // whether or not the prefix is stripped upstream, and local dev works with or without it.
  express.use((req: { url: string }, _res: unknown, next: () => void) => {
    if (req.url === '/api' || req.url.startsWith('/api/') || req.url.startsWith('/api?')) {
      req.url = req.url.slice(4) || '/';
    }
    next();
  });
  app.enableCors({
    origin: env.CORS_ORIGINS.split(',').map((o) => o.trim()),
    credentials: false,
  });
  app.enableShutdownHooks();
}
