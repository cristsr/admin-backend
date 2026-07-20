import { buildSwaggerDocument } from './swagger.builder';

describe('Swagger document builder', () => {
  const app: any = { get: () => ({ SHOW_DOCS: true }) };

  it('declares bearerAuth + webhookApiKey security schemes with the shapes from docs/api.yaml', () => {
    const doc = buildSwaggerDocument(app as any);
    expect(doc.components!.securitySchemes).toMatchObject({
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      webhookApiKey: { type: 'apiKey', in: 'header', name: 'x-api-key' },
    });
  });

  it('adds the global security requirement bearerAuth so private endpoints default to JWT', () => {
    const doc = buildSwaggerDocument(app as any);
    expect(doc.security).toEqual([{ bearerAuth: [] }]);
  });
});
