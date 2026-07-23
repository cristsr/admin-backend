import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

export const SWAGGER_PATH = 'docs';

/**
 * OpenAPI security schemes (spec pregunta #5). `gatewayContext` is the default
 * development mechanism — a trusted gateway forwards `X-User-Id` / `X-Client-Id`;
 * `bearerAuth` is the JWT alternative kept declared for the eventual switch.
 */
export const SWAGGER_SECURITY = {
  gatewayContext: 'gatewayContext',
  bearer: 'bearerAuth',
} as const;

/**
 * Title, contract version and security schemes for the Ledger API, applied
 * globally. Paths are filled in from the decorators when the UI is mounted.
 */
function baseDocumentConfig(): Omit<OpenAPIObject, 'paths'> {
  return new DocumentBuilder()
    .setTitle('Ledger API')
    .setDescription('Double-entry personal-finance ledger — CQRS + event sourcing.')
    .setVersion('1.0.0')
    .addApiKey({ type: 'apiKey', in: 'header', name: 'x-user-id' }, SWAGGER_SECURITY.gatewayContext)
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, SWAGGER_SECURITY.bearer)
    .addSecurityRequirements(SWAGGER_SECURITY.gatewayContext)
    .build();
}

/** The security shape of the contract, independent of the running app. */
export function buildSwaggerDocument(): OpenAPIObject {
  return baseDocumentConfig() as OpenAPIObject;
}

/** Mounts the Swagger UI at `/docs` only when `showDocs` is true (never in production). */
export function maybeMountSwagger(app: INestApplication, showDocs: boolean): void {
  if (!showDocs) return;

  const document = SwaggerModule.createDocument(app, baseDocumentConfig());
  SwaggerModule.setup(SWAGGER_PATH, app, document);
}
