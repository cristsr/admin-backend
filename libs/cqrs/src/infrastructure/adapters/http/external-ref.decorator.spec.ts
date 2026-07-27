import { ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { EXTERNAL_REF_HEADER, extractExternalRef } from './external-ref.decorator';

describe('extractExternalRef', () => {
  const ctxFor = (request: Partial<Request>): ExecutionContext =>
    ({ switchToHttp: () => ({ getRequest: () => request }) }) as unknown as ExecutionContext;

  it('reads the X-External-Ref header', () => {
    const ctx = ctxFor({ headers: { [EXTERNAL_REF_HEADER]: 'ref-123' }, body: {} });
    expect(extractExternalRef(ctx)).toBe('ref-123');
  });

  it('falls back to external_ref in the body', () => {
    const ctx = ctxFor({ headers: {}, body: { external_ref: 'ref-body' } });
    expect(extractExternalRef(ctx)).toBe('ref-body');
  });

  it('prefers the header over the body', () => {
    const ctx = ctxFor({ headers: { [EXTERNAL_REF_HEADER]: 'ref-header' }, body: { external_ref: 'ref-body' } });
    expect(extractExternalRef(ctx)).toBe('ref-header');
  });

  it('returns null when neither is present', () => {
    const ctx = ctxFor({ headers: {}, body: {} });
    expect(extractExternalRef(ctx)).toBeNull();
  });
});
