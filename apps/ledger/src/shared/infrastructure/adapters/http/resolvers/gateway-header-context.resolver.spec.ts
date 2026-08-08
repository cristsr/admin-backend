import { RequestHeaders } from '@ledger/shared/application/ports/ledger-context-resolver.port';
import { GATEWAY_CONTEXT_HEADER, GatewayHeaderContextResolver } from './gateway-header-context.resolver';

describe('GatewayHeaderContextResolver', () => {
  const resolver = new GatewayHeaderContextResolver();

  const headers = (overrides: RequestHeaders = {}): RequestHeaders => ({
    [GATEWAY_CONTEXT_HEADER.userId]: 'user-1',
    [GATEWAY_CONTEXT_HEADER.clientId]: 'frontend',
    ...overrides,
  });

  it('resolves a context when both trusted headers are present', () => {
    expect(resolver.resolve(headers())).toEqual({ userId: 'user-1', clientId: 'frontend' });
  });

  it('returns null when the user header is missing', () => {
    expect(resolver.resolve(headers({ [GATEWAY_CONTEXT_HEADER.userId]: undefined }))).toBeNull();
  });

  it('returns null when the client header is missing', () => {
    expect(resolver.resolve(headers({ [GATEWAY_CONTEXT_HEADER.clientId]: undefined }))).toBeNull();
  });

  it('rejects a duplicated (array) header as untrusted', () => {
    expect(resolver.resolve(headers({ [GATEWAY_CONTEXT_HEADER.userId]: ['a', 'b'] }))).toBeNull();
  });

  it('rejects a blank header value', () => {
    expect(resolver.resolve(headers({ [GATEWAY_CONTEXT_HEADER.clientId]: '   ' }))).toBeNull();
  });
});
