import { Options } from 'pino-http';
import { CORRELATION_HEADER, buildPinoModuleOptions } from './logger.config';

/**
 * `pinoHttp` is typed as options, a destination stream, or both — this config
 * always builds the options form, so the assertions narrow to it once here.
 */
const genReqId = () => {
  const { pinoHttp } = buildPinoModuleOptions();

  return (pinoHttp as Options).genReqId;
};

describe('pino logger config (AC-4)', () => {
  it('uses X-Request-Id from the incoming headers when the edge supplies it', () => {
    const req = { headers: { [CORRELATION_HEADER]: 'abc-123' } } as any;

    expect(genReqId()(req, {} as any)).toBe('abc-123');
  });

  it('generates a fresh id when X-Request-Id is absent (tests, crons, internal calls)', () => {
    const id = genReqId()({ headers: {} } as any, {} as any);

    expect(typeof id).toBe('string');
    expect(String(id).length).toBeGreaterThan(0);
  });

  it('generates distinct ids for two requests without X-Request-Id', () => {
    const a = genReqId()({ headers: {} } as any, {} as any);
    const b = genReqId()({ headers: {} } as any, {} as any);

    expect(a).not.toBe(b);
  });
});
