import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

export const SWAGGER_PATH = 'docs';
export const SWAGGER_SECURITY = {
  bearer: 'bearerAuth',
  webhookApiKey: 'webhookApiKey',
} as const;

/**
 * Base OpenAPI config (AC-1): title, version and the two security schemes that
 * mirror `docs/api.yaml`'s `securitySchemes`, plus the global bearer
 * requirement so private endpoints default to JWT. Paths are filled in by
 * `SwaggerModule.createDocument` when the UI is mounted; taxonomy and health
 * endpoints override the default with `security: []` at the operation level.
 */
function baseDocumentConfig(): Omit<OpenAPIObject, 'paths'> {
  return new DocumentBuilder()
    .setTitle('Finances API')
    .setDescription(
      'admin-back · finances — contrato generado desde el código (AC-1, sm-0004).',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      SWAGGER_SECURITY.bearer,
    )
    .addSecurity(SWAGGER_SECURITY.webhookApiKey, {
      type: 'apiKey',
      in: 'header',
      name: 'x-api-key',
    })
    .addSecurityRequirements(SWAGGER_SECURITY.bearer)
    .build();
}

/**
 * Returns the OpenAPI document base — the security schemes and the global
 * requirement — independent of the running app, so the contract's security
 * shape is verifiable in isolation (AC-1).
 */
export function buildSwaggerDocument(_app?: INestApplication): OpenAPIObject {
  return baseDocumentConfig() as OpenAPIObject;
}

/**
 * Mounts the navigable Swagger UI at `/docs` only when `SHOW_DOCS` is true
 * (dev/staging). The full document — including the scanned paths — is generated
 * here; production keeps the UI off while the contract can still be produced.
 */
export function maybeMountSwagger(
  app: INestApplication,
  showDocs: boolean,
): void {
  if (!showDocs) return;

  const document = SwaggerModule.createDocument(app, baseDocumentConfig());
  SwaggerModule.setup(SWAGGER_PATH, app, document);
}
