import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '@app/app.module';

/**
 * Builds the app for the auth e2e tests against Keycloak (AC-6, sm-0004). Reads
 * env from the process environment provided by the test invocation; there is no
 * separate config file so local and CI use the same source of truth.
 */
export async function buildE2eApp(): Promise<INestApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  app.set('trust proxy', true);
  return app;
}
