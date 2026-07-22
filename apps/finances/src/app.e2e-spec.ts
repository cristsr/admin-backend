import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { buildE2eApp } from './testing/e2e-app';

/**
 * Auth happy path against a real lab Keycloak. Requires
 * `docker compose up -d keycloak postgres` and the Keycloak env vars below.
 */
describe('Auth happy path e2e', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await buildE2eApp();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects a request without a valid JWT on a private endpoint', async () => {
    await request(app.getHttpServer()).get('/accounts').expect(401);
  });

  it('accepts a valid Keycloak JWT on a private endpoint', async () => {
    const token = await acquireKeycloakToken();

    await request(app.getHttpServer())
      .get('/accounts')
      .set('Authorization', `Bearer ${token}`)
      .expect((res) => {
        // A valid JWT must never 401; the downstream user lookup may still 403.
        expect([200, 403]).toContain(res.status);
      });
  });
});

async function acquireKeycloakToken(): Promise<string> {
  const tokenEndpoint =
    process.env.KEYCLOAK_TOKEN_URL ?? 'http://localhost:8080/realms/finances/protocol/openid-connect/token';

  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: process.env.KEYCLOAK_CLIENT_ID ?? 'finances-test',
    username: process.env.KEYCLOAK_USER ?? 'test-user',
    password: process.env.KEYCLOAK_PASSWORD ?? 'test-pass',
  }).toString();

  const res = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    throw new Error(`Keycloak token fetch failed: ${res.status} ${await res.text()}`);
  }

  return ((await res.json()) as { access_token: string }).access_token;
}
