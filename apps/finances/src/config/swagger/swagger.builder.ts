import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

export const SWAGGER_PATH = 'docs';
export const SWAGGER_SECURITY = {
  bearer: 'bearerAuth',
  webhookApiKey: 'webhookApiKey',
} as const;

/**
 * Title, version and the security schemes mirroring `docs/api.yaml`, plus the
 * global bearer requirement; paths are filled in when the UI is mounted.
 */
function baseDocumentConfig(): Omit<OpenAPIObject, 'paths'> {
  return new DocumentBuilder()
    .setTitle('Finances API')
    .setDescription('admin-back · finances — contrato generado desde el código.')
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, SWAGGER_SECURITY.bearer)
    .addSecurity(SWAGGER_SECURITY.webhookApiKey, {
      type: 'apiKey',
      in: 'header',
      name: 'x-api-key',
    })
    .addSecurityRequirements(SWAGGER_SECURITY.bearer)
    .build();
}

/** The security shape of the contract, independent of the running app. */
export function buildSwaggerDocument(_app?: INestApplication): OpenAPIObject {
  return baseDocumentConfig() as OpenAPIObject;
}

/** Mounts the Swagger UI at `/docs` only when `showDocs` is true. */
export function maybeMountSwagger(app: INestApplication, showDocs: boolean): void {
  if (!showDocs) return;

  const document = SwaggerModule.createDocument(app, baseDocumentConfig());
  SwaggerModule.setup(SWAGGER_PATH, app, document);
}
