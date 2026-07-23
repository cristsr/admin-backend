import { SWAGGER_SECURITY, buildSwaggerDocument } from './ledger-swagger.builder';

describe('Ledger Swagger document builder', () => {
  it('declares the gatewayContext and bearerAuth security schemes', () => {
    const doc = buildSwaggerDocument();

    expect(doc.components?.securitySchemes).toMatchObject({
      [SWAGGER_SECURITY.gatewayContext]: { type: 'apiKey', in: 'header', name: 'x-user-id' },
      [SWAGGER_SECURITY.bearer]: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    });
  });

  it('defaults every endpoint to the gateway context requirement', () => {
    const doc = buildSwaggerDocument();

    expect(doc.security).toEqual([{ [SWAGGER_SECURITY.gatewayContext]: [] }]);
  });

  it('titles the contract as the Ledger API', () => {
    const doc = buildSwaggerDocument();

    expect(doc.info.title).toBe('Ledger API');
  });
});
