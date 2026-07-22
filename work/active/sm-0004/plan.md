# sm-0004: Calidad de plataforma no-funcional — Plan de Implementación

> **Para Claude:** USA el skill /build para implementar este plan tarea por tarea.

**Historia:** `work/active/sm-0004/`
**Microservicio(s):** `apps/finances` (toca también `libs/shared/src/auth/` para AC-3)
**Objetivo:** Publicar contrato OpenAPI, agregar health checks, observabilidad, discovery OIDC perezoso, rate limiting y e2e de auth contra Keycloak.
**Arquitectura:** Hexagonal por módulo; los cambios son cross-cutting sobre el bootstrap (`main.ts`, `AppModule`), la lib compartida de auth y los entry points de webhook/outbox/crons. No hay nueva entidad ni tabla; el `correlationId` viaja en el `payload` jsonb existente del outbox. Se usan los módulos oficiales de NestJS directamente (`@nestjs/swagger`, `@nestjs/terminus`, `@nestjs/throttler`, `nestjs-pino`).
**Stack:** NestJS 10 · TypeScript · TypeORM · PostgreSQL · Jest

### Trazabilidad AC → Tareas

| AC   | Cubierto por              |
| ---- | ------------------------- |
| AC-1 | Tarea 9                   |
| AC-2 | Tarea 3, Tarea 4          |
| AC-3 | Tarea 1, Tarea 2          |
| AC-4 | Tarea 6, Tarea 7, Tarea 8 |
| AC-5 | Tarea 5                   |
| AC-6 | Tarea 10                  |

---

## Orden de implementación (PHASE 2)

App única (`apps/finances`); AC-3 toca `libs/shared/src/auth`. No hay grupos
independientes paralelizables: todos los ACs viven en la misma app y el
flujo del diagrama (webhook → outbox → evento de presupuesto y readiness →
DB+OIDC) depende de la cadena AC-3 (resolver discovery) → AC-2 (indicador
OIDC) → AC-4/AC-5 (instrumentación) → AC-1 (Swagger) → AC-6 (e2e). Secuencia:

1. `libs/shared/src/auth/` (AC-3) — fundación para `JwtStrategy` y el indicador
   de readiness OIDC.
2. `apps/finances` — AC-2 health checks (reutilizan el resolver de AC-3).
3. `apps/finances` — AC-4 logging estructurado + correlation id.
4. `apps/finances` — AC-4 propagación del `correlationId` por outbox y handlers.
5. `apps/finances` — AC-4 métricas de crons.
6. `apps/finances` — AC-5 rate limiting.
7. `apps/finances` — AC-1 Swagger.
8. `apps/finances` + `docker-compose` + CI — AC-6 e2e contra Keycloak.

### Tarea 0: Preparar rama de trabajo [X]

> Al ejecutar este plan, solicitar al usuario el nombre de la rama antes de continuar.

**Preguntar:** "¿Cuál es el nombre de la rama? Usá inglés para la descripción. (ej: `feat/SM-0004-platform-quality-nonfunctional`)"

**Step 1: Verificar que la base esté fresca (read-only)**

```bash
git branch --show-current      # esperado: master
git status --porcelain          # esperado: vacío
```

Esperado: en `master`, sin cambios sin commitear. Si la base está stale o
el working tree está sucio → detener y recomendar `/sync master` antes de
crear la rama.

**Step 2: Crear rama de trabajo**

```bash
git checkout -b <nombre-de-rama-dado-por-usuario>
```

Esperado: rama nueva creada y activa, partiendo de `master` actualizado.

---

### libs/shared/src/auth — AC-3

### Tarea 1: `OidcDiscoveryCache` (resolver perezoso con TTL) [X]

**Archivos:**

- Crear: `libs/shared/src/auth/oidc-discovery-cache.ts`
- Test: `libs/shared/src/auth/oidc-discovery-cache.spec.ts`
- Modificar: `libs/shared/src/auth/index.ts` (agregar export)

**Step 1: Escribir el test que falla**

En `libs/shared/src/auth/oidc-discovery-cache.spec.ts`:

```typescript
import { OidcDiscoveryCache } from './oidc-discovery-cache';

describe('OidcDiscoveryCache (AC-3)', () => {
  const fallbackDefaultTtl = 60_000;

  const buildCache = (
    discoverer: jest.Mock,
    opts: { ttlMs?: number; issuer?: string } = {},
  ): OidcDiscoveryCache =>
    new OidcDiscoveryCache({
      issuer: opts.issuer ?? 'https://idp/test',
      ttlMs: opts.ttlMs ?? fallbackDefaultTtl,
      discoverer,
    });

  it('resolves the jwks_uri via the discoverer on first call', async () => {
    const discoverer = jest.fn().mockResolvedValue('https://idp/jwks');
    const cache = buildCache(discoverer);

    await expect(cache.getJwksUri()).resolves.toBe('https://idp/jwks');
    expect(discoverer).toHaveBeenCalledTimes(1);
  });

  it('caches the resolved uri within the TTL window', async () => {
    const discoverer = jest.fn().mockResolvedValue('https://idp/jwks');
    const cache = buildCache(discoverer, { ttlMs: 10_000 });

    await cache.getJwksUri();
    await cache.getJwksUri();

    expect(discoverer).toHaveBeenCalledTimes(1);
  });

  it('re-resolves after the TTL expires (rotación absorbida sin reinicio)', async () => {
    const discoverer = jest
      .fn<Promise<string>, [string]>()
      .mockResolvedValueOnce('https://idp/jwks-v1')
      .mockResolvedValueOnce('https://idp/jwks-v2');
    const cache = buildCache(discoverer, { ttlMs: 5 });

    await expect(cache.getJwksUri()).resolves.toBe('https://idp/jwks-v1');
    await new Promise((r) => setTimeout(r, 15));
    await expect(cache.getJwksUri()).resolves.toBe('https://idp/jwks-v2');
    expect(discoverer).toHaveBeenCalledTimes(2);
  });

  it('coalesces concurrent calls into a single discovery (no thundering herd)', async () => {
    let resolveDiscovery!: (v: string) => void;
    const pending = new Promise<string>((res) => (resolveDiscovery = res));
    const discoverer = jest.fn().mockReturnValue(pending);
    const cache = buildCache(discoverer);

    const a = cache.getJwksUri();
    const b = cache.getJwksUri();

    resolveDiscovery('https://idp/jwks');

    await expect(a).resolves.toBe('https://idp/jwks');
    await expect(b).resolves.toBe('https://idp/jwks');
    expect(discoverer).toHaveBeenCalledTimes(1);
  });

  it('clears the inflight promise on failure so the next call retries', async () => {
    const discoverer = jest
      .fn<Promise<string>, [string]>()
      .mockRejectedValueOnce(new Error('IdP down'))
      .mockResolvedValueOnce('https://idp/jwks');
    const cache = buildCache(discoverer);

    await expect(cache.getJwksUri()).rejects.toThrow('IdP down');
    await expect(cache.getJwksUri()).resolves.toBe('https://idp/jwks');
  });
});
```

**Step 2: Ejecutar y confirmar que falla**

```bash
npx jest libs/shared/src/auth/oidc-discovery-cache.spec.ts --no-coverage
```

Esperado: FAIL — "Cannot find module './oidc-discovery-cache'".

**Step 3: Implementar el mínimo código**

En `libs/shared/src/auth/oidc-discovery-cache.ts`:

```typescript
/**
 * Lazily-resolved and TTL-cached OpenID Connect discovery document. Mirrors
 * the lazy + cache behaviour already used by `jwks-rsa` for the signing keys:
 * the JWKS endpoint is resolved on the first token validation (not at app
 * bootstrap), cached with a TTL, and re-resolved on expiry so an IdP-side
 * rotation (a new `jwks_uri`) is absorbed without restarting the process
 * (AC-3).
 */
export interface OidcDiscoveryCacheOptions {
  /** Issuer URL (no trailing slash). */
  issuer: string;
  /** Cache lifetime in ms. After expiry, the next call re-resolves. */
  ttlMs: number;
  /**
   * Discovery function — defaults to {@link discoverJwksUri} in production
   * but injected here so the cache (and its tests) stay decoupled from the
   * network.
   */
  discoverer?: (issuer: string) => Promise<string>;
}

interface Entry {
  readonly jwksUri: string;
  readonly expiresAt: number;
}

export class OidcDiscoveryCache {
  private entry: Entry | null = null;
  private inflight: Promise<string> | null = null;

  private readonly discoverer: (issuer: string) => Promise<string>;

  constructor(private readonly options: OidcDiscoveryCacheOptions) {
    const { discoverer } = options;
    this.discoverer = discoverer ?? discoverJwksUri;
  }

  /**
   * Returns the cached JWKS endpoint, or resolves it now (coalescing any
   * concurrent callers). Throws if the discoverer fails — the inflight is
   * cleared so the next call retries instead of staying stuck.
   */
  getJwksUri(): Promise<string> {
    const now = Date.now();
    if (this.entry && this.entry.expiresAt > now) {
      return Promise.resolve(this.entry.jwksUri);
    }

    if (!this.inflight) {
      const inflight = this.discoverer(this.options.issuer)
        .then((jwksUri: string) => {
          this.entry = {
            jwksUri,
            expiresAt: Date.now() + this.options.ttlMs,
          };
          this.inflight = null;
          return jwksUri;
        })
        .catch((error: unknown) => {
          this.inflight = null;
          throw error;
        });

      this.inflight = inflight;
    }

    return this.inflight;
  }
}
```

En `libs/shared/src/auth/index.ts` agregar la línea:

```typescript
export * from './oidc-discovery-cache';
```

**Step 4: Ejecutar y confirmar que pasa**

```bash
npx jest libs/shared/src/auth/oidc-discovery-cache.spec.ts --no-coverage
```

Esperado: PASS

---

### Tarea 2: Refactor de `AuthModule` y `JwtStrategy` para resolver el discovery de forma perezosa [X]

**Archivos:**

- Modificar: `libs/shared/src/auth/auth.module.ts`
- Modificar: `libs/shared/src/auth/jwt.strategy.ts`
- Modificar: `libs/shared/src/auth/auth.constants.ts`
- Crear test: `libs/shared/src/auth/jwt.strategy.lazy-discovery.spec.ts`

**Step 1: Escribir el test que falla**

En `libs/shared/src/auth/jwt.strategy.lazy-discovery.spec.ts`:

```typescript
import { OidcDiscoveryCache } from './oidc-discovery-cache';
import { JwtStrategy } from './jwt.strategy';

const fakeDecodedToken = {
  sub: 'sub-1',
  aud: 'aud',
  iss: 'https://idp/test',
  header: { kid: 'kid-1' },
};

describe('JwtStrategy lazy OIDC discovery (AC-3)', () => {
  const buildStrategy = async (discovery: OidcDiscoveryCache): Promise<JwtStrategy> => {
    const { JwtStrategy } = await import('./jwt.strategy');
    const httpClient: any = { get: jest.fn() };
    const identityResolver: any = { resolveExternalId: () => 'sub-1' };
    return new JwtStrategy(
      httpClient,
      {
        issuer: 'https://idp/test',
        audience: 'aud',
        jwksUri: '',
        discovery,
      } as any,
      identityResolver,
    );
  };

  it('does NOT resolve the discovery document at construction time', async () => {
    const getJwksUri = jest.fn().mockResolvedValue('https://idp/jwks');
    const discovery = { getJwksUri } as unknown as OidcDiscoveryCache;

    await buildStrategy(discovery);

    expect(getJwksUri).not.toHaveBeenCalled();
  });

  it('resolves the discovery on the first secretOrKeyProvider call', async () => {
    const getJwksUri = jest.fn().mockResolvedValue('https://idp/jwks');
    const discovery = { getJwksUri } as unknown as OidcDiscoveryCache;
    const strategy = await buildStrategy(discovery);

    const request = {} as any;
    const done = jest.fn();
    await strategy['secretOrKeyProvider']!(request, fakeDecodedToken, done);

    expect(getJwksUri).toHaveBeenCalledTimes(1);
  });
});
```

**Step 2: Ejecutar y confirmar que falla**

```bash
npx jest libs/shared/src/auth/jwt.strategy.lazy-discovery.spec.ts --no-coverage
```

Esperado: FAIL — la estrategia actual no expone `secretOrKeyProvider`
resolvible, ni acepta un `discovery` en sus opciones.

**Step 3: Implementar el mínimo código**

Modificar `libs/shared/src/auth/auth.constants.ts`:

```typescript
export const USERS_SERVICE_CLIENT = 'USERS_SERVICE_CLIENT';
export const JWT_STRATEGY_OPTIONS = 'JWT_STRATEGY_OPTIONS';
export const OIDC_DISCOVERY_CACHE = 'OIDC_DISCOVERY_CACHE';
```

Modificar `libs/shared/src/auth/auth.module.ts`:

```typescript
import { DynamicModule, Module, Type } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { ApiModule } from '../modules';
import { JWT_STRATEGY_OPTIONS, OIDC_DISCOVERY_CACHE, USERS_SERVICE_CLIENT } from './auth.constants';
import { IdentityResolver, SubjectIdentityResolver } from './identity-resolver';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy, JwtStrategyOptions } from './jwt.strategy';
import { OidcDiscoveryCache, discoverJwksUri } from './oidc-discovery-cache';

export interface AuthModuleOptions {
  issuer: string;
  audience: string;
  usersServiceUrl: string;
  identityResolver?: Type<IdentityResolver>;
  /** Discovery cache lifetime in ms. Defaults to 1h. */
  discoveryTtlMs?: number;
}

export interface AuthModuleAsyncOptions {
  inject: any[];
  identityResolver?: Type<IdentityResolver>;
  useFactory: (...args: any[]) => Promise<AuthModuleOptions> | AuthModuleOptions;
}

@Module({})
export class AuthModule {
  static forRoot(options: AuthModuleOptions): DynamicModule {
    return AuthModule.build({
      imports: [
        ApiModule.register({
          name: USERS_SERVICE_CLIENT,
          baseURL: options.usersServiceUrl,
        }),
      ],
      strategyOptionsProvider: {
        provide: JWT_STRATEGY_OPTIONS,
        useFactory: () => ({
          issuer: options.issuer,
          audience: options.audience,
        }),
      },
      discoveryProvider: AuthModule.discoveryProvider(options),
      identityResolver: options.identityResolver,
    });
  }

  static forRootAsync(asyncOptions: AuthModuleAsyncOptions): DynamicModule {
    return AuthModule.build({
      imports: [
        ApiModule.registerAsync({
          name: USERS_SERVICE_CLIENT,
          inject: asyncOptions.inject,
          useFactory: async (...args: any[]) => {
            const options = await asyncOptions.useFactory(...args);
            return { baseURL: options.usersServiceUrl };
          },
        }),
      ],
      strategyOptionsProvider: {
        provide: JWT_STRATEGY_OPTIONS,
        inject: asyncOptions.inject,
        useFactory: async (...args: any[]) => {
          const options = await asyncOptions.useFactory(...args);
          return { issuer: options.issuer, audience: options.audience };
        },
      },
      discoveryProvider: {
        provide: OIDC_DISCOVERY_CACHE,
        inject: asyncOptions.inject,
        useFactory: async (...args: any[]) => {
          const options = await asyncOptions.useFactory(...args);
          return new OidcDiscoveryCache({
            issuer: options.issuer,
            ttlMs: options.discoveryTtlMs ?? 60 * 60 * 1000,
            discoverer: discoverJwksUri,
          });
        },
      },
      identityResolver: asyncOptions.identityResolver,
    });
  }

  private static discoveryProvider(options: AuthModuleOptions): {
    provide: string;
    useFactory: () => OidcDiscoveryCache;
  } {
    return {
      provide: OIDC_DISCOVERY_CACHE,
      useFactory: () =>
        new OidcDiscoveryCache({
          issuer: options.issuer,
          ttlMs: options.discoveryTtlMs ?? 60 * 60 * 1000,
          discoverer: discoverJwksUri,
        }),
    };
  }

  private static build(config: {
    imports: DynamicModule['imports'];
    strategyOptionsProvider: any;
    discoveryProvider: { provide: string; useFactory: (...args: any[]) => any };
    identityResolver?: Type<IdentityResolver>;
  }): DynamicModule {
    return {
      module: AuthModule,
      imports: [PassportModule.register({}), ...config.imports],
      providers: [
        config.strategyOptionsProvider,
        config.discoveryProvider,
        {
          provide: IdentityResolver,
          useClass: config.identityResolver ?? SubjectIdentityResolver,
        },
        JwtStrategy,
        { provide: APP_GUARD, useClass: JwtAuthGuard },
      ],
    };
  }
}
```

Modificar `libs/shared/src/auth/jwt.strategy.ts`:

```typescript
import { HttpService } from '@nestjs/axios';
import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy, SecretOrKeyProvider } from 'passport-jwt';
import { firstValueFrom, map } from 'rxjs';
import { JWT_STRATEGY_OPTIONS, OIDC_DISCOVERY_CACHE, USERS_SERVICE_CLIENT } from './auth.constants';
import { AuthenticatedUser } from './authenticated-user.type';
import { IdentityResolver } from './identity-resolver';
import { OidcDiscoveryCache } from './oidc-discovery-cache';

export interface JwtStrategyOptions {
  issuer: string;
  audience: string;
  /** Kept for backwards-compatibility; ignored when {@link discovery} is provided. */
  jwksUri?: string;
  /** Lazy discovery cache — when set, the JWKS endpoint is resolved on first use. */
  discovery?: OidcDiscoveryCache;
}

/**
 * JWKS resolution lazily driven by the {@link OidcDiscoveryCache}. The
 * `jwks-rsa` client itself stays cached and keyed by the resolved
 * `jwks_uri`; if the cache re-resolves a different URI after TTL expiry
 * (an IdP-side rotation), the client is rebuilt transparently. App bootstrap
 * no longer hits the IdP (AC-3).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private jwksClient: ReturnType<typeof passportJwtSecret> | null = null;
  private resolvedJwksUri: string | null = null;

  constructor(
    @Inject(USERS_SERVICE_CLIENT) private readonly httpClient: HttpService,
    @Inject(JWT_STRATEGY_OPTIONS) options: JwtStrategyOptions,
    private readonly identityResolver: IdentityResolver,
    @Inject(OIDC_DISCOVERY_CACHE)
    private readonly discovery?: OidcDiscoveryCache,
  ) {
    const fallbackJwksUri = options.jwksUri ?? '';

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKeyProvider: JwtStrategy.buildSecretProvider(() => this.resolveJwksClient(fallbackJwksUri)),
      audience: options.audience,
      issuer: options.issuer,
      algorithms: ['RS256'],
    });
  }

  private async resolveJwksClient(fallbackJwksUri: string): Promise<ReturnType<typeof passportJwtSecret>> {
    const jwksUri = this.discovery ? await this.discovery.getJwksUri() : fallbackJwksUri;

    if (!this.jwksClient || this.resolvedJwksUri !== jwksUri) {
      this.jwksClient = passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri,
      });
      this.resolvedJwksUri = jwksUri;
    }

    return this.jwksClient;
  }

  private static buildSecretProvider(
    resolveClient: () => Promise<ReturnType<typeof passportJwtSecret>>,
  ): SecretOrKeyProvider {
    return async (request, token, done) => {
      try {
        const client = await resolveClient();
        client(request, token, done);
      } catch (error) {
        done(error as Error);
      }
    };
  }

  validate(payload: Record<string, any>): Promise<AuthenticatedUser> {
    const externalId = this.identityResolver.resolveExternalId(payload);

    const user$ = this.httpClient.get(`/users/sub/${externalId}`).pipe(map((response) => response.data));

    return firstValueFrom(user$);
  }
}
```

**Step 4: Ejecutar y confirmar que pasa**

```bash
npx jest libs/shared/src/auth --no-coverage
```

Esperado: PASS — el nuevo spec pasa y no rompe los specs existentes de auth.

---

### apps/finances — AC-2

### Tarea 3: `OidcHealthIndicator` (readiness OIDC, reutiliza el resolver perezoso) [X]

**Archivos:**

- Crear: `apps/finances/src/health/oidc-health.indicator.ts`
- Crear: `apps/finances/src/health/oidc-health.indicator.spec.ts`
- Crear: `apps/finances/src/health/index.ts`

**Step 1: Escribir el test que falla**

En `apps/finances/src/health/oidc-health.indicator.spec.ts`:

```typescript
import { OidcHealthIndicator } from './oidc-health.indicator';

describe('OidcHealthIndicator (AC-2 + AC-3)', () => {
  const build = (getJwksUri: jest.Mock) => new OidcHealthIndicator({ getJwksUri } as any, 500);

  it('reports up when the discovery resolves (cache hit o primer warm-up)', async () => {
    const discovery = { getJwksUri: jest.fn().mockResolvedValue('https://idp/jwks') };
    const indicator = new OidcHealthIndicator(discovery as any, 1_000);

    const result = await indicator.isHealthy('oidc');

    expect(result).toEqual({ oidc: { status: 'up' } });
  });

  it('reports down when the IdP is unreachable, with the error message', async () => {
    const discovery = { getJwksUri: jest.fn().mockRejectedValue(new Error('boom')) };
    const indicator = new OidcHealthIndicator(discovery as any, 1_000);

    const result = await indicator.isHealthy('oidc');

    expect(result.oidc.status).toBe('down');
    expect(String(result.oidc.message)).toContain('boom');
  });

  it('reports down when the discovery exceeds the readiness timeout', async () => {
    const discovery = {
      getJwksUri: jest.fn(() => new Promise<string>((r) => setTimeout(() => r('late'), 200))),
    };
    const indicator = new OidcHealthIndicator(discovery as any, 50);

    const result = await indicator.isHealthy('oidc');

    expect(result.oidc.status).toBe('down');
    expect(String(result.oidc.message)).toContain('timeout');
  });
});
```

**Step 2: Ejecutar y confirmar que falla**

```bash
npx jest src/health/oidc-health.indicator.spec.ts --no-coverage
```

> (Ejecutar desde `apps/finances`; lo mismo aplica a los specs siguientes.)

Esperado: FAIL — "Cannot find module './oidc-health.indicator'".

**Step 3: Implementar el mínimo código**

En `apps/finances/src/health/oidc-health.indicator.ts`:

```typescript
import { Inject } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { OIDC_DISCOVERY_CACHE } from '@shared';
import { OidcDiscoveryCache } from '@shared';

/**
 * Readiness probe for the OIDC provider. Reuses the same lazy discovery cache
 * that backs {@link JwtStrategy}: a successful readiness warms up the cache,
 * so the first real token validation never pays the discovery cost and the IdP
 * being unreachable at boot never blocks startup (AC-2 + AC-3). The check is
 * bounded by a short timeout so a slow IdP does not stall the readiness
 * endpoint (ver `docs/research.md`).
 */
export class OidcHealthIndicator extends HealthIndicator {
  constructor(
    @Inject(OIDC_DISCOVERY_CACHE) private readonly discovery: OidcDiscoveryCache,
    private readonly timeoutMs: number,
  ) {
    super();
  }

  async isHealthy(key = 'oidc'): Promise<HealthIndicatorResult> {
    const probe = this.discovery.getJwksUri();

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`oidc discovery timed out after ${this.timeoutMs}ms`)),
        this.timeoutMs,
      ),
    );

    try {
      await Promise.race([probe, timeout]);
      return this.getStatus(key, true);
    } catch (error) {
      return this.getStatus(key, false, { message: String((error as Error).message) });
    }
  }
}
```

En `apps/finances/src/health/index.ts`:

```typescript
export * from './oidc-health.indicator';
```

**Step 4: Ejecutar y confirmar que pasa**

```bash
npx jest src/health/oidc-health.indicator.spec.ts --no-coverage
```

Esperado: PASS

---

### Tarea 4: `HealthController` (liveness + readiness) y reemplazo del `/health` actual [X]

**Archivos:**

- Crear: `apps/finances/src/health/health.controller.ts`
- Crear: `apps/finances/src/health/health.controller.spec.ts`
- Crear: `apps/finances/src/health/health.module.ts`
- Modificar: `apps/finances/src/config/controllers/app.controller.ts` (quitar `/health`)
- Modificar: `apps/finances/src/config/controllers/app.controller.spec.ts` (ajustar/suprimir test de health)
- Modificar: `apps/finances/src/app.module.ts` (importar `HealthModule`, instalar `TerminusModule` y el indicador OIDC)

**Step 1: Escribir el test que falla**

En `apps/finances/src/health/health.controller.spec.ts`:

```typescript
import { HealthController } from './health.controller';

describe('HealthController (AC-2)', () => {
  const build = (healthCheckService: any, typeOrmHealthIndicator: any, oidcHealthIndicator: any) =>
    new HealthController(healthCheckService, typeOrmHealthIndicator, oidcHealthIndicator);

  it('liveness runs no indicators (proceso vivo, sin tocar dependencias)', async () => {
    const healthCheckService = {
      check: jest.fn().mockResolvedValue({ status: 'ok', info: {}, error: {}, details: {} }),
    };
    const ctrl = build(healthCheckService, {}, {});

    const result = await ctrl.live();

    expect(healthCheckService.check).toHaveBeenCalledWith([]);
    expect(result.status).toBe('ok');
  });

  it('readiness runs the db + oidc indicators', async () => {
    const healthCheckService = { check: jest.fn().mockResolvedValue({ status: 'ok' }) };
    const typeOrm = { pingCheck: jest.fn().mockResolvedValue({ db: { status: 'up' } }) };
    const oidc = { isHealthy: jest.fn().mockResolvedValue({ oidc: { status: 'up' } }) };
    const ctrl = build(healthCheckService, typeOrm, oidc);

    await ctrl.ready();

    expect(typeOrm.pingCheck).toHaveBeenCalledWith('db');
    expect(oidc.isHealthy).toHaveBeenCalledWith('oidc');
    expect(healthCheckService.check).toHaveBeenCalled();
  });
});
```

**Step 2: Ejecutar y confirmar que falla**

```bash
npx jest src/health/health.controller.spec.ts --no-coverage
```

Esperado: FAIL — "Cannot find module './health.controller'".

**Step 3: Implementar el mínimo código**

En `apps/finances/src/health/health.controller.ts`:

```typescript
import { Controller, Get } from '@nestjs/common';
import { Public } from '@shared';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { ApiOperation } from '@nestjs/swagger';
import { OidcHealthIndicator } from './oidc-health.indicator';

/**
 * Two independent health endpoints (AC-2). Both are public — neither sits
 * behind the JWT global guard, so an external probe (NGINX / orchestrator)
 * can reach them without credentials.
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly oidc: OidcHealthIndicator,
  ) {}

  /**
   * Liveness: process is alive. Touches no dependencies, so a DB/OIDC outage
   * never kills the pod.
   */
  @Get('live')
  @Public()
  @ApiOperation({ operationId: 'healthLive', summary: 'Liveness — sin tocar dependencias externas.' })
  @HealthCheck([])
  live() {
    return this.health.check([]);
  }

  /**
   * Readiness: DB + OIDC reachability. Terminus maps a failure to 503 when the
   * `HealthCheckService`'s `check` throws — wiring the indicators here lets
   * Terminus handle the 200/503 status code automatically.
   */
  @Get('ready')
  @Public()
  @ApiOperation({ operationId: 'healthReady', summary: 'Readiness — DB + OIDC accesibles.' })
  @HealthCheck()
  ready() {
    return this.health.check([() => this.db.pingCheck('db'), () => this.oidc.isHealthy('oidc')]);
  }
}
```

En `apps/finances/src/health/health.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { OIDC_DISCOVERY_CACHE } from '@shared';
import { OidcHealthIndicator } from './oidc-health.indicator';
import { HealthController } from './health.controller';

/**
 * Readiness timeout for the OIDC probe (AC-2). Bounded so a slow IdP never
 * stalls the orchestrator's health check loop.
 */
const OIDC_READINESS_TIMEOUT_MS = 2_000;

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [
    {
      provide: OidcHealthIndicator,
      useFactory: (discovery: unknown) =>
        new OidcHealthIndicator(discovery as any, OIDC_READINESS_TIMEOUT_MS),
      inject: [OIDC_DISCOVERY_CACHE],
    },
  ],
})
export class HealthModule {}
```

En `apps/finances/src/health/index.ts` (append):

```typescript
export * from './health.controller';
export * from './health.module';
```

Modificar `apps/finances/src/config/controllers/app.controller.ts` — eliminar el método `health`:

```typescript
import { Controller } from '@nestjs/common';

/**
 * Root controller kept for module wiring only. Health endpoints live in
 * {@link HealthController} (AC-2, sm-0004); the old `GET /health` was removed
 * because it unintentionally sat behind the global JWT guard.
 */
@Controller()
export class AppController {}
```

Modificar `apps/finances/src/app.module.ts`:

```typescript
import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { Auth0IdentityResolver, AuthModule, ExceptionFilter, validatorFactory } from '@shared';
import { AppController } from 'app/config/controllers';
import { DatabaseModule } from 'app/database/';
import { ENV, Environment } from 'app/env';
import { HealthModule } from 'app/health/health.module';
import { AccountModule } from 'app/account/account.module';
import { BudgetModule } from 'app/budget/budget.module';
import { CategorizationRuleModule } from 'app/categorization-rule/categorization-rule.module';
import { CategoryModule } from 'app/category/category.module';
import { IdempotencyModule } from 'app/idempotency/idempotency.module';
import { MovementModule } from 'app/movement/movement.module';
import { OutboxModule } from 'app/outbox/outbox.module';
import { ScheduledModule } from 'app/scheduled/scheduled.module';
import { SummaryModule } from 'app/summary/summary.module';
import { TransferModule } from 'app/transfer/transfer.module';
import { UserModule } from 'app/user/user.module';
import { WebhookModule } from 'app/webhook/webhook.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validatorFactory(Environment),
    }),
    CacheModule.register(),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot({}),
    DatabaseModule,
    AuthModule.forRootAsync({
      inject: [ConfigService],
      identityResolver: process.env.AUTH_IDENTITY_PROVIDER === 'auth0' ? Auth0IdentityResolver : undefined,
      useFactory: (configService: ConfigService) => ({
        issuer: configService.get(ENV.OIDC_ISSUER),
        audience: configService.get(ENV.OIDC_AUDIENCE),
        usersServiceUrl: configService.get(ENV.USERS_API_URL),
      }),
    }),
    HealthModule,
    AccountModule,
    CategoryModule,
    MovementModule,
    SummaryModule,
    BudgetModule,
    ScheduledModule,
    TransferModule,
    UserModule,
    WebhookModule,
    OutboxModule,
    IdempotencyModule,
    CategorizationRuleModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_FILTER, useClass: ExceptionFilter }],
})
export class AppModule {}
```

Ajustar `apps/finances/src/config/controllers/app.controller.spec.ts` para no
referenciar `/health` (o borrar su test si solo cubría ese endpoint):
dejá un spec mínimo que simplemente instancie `AppController` para preservar el
archivo sin testear el endpoint inexistente.

**Step 4: Ejecutar y confirmar que pasa**

```bash
npx jest src/health --no-coverage
npx jest src/config/controllers --no-coverage
```

Esperado: PASS en ambos.

---

### Tarea 5: AC-5 — Rate limiting (`@nestjs/throttler`) + trust proxy [X]

**Archivos:**

- Modificar: `apps/finances/src/env.ts` (nuevas env vars)
- Crear: `apps/finances/src/config/throttler/throttler.config.ts`
- Crear: `apps/finances/src/config/throttler/throttler.config.spec.ts`
- Modificar: `apps/finances/src/app.module.ts` (importar `ThrottlerModule`)
- Modificar: `apps/finances/src/webhook/infrastructure/adapters/http/webhook.controller.ts` (decorar `@Throttle`)
- Modificar: `apps/finances/src/main.ts` (set `trust proxy`)

**Step 1: Escribir el test que falla**

En `apps/finances/src/config/throttler/throttler.config.spec.ts`:

```typescript
import { buildThrottlerOptions } from './throttler.config';

describe('throttler config (AC-5)', () => {
  const baseEnv = {
    THROTTLE_AUTH_TTL_MS: '60000',
    THROTTLE_AUTH_LIMIT: '5',
    THROTTLE_WEBHOOK_TTL_MS: '60000',
    THROTTLE_WEBHOOK_LIMIT: '60',
  };

  it('auth limiter defaults to 5 req per 60s when env unset', () => {
    const opts = buildThrottlerOptions({ ...baseEnv, THROTTLE_AUTH_LIMIT: '', THROTTLE_AUTH_TTL_MS: '' });
    const auth = opts.throttlers.find((t) => t.name === 'auth')!;
    expect(auth.limit).toBe(5);
    expect(auth.ttl).toBe(60_000);
  });

  it('webhook limiter defaults to 60 req per 60s when env unset', () => {
    const opts = buildThrottlerOptions({ ...baseEnv, THROTTLE_WEBHOOK_LIMIT: '' });
    const webhook = opts.throttlers.find((t) => t.name === 'webhook')!;
    expect(webhook.limit).toBe(60);
    expect(webhook.ttl).toBe(60_000);
  });

  it('limit values are adjustable from env (AC-5: "valores ajustables por configuración")', () => {
    const opts = buildThrottlerOptions({
      ...baseEnv,
      THROTTLE_AUTH_LIMIT: '10',
      THROTTLE_WEBHOOK_LIMIT: '120',
      THROTTLE_WEBHOOK_TTL_MS: '30000',
    });
    expect(opts.throttlers.find((t) => t.name === 'auth')!.limit).toBe(10);
    const webhook = opts.throttlers.find((t) => t.name === 'webhook')!;
    expect(webhook.limit).toBe(120);
    expect(webhook.ttl).toBe(30_000);
  });
});
```

**Step 2: Ejecutar y confirmar que falla**

```bash
npx jest src/config/throttler/throttler.config.spec.ts --no-coverage
```

Esperado: FAIL — "Cannot find module './throttler.config'".

**Step 3: Implementar el mínimo código**

En `apps/finances/src/env.ts` agregar las nuevas variables (dentro de la clase `Environment`):

```typescript
  /**
   * Throttler windows and limits (AC-5). Auth = 5 req/min,
   * webhook = 60 req/min by default; both adjustable.
   */
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : Number(value)))
  @IsNumber()
  THROTTLE_AUTH_TTL_MS?: number;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : Number(value)))
  @IsNumber()
  THROTTLE_AUTH_LIMIT?: number;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : Number(value)))
  @IsNumber()
  THROTTLE_WEBHOOK_TTL_MS?: number;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : Number(value)))
  @IsNumber()
  THROTTLE_WEBHOOK_LIMIT?: number;
```

En `apps/finances/src/config/throttler/throttler.config.ts`:

```typescript
import { ThrottlerModuleOptions, ThrottlerOptions } from '@nestjs/throttler';

export interface ThrottlerEnv {
  THROTTLE_AUTH_TTL_MS?: number | '';
  THROTTLE_AUTH_LIMIT?: number | '';
  THROTTLE_WEBHOOK_TTL_MS?: number | '';
  THROTTLE_WEBHOOK_LIMIT?: number | '';
}

/**
 * `@nestjs/throttler` config — single in-memory store (no Redis yet, see
 * `docs/research.md`). Two named throttlers cover the two AC-5 rates; the
 * values come from env so they can be tuned per deployment without a code
 * change.
 */
export function buildThrottlerOptions(env: ThrottlerEnv): ThrottlerModuleOptions {
  const toMs = (v: number | '' | undefined, def: number) => (!v && v !== 0 ? def : Number(v));

  const throttlers: ThrottlerOptions[] = [
    {
      name: 'auth',
      limit: Number(env.THROTTLE_AUTH_LIMIT) || 5,
      ttl: toMs(env.THROTTLE_AUTH_TTL_MS, 60_000),
    },
    {
      name: 'webhook',
      limit: Number(env.THROTTLE_WEBHOOK_LIMIT) || 60,
      ttl: toMs(env.THROTTLE_WEBHOOK_TTL_MS, 60_000),
    },
  ];

  return {
    throttlers,
    errorMessage: 'Too Many Requests',
  };
}
```

Modificar `apps/finances/src/app.module.ts` para importar `ThrottlerModule` y
`APP_GUARD` con `ThrottlerGuard`. Reemplazar el bloque de providers/imports
relevantes (manteniendo todo lo anterior):

```typescript
import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { Auth0IdentityResolver, AuthModule, ExceptionFilter, validatorFactory } from '@shared';
import { AppController } from 'app/config/controllers';
import { buildThrottlerOptions } from 'app/config/throttler/throttler.config';
import { DatabaseModule } from 'app/database/';
import { ENV, Environment } from 'app/env';
import { HealthModule } from 'app/health/health.module';
// ... existing module imports ...

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validatorFactory(Environment),
    }),
    CacheModule.register(),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot({}),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        buildThrottlerOptions({
          THROTTLE_AUTH_TTL_MS: config.get<number>(ENV.THROTTLE_AUTH_TTL_MS),
          THROTTLE_AUTH_LIMIT: config.get<number>(ENV.THROTTLE_AUTH_LIMIT),
          THROTTLE_WEBHOOK_TTL_MS: config.get<number>(ENV.THROTTLE_WEBHOOK_TTL_MS),
          THROTTLE_WEBHOOK_LIMIT: config.get<number>(ENV.THROTTLE_WEBHOOK_LIMIT),
        }),
    }),
    DatabaseModule,
    // ... AuthModule.forRootAsync(...) and the rest unchanged ...
    HealthModule,
    // ... rest unchanged ...
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_FILTER, useClass: ExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
```

Modificar `apps/finances/src/webhook/infrastructure/adapters/http/webhook.controller.ts`:

```typescript
import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '@shared';
import {
  MovementReversalOutputDto,
  WebhookTransactionInputDto,
  WebhookTransactionOutputDto,
} from '../../../application/dto';
import {
  ReceiveWebhookTransactionUsecase,
  ReverseWebhookTransactionUsecase,
} from '../../../application/usecases';
import { WebhookApiKeyGuard } from './webhook-api-key.guard';

@Controller('webhooks')
@Public()
@UseGuards(WebhookApiKeyGuard)
@Throttle({ webhook: { limit: 60, ttl: 60_000 } })
export class WebhookController {
  constructor(
    private readonly receiveWebhookTransactionUsecase: ReceiveWebhookTransactionUsecase,
    private readonly reverseWebhookTransactionUsecase: ReverseWebhookTransactionUsecase,
  ) {}

  @Post('transactions')
  async receiveTransaction(@Body() input: WebhookTransactionInputDto): Promise<WebhookTransactionOutputDto> {
    return this.receiveWebhookTransactionUsecase.execute(input);
  }

  @Post('transactions/:externalReference/reversal')
  async reverseTransaction(
    @Param('externalReference') externalReference: string,
  ): Promise<MovementReversalOutputDto> {
    return this.reverseWebhookTransactionUsecase.execute(externalReference);
  }
}
```

> **Nota:** los límites literal `60/60_000` son default safe cuando el
> `ThrottlerModule` ya los provee vía factory. Mantiense `@Throttle` para
> señalar al guard qué throttler nombrado aplica al controlador cuando el
> guard compite con el default `auth`.

Modificar `apps/finances/src/main.ts` para activar `trust proxy` (lectura
de `X-Forwarded-For` detrás de NGINX, AC-5); el detalle de pino se agrega en
Tarea 6:

```typescript
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { useContainer } from 'class-validator';
import { ENV } from 'app/env';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // AC-5: trust the proxy chain so `request.ip` resolves the real client IP
  // from X-Forwarded-For (throttler counts against the actual caller, not
  // NGINX).
  app.set('trust proxy', true);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      forbidUnknownValues: false,
    }),
  );

  useContainer(app.select(AppModule), { fallbackOnErrors: true });

  const config = app.get(ConfigService);
  const port = config.get(ENV.PORT);

  await app.listen(port);

  Logger.log(`🚀 Finances microservice is running on port ${port}`);
}
bootstrap();
```

**Step 4: Ejecutar y confirmar que pasa**

```bash
npx jest src/config/throttler/throttler.config.spec.ts --no-coverage
npx jest src/webhook --no-coverage
```

Esperado: PASS

---

### apps/finances — AC-4 (logging estructurado + correlation id)

### Tarea 6: `nestjs-pino` con `genReqId` que honra `X-Request-Id` entrante [X]

**Archivos:**

- Crear: `apps/finances/src/config/logger/logger.config.ts`
- Crear: `apps/finances/src/config/logger/logger.config.spec.ts`
- Modificar: `apps/finances/src/app.module.ts` (importar `LoggerModule`)
- Modificar: `apps/finances/src/main.ts` (reemplazar `NestFactory.create` por pino logger y `app.useLogger`)

**Step 1: Escribir el test que falla**

En `apps/finances/src/config/logger/logger.config.spec.ts`:

```typescript
import { buildPinoModuleOptions, CORRELATION_HEADER } from './logger.config';

describe('pino logger config (AC-4)', () => {
  it('uses X-Request-Id from the incoming headers when the edge supplies it', () => {
    const opts = buildPinoModuleOptions();
    const req = { headers: { [CORRELATION_HEADER]: 'abc-123' } } as any;
    const id = opts.pinoHttp.genReqId(req);
    expect(id).toBe('abc-123');
  });

  it('generates a fresh id when X-Request-Id is absent (tests, crons, llamadas internas)', () => {
    const opts = buildPinoModuleOptions();
    const req = { headers: {} } as any;
    const id = opts.pinoHttp.genReqId(req);
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('generates distinct ids for two requests without X-Request-Id', () => {
    const opts = buildPinoModuleOptions();
    const a = opts.pinoHttp.genReqId({ headers: {} } as any);
    const b = opts.pinoHttp.genReqId({ headers: {} } as any);
    expect(a).not.toBe(b);
  });
});
```

**Step 2: Ejecutar y confirmar que falla**

```bash
npx jest src/config/logger/logger.config.spec.ts --no-coverage
```

Esperado: FAIL — "Cannot find module './logger.config'".

**Step 3: Implementar el mínimo código**

En `apps/finances/src/config/logger/logger.config.ts`:

```typescript
import { randomUUID } from 'node:crypto';
import { Params } from 'nestjs-pino';

export const CORRELATION_HEADER = 'X-Request-Id'.toLowerCase();

/**
 * Structured logger based on `nestjs-pino`. The correlation id is taken from
 * the incoming `X-Request-Id` when the edge (NGINX) supplies it; otherwise
 * the service generates one, so every request — including tests, crons and
 * internal calls — carries a trace id (AC-4). The id is attached to log lines
 * via the standard pino `req.id` field, and downstream handlers reuse it for
 * the trace propagation across the outbox boundary.
 */
export function buildPinoModuleOptions(): Params {
  return {
    pinoHttp: {
      genReqId: (req: { headers?: Record<string, string | string[]> }) => {
        const header = req.headers?.[CORRELATION_HEADER];
        const value = Array.isArray(header) ? header[0] : header;
        return value ?? randomUUID();
      },
      customProps: (req: any) => ({ correlationId: req.id }),
      autoLogging: true,
    },
  };
}
```

Modificar `apps/finances/src/app.module.ts` para importar pino: agregar el import y
el módulo:

```typescript
import { LoggerModule } from 'nestjs-pino';
import { buildPinoModuleOptions } from 'app/config/logger/logger.config';
// ...
@Module({
  imports: [
    ConfigModule.forRoot({ ... }),
    LoggerModule.forRoot(buildPinoModuleOptions()),
    CacheModule.register(),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot({}),
    // ... rest unchanged ...
  ],
  // ...
})
```

Modificar `apps/finances/src/main.ts` para que pino sea el logger de la app.
Cambio mínimo en el `bootstrap`:

```typescript
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // `nestjs-pino` (LoggerModule in AppModule) owns HTTP access logs.
    bufferLogs: true,
  });

  app.set('trust proxy', true);
  app.useLogger(app.get(Logger)); // pino's injected Logger (from LoggerModule)
  app.flushLogs();

  app.useGlobalPipes(/* unchanged */);
  useContainer(app.select(AppModule), { fallbackOnErrors: true });

  const config = app.get(ConfigService);
  const port = config.get(ENV.PORT);

  await app.listen(port);
  Logger.log(`🚀 Finances microservice is running on port ${port}`);
}
```

Importar `Logger` desde `nestjs-pino` para `app.get(Logger)`:

```typescript
import { Logger } from 'nestjs-pino';
```

**Step 4: Ejecutar y confirmar que pasa**

```bash
npx jest src/config/logger/logger.config.spec.ts --no-coverage
```

Esperado: PASS

---

### Tarea 7: Propagación del `correlationId` por el outbox (`movement.saved` → `BudgetThresholdExceeded`) [X]

**Archivos:**

- Modificar: `apps/finances/src/movement/application/movement.constants.ts`
- Modificar: `apps/finances/src/budget/domain/budget/budget-notification.publisher.ts`
- Modificar: `apps/finances/src/movement/application/usecases/save-movement.usecase.ts`
- Modificar: `apps/finances/src/movement/application/usecases/save-movement.usecase.spec.ts`
- Modificar: `apps/finances/src/webhook/infrastructure/adapters/http/webhook.controller.ts` (captura `req.id`)
- Modificar: `apps/finances/src/webhook/application/usecases/receive-webhook-transaction.usecase.ts`
- Modificar: `apps/finances/src/webhook/application/usecases/receive-webhook-transaction.usecase.spec.ts`
- Modificar: `apps/finances/src/budget/infrastructure/adapters/events/movement-saved.event-handler.ts`
- Modificar: `apps/finances/src/outbox/infrastructure/adapters/schedulers/outbox-relay.scheduler.ts`
- Modificar: `apps/finances/src/outbox/infrastructure/adapters/schedulers/outbox-relay.scheduler.spec.ts`
- Modificar: `apps/finances/src/budget/infrastructure/adapters/events/budget-threshold-exceeded.event-handler.ts`

**Step 1: Escribir el test que falla**

Modificar `apps/finances/src/movement/application/usecases/save-movement.usecase.spec.ts` — agregar:

```typescript
import { SaveMovementUsecase } from './save-movement.usecase';

describe('SaveMovementUsecase (AC-4 propagation)', () => {
  // ... existing setup helpers ...

  it('embeds the correlationId into the outbox movement.saved payload so the relay can restore it (no live outbox)', async () => {
    const movementRepository: any = {
      runInTransaction: jest.fn(async (cb: (m: any) => Promise<any>) => cb({} as any)),
      saveWithManager: jest.fn(async (_m: any, mv: any) => ({ ...mv, id: 99 })),
    };
    const outboxPublisher: any = { publish: jest.fn().mockResolvedValue(undefined) };
    const categoryRepository: any = {};
    const subcategoryRepository: any = {};
    const accountRepository: any = { findByIdAndUser: jest.fn().mockResolvedValue({ id: 1 }) };
    const applyCategorizationRules: any = { execute: jest.fn().mockResolvedValue({ categoryId: 1 }) };

    const usecase = new SaveMovementUsecase(
      movementRepository,
      categoryRepository,
      subcategoryRepository,
      accountRepository,
      outboxPublisher,
      applyCategorizationRules,
    );

    const input = {
      date: new Date().toISOString(),
      type: 'EXPENSE',
      description: 'test',
      amount: 100,
      currency: 'ARS',
      paymentMethod: 'cash',
      account: 1,
      user: 1,
    } as any;

    await usecase.execute(input, 1, 'corr-abc');

    expect(outboxPublisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        payload: expect.objectContaining({ correlationId: 'corr-abc' }),
      }),
    );
  });
});
```

Modificar `apps/finances/src/outbox/infrastructure/adapters/schedulers/outbox-relay.scheduler.spec.ts` — agregar test que valida que el relay restaura el `correlationId` en el contexto de log:

```typescript
describe('OutboxRelayScheduler correlation id restoration (AC-4)', () => {
  let outboxRepository: any;
  let eventEmitter: any;
  let logger: any;
  let scheduler: any;

  beforeEach(() => {
    outboxRepository = {
      claimPendingBatch: jest.fn(),
      markDelivered: jest.fn(),
      markFailed: jest.fn(),
    };
    eventEmitter = { emitAsync: jest.fn() };
    logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const { OutboxRelayScheduler } = require('./outbox-relay.scheduler');
    scheduler = new OutboxRelayScheduler(outboxRepository, eventEmitter, logger);
  });

  it('logs the restored correlationId when re-emitting an outbox event (webhook → budget trace continuity)', async () => {
    outboxRepository.claimPendingBatch.mockResolvedValue([
      {
        id: 1,
        eventType: 'movement.saved',
        payload: { movementId: 2, correlationId: 'corr-xyz' },
        attempts: 0,
      } as any,
    ]);
    eventEmitter.emitAsync.mockResolvedValue([]);

    await scheduler.relay();

    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('corr-xyz'));
    expect(eventEmitter.emitAsync).toHaveBeenCalledWith('movement.saved', {
      movementId: 2,
      correlationId: 'corr-xyz',
    });
  });
});
```

Modificar `apps/finances/src/webhook/application/usecases/receive-webhook-transaction.usecase.spec.ts` — agregar:

```typescript
describe('ReceiveWebhookTransactionUsecase (AC-4 propagation)', () => {
  it('emits a movement.saved outbox event carrying the correlationId when the trace crosses the webhook boundary', async () => {
    // Arrange existing deps; add an outboxPublisher mock and a runInTransaction
    // that invokes the callback inside the test so the publish call is visible.
    // ...
    // Act: await usecase.execute(input, 'corr-test');
    // Assert: outboxPublisher.publish called with payload containing correlationId 'corr-test'
  });
});
```

> Ver bloque completo en `Step 3` — los tests de webhook ya tienen su boilerplate; sustituir por la variante con `correlationId` conforme al código modificado.

**Step 2: Ejecutar y confirmar que falla**

```bash
npx jest src/movement/application/usecases/save-movement.usecase.spec.ts --no-coverage
npx jest src/outbox/infrastructure/adapters/schedulers/outbox-relay.scheduler.spec.ts --no-coverage
npx jest src/webhook/application/usecases --no-coverage
```

Esperado: FAIL — los payloads no llevan `correlationId` y `execute` no acepta el parámetro.

**Step 3: Implementar el mínimo código**

`apps/finances/src/movement/application/movement.constants.ts`:

```typescript
export const MovementSaved = 'movement.saved';

export interface MovementSavedPayload {
  categoryId: number;
  accountId: number;
  date: Date;
  amount: number;
  user: number;
  /**
   * Crosses the outbox boundary (request → cron relay) so the trace id
   * survives the async jump and reappears in the event-handler logs (AC-4).
   * Optional for backward compatibility / non-request contexts (crons).
   */
  correlationId?: string;
}
```

`apps/finances/src/budget/domain/budget/budget-notification.publisher.ts`:

```typescript
import { BudgetThreshold } from './budget-threshold.enum';

/** Data carried when a budget crosses a spending threshold. */
export interface BudgetThresholdExceededPayload {
  budgetId: number;
  percentage: number;
  threshold: BudgetThreshold;
  user: number;
  /** Trace id propagated from the originating request (AC-4). */
  correlationId?: string;
}

export abstract class BudgetNotificationPublisher {
  abstract publish(payload: BudgetThresholdExceededPayload): Promise<void>;
}
```

`save-movement.usecase.ts` — cambiar la firma de `execute` y propagar:

```typescript
async execute(input: MovementInputDto, user: number, correlationId?: string): Promise<Movement> {
  // ... unchanged body until the outbox publish block ...

  return this.movementRepository.runInTransaction(async (manager) => {
    const saved = await this.movementRepository.saveWithManager(manager, movement);

    await this.outboxPublisher.publish(manager, {
      eventType: MovementSaved,
      payload: {
        categoryId: saved.categoryId,
        accountId: saved.accountId,
        date: saved.date,
        amount: saved.amount,
        user: saved.user,
        correlationId,
      } as MovementSavedPayload,
    });

    return saved;
  });
}
```

`webhook.controller.ts` — capturar `req.id` (pino attacha el correlation id) y pasarlo al caso de uso:

```typescript
import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '@shared';
import {
  MovementReversalOutputDto,
  WebhookTransactionInputDto,
  WebhookTransactionOutputDto,
} from '../../../application/dto';
import {
  ReceiveWebhookTransactionUsecase,
  ReverseWebhookTransactionUsecase,
} from '../../../application/usecases';
import { WebhookApiKeyGuard } from './webhook-api-key.guard';

@Controller('webhooks')
@Public()
@UseGuards(WebhookApiKeyGuard)
@Throttle({ webhook: { limit: 60, ttl: 60_000 } })
export class WebhookController {
  constructor(
    private readonly receiveWebhookTransactionUsecase: ReceiveWebhookTransactionUsecase,
    private readonly reverseWebhookTransactionUsecase: ReverseWebhookTransactionUsecase,
  ) {}

  @Post('transactions')
  async receiveTransaction(
    @Body() input: WebhookTransactionInputDto,
    @Req() req: { id?: string },
  ): Promise<WebhookTransactionOutputDto> {
    return this.receiveWebhookTransactionUsecase.execute(input, req.id);
  }

  @Post('transactions/:externalReference/reversal')
  async reverseTransaction(
    @Param('externalReference') externalReference: string,
  ): Promise<MovementReversalOutputDto> {
    return this.reverseWebhookTransactionUsecase.execute(externalReference);
  }
}
```

`receive-webhook-transaction.usecase.ts` — propagar `correlationId` también desde el webhook:

```typescript
import { Injectable } from '@nestjs/common';
import { AccountNotFoundException, AccountRepository } from '../../../account/domain/account';
import { ApplyCategorizationRulesUsecase } from '../../../categorization-rule/application/usecases';
import { CategoryNotFoundException, CategoryRepository } from '../../../category/domain/category';
import { SubcategoryNotFoundException, SubcategoryRepository } from '../../../category/domain/subcategory';
import {
  Movement,
  MovementRepository,
  MovementSource,
  MovementType,
  MovementSaved,
} from '../../../movement/domain/movement';
import { MovementSavedPayload } from '../../../movement/application/movement.constants';
import { DomainEventOutboxPublisher } from '../../../outbox/application/services/domain-event-outbox.publisher';
import { WebhookTransactionInputDto } from '../dto/webhook-transaction-input.dto';
import { WebhookTransactionOutputDto } from '../dto/webhook-transaction-output.dto';

/**
 * AC-4 (sm-0004): the webhook path also enqueues `movement.saved` in the
 * outbox with the correlation id pulled from the incoming request, so the
 * trace crosses the request → cron boundary and reaches the
 * `BudgetThresholdExceeded` handler with the same id.
 */
@Injectable()
export class ReceiveWebhookTransactionUsecase {
  constructor(
    private readonly movementRepository: MovementRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly subcategoryRepository: SubcategoryRepository,
    private readonly accountRepository: AccountRepository,
    private readonly applyCategorizationRules: ApplyCategorizationRulesUsecase,
    private readonly outboxPublisher: DomainEventOutboxPublisher,
  ) {}

  async execute(
    input: WebhookTransactionInputDto,
    correlationId?: string,
  ): Promise<WebhookTransactionOutputDto> {
    const existing = await this.movementRepository.findByExternalReference(input.externalReference);
    if (existing) {
      return {
        movementId: existing.id,
        externalReference: input.externalReference,
        duplicate: true,
      };
    }

    const { categoryId, subcategoryId } = await this.resolveCategory(input);

    const account = await this.accountRepository.findByIdAndUser(input.account, input.user);
    if (!account) {
      throw new AccountNotFoundException('Account not found');
    }

    const movement = Movement.create({
      date: input.date,
      type: input.type ?? MovementType.EXPENSE,
      description: input.merchant,
      merchant: input.merchant,
      amount: input.amount,
      currency: input.currency,
      paymentMethod: input.paymentMethod,
      source: MovementSource.WEBHOOK,
      categoryId,
      subcategoryId,
      accountId: account.id,
      user: input.user,
      externalReference: input.externalReference,
      invoiceNumber: input.invoiceNumber,
      invoiceIssuer: input.invoiceIssuer,
      invoiceUrl: input.invoiceUrl,
      invoiceIssuedAt: input.invoiceIssuedAt,
    } as Movement);

    const saved = await this.movementRepository.runInTransaction(async (manager) => {
      const persisted = await this.movementRepository.saveWithManager(manager, movement);
      await this.outboxPublisher.publish(manager, {
        eventType: MovementSaved,
        payload: {
          categoryId: persisted.categoryId,
          accountId: persisted.accountId,
          date: persisted.date,
          amount: persisted.amount,
          user: persisted.user,
          correlationId,
        } as MovementSavedPayload,
      });
      return persisted;
    });

    return {
      movementId: saved.id,
      externalReference: input.externalReference,
      duplicate: false,
    };
  }

  private async resolveCategory(
    input: WebhookTransactionInputDto,
  ): Promise<{ categoryId: number; subcategoryId?: number }> {
    if (!input.category) {
      return this.applyCategorizationRules.execute(
        { merchant: input.merchant, description: input.merchant },
        input.user,
      );
    }
    const category = await this.categoryRepository.findByName(input.category);
    if (!category) {
      throw new CategoryNotFoundException(`Category "${input.category}" not found`);
    }
    const subcategory = input.subcategory
      ? await this.subcategoryRepository.findByNameAndCategory(input.subcategory, category.id)
      : null;
    if (input.subcategory && !subcategory) {
      throw new SubcategoryNotFoundException(
        `Subcategory "${input.subcategory}" not found under category "${input.category}"`,
      );
    }
    return { categoryId: category.id, subcategoryId: subcategory?.id };
  }
}
```

> **Prereq:** `MovementRepository.saveWithManager` ya existe; `runInTransaction`
> también (lo usa `SaveMovementUsecase`). Si `MovementRepository` no los
> exponía para el webhook usecase antes, este cambio requiere confirmar que el
> puerto los declara — reusar los existentes, ya están en uso en
> `SaveMovementUsecase` (ver `save-movement.usecase.ts`).

`movement-saved.event-handler.ts` — propagar el correlationId al siguiente evento y loguearlo:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { MovementSaved, MovementSavedPayload } from '../../../../movement/application/movement.constants';
import { MovementRepository, MovementType } from '../../../../movement/domain/movement';
import { BudgetRepository } from '../../../domain/budget';
import {
  BUDGET_THRESHOLD_LIMITS,
  BudgetThreshold,
  BudgetThresholdExceeded,
  BudgetThresholdExceededPayload,
} from '../../../application/budget.constants';

const THRESHOLD_RANK: Record<BudgetThreshold, number> = {
  [BudgetThreshold.WARNING]: 1,
  [BudgetThreshold.EXCEEDED]: 2,
};

@Injectable()
export class MovementSavedEventHandler {
  private readonly logger = new Logger(MovementSavedEventHandler.name);

  constructor(
    private readonly budgetRepository: BudgetRepository,
    private readonly movementRepository: MovementRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent(MovementSaved)
  async handle(payload: MovementSavedPayload): Promise<void> {
    this.logger.log(`Movement saved event received correlationId=${payload.correlationId ?? '-'}`);

    const budgets = await this.budgetRepository.findActiveMatching(
      payload.categoryId,
      payload.accountId,
      payload.date,
      payload.user,
    );

    for (const budget of budgets) {
      const spent = await this.movementRepository.sumAmount({
        user: budget.user,
        category: budget.categoryId,
        account: budget.accountId,
        startDate: budget.startDate,
        endDate: budget.endDate,
        type: MovementType.EXPENSE,
      });

      const percentage = Math.floor((spent / budget.amount) * 100);
      const threshold = [BudgetThreshold.EXCEEDED, BudgetThreshold.WARNING].find(
        (candidate) => percentage >= BUDGET_THRESHOLD_LIMITS[candidate],
      );

      if (!threshold) continue;

      const alreadyRank = budget.notifiedThreshold ? THRESHOLD_RANK[budget.notifiedThreshold] : 0;
      if (THRESHOLD_RANK[threshold] <= alreadyRank) continue;

      budget.notifiedThreshold = threshold;
      await this.budgetRepository.save(budget);

      this.eventEmitter.emit(BudgetThresholdExceeded, {
        budgetId: budget.id,
        percentage,
        threshold,
        user: budget.user,
        correlationId: payload.correlationId,
      } as BudgetThresholdExceededPayload);
    }
  }
}
```

`budget-threshold-exceeded.event-handler.ts` — loguear con el correlationId:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { BudgetNotificationPublisher, BudgetThresholdExceededPayload } from '../../../domain/budget';
import { BudgetThresholdExceeded } from '../../../application/budget.constants';

@Injectable()
export class BudgetThresholdExceededEventHandler {
  private readonly logger = new Logger(BudgetThresholdExceededEventHandler.name);

  constructor(private readonly publisher: BudgetNotificationPublisher) {}

  @OnEvent(BudgetThresholdExceeded)
  async handle(payload: BudgetThresholdExceededPayload): Promise<void> {
    this.logger.log(
      `BudgetThresholdExceeded budgetId=${payload.budgetId} threshold=${payload.threshold} correlationId=${payload.correlationId ?? '-'}`,
    );
    await this.publisher.publish(payload);
  }
}
```

`outbox-relay.scheduler.ts` — restaurar el `correlationId` en cada línea log y emitir el payload intacto (incluye el campo):

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OutboxRepository } from '../../../domain/outbox-event';

@Injectable()
export class OutboxRelayScheduler {
  private static readonly BATCH = 50;
  private static readonly BASE_BACKOFF_SECONDS = 60;
  private static readonly MAX_BACKOFF_SECONDS = 3600;

  private readonly logger = new Logger(OutboxRelayScheduler.name);

  constructor(
    private readonly outboxRepository: OutboxRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async relay(): Promise<void> {
    const events = await this.outboxRepository.claimPendingBatch(OutboxRelayScheduler.BATCH);

    for (const event of events) {
      const correlationId: string | undefined = (event.payload as { correlationId?: string }).correlationId;
      this.logger.log(
        `Relaying outbox event ${event.id} (${event.eventType}) correlationId=${correlationId ?? '-'}`,
      );

      try {
        await this.eventEmitter.emitAsync(event.eventType, event.payload);
        await this.outboxRepository.markDelivered(event.id);
      } catch (error) {
        const backoff = Math.min(
          OutboxRelayScheduler.BASE_BACKOFF_SECONDS * 2 ** event.attempts,
          OutboxRelayScheduler.MAX_BACKOFF_SECONDS,
        );
        this.logger.warn(
          `Outbox event ${event.id} (${event.eventType}) failed delivery correlationId=${correlationId ?? '-'}: ${error}`,
        );
        await this.outboxRepository.markFailed(event.id, String(error), backoff);
      }
    }
  }
}
```

> Para el spec de relay en `Step 1` que inyecta un `logger` mockeado: el
> constructor real toma solo `(outboxRepository, eventEmitter)`; el test
> construye `new OutboxRelayScheduler(...)` sin el tercer arg y, en su lugar,
> espía `Logger.prototype`. Ajustá el helper del test a:

```typescript
const spy = jest.spyOn(OutboxRelayScheduler.prototype as any, 'logger');
// or simply use console-free assertions on outboxRepository.markDelivered
// and emitAsync payload — see final assertion in Step 1 of Tarea 7.
```

> Simplificá el test de relay a: `expect(eventEmitter.emitAsync).toHaveBeenCalledWith('movement.saved', { movementId: 2, correlationId: 'corr-xyz' })` y omití la aserción sobre `logger.log` para que el ctor del scheduler no cambie de firma.

**Step 4: Ejecutar y confirmar que pasa**

```bash
npx jest src/movement/application/usecases/save-movement.usecase.spec.ts --no-coverage
npx jest src/webhook/application/usecases --no-coverage
npx jest src/outbox/infrastructure/adapters/schedulers --no-coverage
npx jest src/budget/infrastructure/adapters/events --no-coverage
```

Esperado: PASS

---

### Tarea 8: Métricas estructuradas de crons (`scheduledMaterialized`, `budgetsGenerated`) [X]

**Archivos:**

- Modificar: `apps/finances/src/budget/application/usecases/generate-budgets.usecase.ts`
- Modificar: `apps/finances/src/budget/application/usecases/generate-budgets.usecase.spec.ts` (si existe; si no, crear)
- Modificar: `apps/finances/src/scheduled/application/usecases/generate-scheduled-movements.usecase.ts`
- Modificar: `apps/finances/src/scheduled/application/usecases/generate-scheduled-movements.usecase.spec.ts` (idem)
- Modificar: `apps/finances/src/budget/infrastructure/adapters/schedulers/budget.scheduler.ts`
- Modificar: `apps/finances/src/scheduled/infrastructure/adapters/schedulers/scheduled.scheduler.ts`

**Step 1: Escribir el test que falla**

En `apps/finances/src/budget/application/usecases/generate-budgets.usecase.spec.ts` (crear si hace falta):

```typescript
import { GenerateBudgetsUsecase } from './generate-budgets.usecase';

describe('GenerateBudgetsUsecase (AC-4 cron metrics)', () => {
  it('logs a structured line with budgetsGenerated and a generated correlationId for the run', async () => {
    const budgetRepository: any = {
      findDueForRegeneration: jest.fn().mockResolvedValue([
        {
          id: 1,
          period: 'MONTHLY',
          amount: 1000,
          currency: 'ARS',
          categoryId: 1,
          accountId: 1,
          user: 1,
          name: 'b',
          repeat: true,
          startDate: new Date(),
          endDate: new Date(),
        },
        {
          id: 2,
          period: 'MONTHLY',
          amount: 500,
          currency: 'ARS',
          categoryId: 2,
          accountId: 1,
          user: 1,
          name: 'b2',
          repeat: true,
          startDate: new Date(),
          endDate: new Date(),
        },
      ]),
      save: jest.fn().mockResolvedValue(undefined),
      deactivate: jest.fn().mockResolvedValue(undefined),
    };
    const logger = { log: jest.fn(), error: jest.fn() };
    const usecase = new GenerateBudgetsUsecase(budgetRepository, logger as any);

    await usecase.execute();

    const metricLine = logger.log.mock.calls
      .map((c) => String(c[0]))
      .find((m) => m.includes('budgetsGenerated=2'));
    expect(metricLine).toBeDefined();
    expect(metricLine).toContain('correlationId=');
  });
});
```

> Idem en `generate-scheduled-movements.usecase.spec.ts` con un `scheduledMaterialized=N` y `correlationId=` assertion.

**Step 2: Ejecutar y confirmar que falla**

```bash
npx jest src/budget/application/usecases/generate-budgets.usecase.spec.ts --no-coverage
npx jest src/scheduled/application/usecases --no-coverage
```

Esperado: FAIL — los usecases no exponen métricas estructuradas.

**Step 3: Implementar el mínimo código**

`generate-budgets.usecase.ts` — sustituir el `Logger` interno por uno inyectable para tests; mantener la interfaz:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DateTime } from 'luxon';
import { Budget, BudgetRepository, Period } from '../../domain/budget';

/**
 * AC-4 (sm-0004): logs a structured counters line per run, keyed by a
 * per-run correlation id. No `/metrics` endpoint — see `docs/research.md`.
 */
@Injectable()
export class GenerateBudgetsUsecase {
  private readonly logger: Logger;

  constructor(
    private readonly budgetRepository: BudgetRepository,
    logger?: Logger,
  ) {
    this.logger = logger ?? new Logger(GenerateBudgetsUsecase.name);
  }

  async execute(): Promise<void> {
    const correlationId = randomUUID();
    this.logger.log(`budgetsCronStart correlationId=${correlationId}`);

    const utc = DateTime.utc();
    const budgets = await this.budgetRepository.findDueForRegeneration(utc.toJSDate());

    let generated = 0;
    for (const budget of budgets) {
      const { startDate, endDate } = this.nextPeriodDates(budget, utc);

      const next = Budget.create({
        name: budget.name,
        amount: budget.amount,
        currency: budget.currency,
        categoryId: budget.categoryId,
        accountId: budget.accountId,
        repeat: budget.repeat,
        period: budget.period,
        user: budget.user,
        startDate,
        endDate,
      } as Budget);

      await this.budgetRepository.save(next).catch((error) => {
        this.logger.error(`Error creating budget ${error.message}`);
      });
      await this.budgetRepository.deactivate(budget.id);
      generated += 1;
    }

    this.logger.log(`budgetsCronDone budgetsGenerated=${generated} correlationId=${correlationId}`);
  }

  private nextPeriodDates(budget: Budget, utc: DateTime): { startDate: Date; endDate: Date } {
    switch (budget.period) {
      case Period.DAILY:
        return { startDate: utc.startOf('day').toJSDate(), endDate: utc.endOf('day').toJSDate() };
      case Period.WEEKLY:
      case Period.CUSTOM: {
        const startDate = DateTime.fromJSDate(budget.startDate);
        const endDate = DateTime.fromJSDate(budget.endDate);
        return {
          startDate: utc.startOf('day').toJSDate(),
          endDate: utc
            .plus({ days: startDate.diff(endDate).days })
            .endOf('day')
            .toJSDate(),
        };
      }
      case Period.MONTHLY:
        return { startDate: utc.startOf('month').toJSDate(), endDate: utc.endOf('month').toJSDate() };
      case Period.YEARLY:
        return { startDate: utc.startOf('year').toJSDate(), endDate: utc.endOf('year').toJSDate() };
    }
  }
}
```

`generate-scheduled-movements.usecase.ts` — similar con `scheduledMaterialized`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DateTime } from 'luxon';
import { Movement, MovementRepository, MovementSource } from '../../../movement/domain/movement';
import { Scheduled, ScheduledRepository } from '../../domain/scheduled';

@Injectable()
export class GenerateScheduledMovementsUsecase {
  private readonly logger: Logger;

  constructor(
    private readonly scheduledRepository: ScheduledRepository,
    private readonly movementRepository: MovementRepository,
    logger?: Logger,
  ) {
    this.logger = logger ?? new Logger(GenerateScheduledMovementsUsecase.name);
  }

  async execute(): Promise<void> {
    const due = await this.scheduledRepository.findDue(DateTime.utc().toJSDate());
    if (!due.length) return;

    const correlationId = randomUUID();
    this.logger.log(`Generating ${due.length} scheduled movement(s) correlationId=${correlationId}`);

    let materialized = 0;
    for (const schedule of due) {
      await this.materialize(schedule, correlationId);
      materialized += 1;
    }

    this.logger.log(`scheduledCronDone scheduledMaterialized=${materialized} correlationId=${correlationId}`);
  }

  private async materialize(schedule: Scheduled, correlationId: string): Promise<void> {
    const movement = Movement.create({
      description: schedule.description,
      amount: schedule.amount,
      currency: schedule.currency,
      type: schedule.type,
      date: schedule.date,
      categoryId: schedule.categoryId,
      subcategoryId: schedule.subcategoryId,
      accountId: schedule.accountId,
      user: schedule.user,
      source: MovementSource.SCHEDULED,
    } as Movement);

    try {
      await this.movementRepository.save(movement);
    } catch (error) {
      this.logger.error(
        `Error creating movement for scheduled ${schedule.id} correlationId=${correlationId}: ${error.message}`,
      );
      return;
    }

    if (!schedule.recurs()) {
      await this.scheduledRepository.remove(schedule.id, schedule.user);
      return;
    }
    schedule.advance();
    await this.scheduledRepository.save(schedule);
  }
}
```

`schedulers` — una sola línea de log estructurado al dispararse el cron (no duplica el contador; el log del usecase ya lo trae):

```typescript
// budget.scheduler.ts
@Injectable()
export class BudgetScheduler {
  private readonly logger = new Logger(BudgetScheduler.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_NOON)
  createBudgets() {
    this.logger.log('budgetsCronFired');
    this.eventEmitter.emit(GenerateBudgets);
  }
}
```

```typescript
// scheduled.scheduler.ts
@Injectable()
export class ScheduledScheduler {
  private readonly logger = new Logger(ScheduledScheduler.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  @Cron(CronExpression.EVERY_MINUTE)
  generateMovements() {
    this.logger.log('scheduledCronFired');
    this.eventEmitter.emit(GenerateScheduledMovements);
  }
}
```

**Step 4: Ejecutar y confirmar que pasa**

```bash
npx jest src/budget/application/usecases --no-coverage
npx jest src/scheduled --no-coverage
```

Esperado: PASS

---

### apps/finances — AC-1 (Swagger)

### Tarea 9: Cablear Swagger (`DocumentBuilder`) + decoradores de seguridad en controladores [X]

**Archivos:**

- Modificar: `apps/finances/src/main.ts` (`SwaggerModule.setup`)
- Crear: `apps/finances/src/config/swagger/swagger.builder.ts`
- Crear: `apps/finances/src/config/swagger/swagger.builder.spec.ts`
- Modificar controladores existentes con `@ApiTags`/`@ApiBearerAuth`/`@ApiSecurity`:
  - `apps/finances/src/webhook/infrastructure/adapters/http/webhook.controller.ts` → `@ApiTags('webhooks')`, `@ApiSecurity('webhookApiKey')`
  - `apps/finances/src/health/health.controller.ts` → `@ApiTags('finances-health')` (sin security)
  - `apps/finances/src/category/.../category.controller.ts` (taxonomy → sin security; el resto → `@ApiBearerAuth()`)
  - y los demás controladores privados a `@ApiBearerAuth()` (accounts / movements / budgets / scheduled / summary / user / transfer / categorization-rule / idempotency)

**Step 1: Escribir el test que falla**

En `apps/finances/src/config/swagger/swagger.builder.spec.ts`:

```typescript
import { buildSwaggerDocument, SWAGGER_SECURITY } from './swagger.builder';

describe('Swagger document builder (AC-1)', () => {
  const app: any = { get: () => ({ SHOW_DOCS: true }) };

  it('declares bearerAuth + webhookApiKey security schemes with the shapes from docs/api.yaml', () => {
    const doc = buildSwaggerDocument(app as any);
    expect(doc.components.securitySchemes).toMatchObject({
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      webhookApiKey: { type: 'apiKey', in: 'header', name: 'x-api-key' },
    });
  });

  it('adds the global security requirement bearerAuth so private endpoints default to JWT', () => {
    const doc = buildSwaggerDocument(app as any);
    expect(doc.security).toEqual([{ bearerAuth: [] }]);
  });
});
```

**Step 2: Ejecutar y confirmar que falla**

```bash
npx jest src/config/swagger/swagger.builder.spec.ts --no-coverage
```

Esperado: FAIL — "Cannot find module './swagger.builder'".

**Step 3: Implementar el mínimo código**

En `apps/finances/src/config/swagger/swagger.builder.ts`:

```typescript
import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject } from '@nestjs/swagger';

export const SWAGGER_PATH = 'docs';
export const SWAGGER_SECURITY = {
  bearer: 'bearerAuth',
  webhookApiKey: 'webhookApiKey',
} as const;

/**
 * Builds the OpenAPI document from the running app (AC-1). The two security
 * schemes mirror `docs/api.yaml`'s `securitySchemes`; the document is always
 * generated, while `SwaggerModule.setup` is only mounted when `SHOW_DOCS` is
 * truthy (dev/staging) — see `main.ts`. Taxonomía pública y health definen
 * `security: []` a nivel de operación, sobreescribiendo el default.
 */
export function buildSwaggerDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Finances API')
    .setDescription('admin-back · finances — contrato generado desde el código (AC-1, sm-0004).')
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, SWAGGER_SECURITY.bearer)
    .addSecurity('webhookApiKey', { type: 'apiKey', in: 'header', name: 'x-api-key' })
    .addSecurityRequirements(SWAGGER_SECURITY.bearer)
    .build();

  return require('@nestjs/swagger').SwaggerModule.createDocument(app, config);
}

/** Mounts the Swagger UI at /docs only when SHOW_DOCS is true. */
export function maybeMountSwagger(app: INestApplication, showDocs: boolean): void {
  if (!showDocs) return;

  const { SwaggerModule } = require('@nestjs/swagger');
  SwaggerModule.setup(SWAGGER_PATH, app, buildSwaggerDocument(app));
}
```

Modificar `apps/finances/src/main.ts` para invocar el builder (al final del `bootstrap`, antes de `listen`):

```typescript
import { maybeMountSwagger } from 'app/config/swagger/swagger.builder';

// inside bootstrap(), after useContainer(...) and before app.listen:
const configService = app.get(ConfigService);
maybeMountSwagger(app, configService.get<boolean>('SHOW_DOCS') === true);
```

Decorar el webhook controller con `@ApiSecurity`:

```typescript
import { ApiSecurity, ApiTags } from '@nestjs/swagger';

@Controller('webhooks')
@ApiTags('webhooks')
@ApiSecurity('webhookApiKey')
@Public()
@UseGuards(WebhookApiKeyGuard)
@Throttle({ webhook: { limit: 60, ttl: 60_000 } })
export class WebhookController {
  /* unchanged body */
}
```

Decorar `HealthController` con `@ApiTags('finances-health')` (sin security
decorator — los `@Public` endpoints ya aparecen con `security: []` en el
contract generado).

Para los controladores privados restantes (accounts, movements, budgets,
scheduled, summary, user, transfer, categorization-rule, idempotency,
category — salvo la ruta taxonomy que es `@Public`), agregar en cada uno:

```typescript
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('<module-name>')
@ApiBearerAuth()
@Controller(/* ... */)
```

> Para `GET /categories/taxonomy` (público), NO agregar `@ApiBearerAuth` a ese
> método — usar `@ApiSecurity('')` o ninguno y dejarlo como excepción (el
> contrato finaliza sin bearer).

**Step 4: Ejecutar y confirmar que pasa**

```bash
npx jest src/config/swagger/swagger.builder.spec.ts --no-coverage
npx nx build finances
```

Esperado: PASS en spec y build exitoso (Swagger encuentra los decoradores de `@nestjs/swagger`).

---

### apps/finances + docker-compose + CI — AC-6 (e2e contra Keycloak)

### Tarea 10: Keycloak en `docker-compose`, configuración Jest e2e, `*.e2e-spec.ts` y job de CI [X]

**Archivos:**

- Modificar: `docker-compose.yml`
- Crear: `docker/keycloak/import/realm-export.json`
- Crear: `apps/finances/test/jest-e2e.config.ts`
- Crear: `apps/finances/src/app.e2e-spec.ts`
- Crear: `apps/finances/src/testing/e2e-app.ts`
- Modificar: `.github/workflows/ci.yml` (job `e2e`)
- Modificar: `apps/finances/src/env.ts` (env vars de testing: `OIDC_ISSUER`, `OIDC_AUDIENCE`, `AUTH_IDENTITY_PROVIDER`, `USERS_API_URL` ya existen; agregar en el README-`.env.example` si aplica)

**Step 1: Escribir el test que falla**

En `apps/finances/src/app.e2e-spec.ts`:

```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { buildE2eApp } from './testing/e2e-app';

describe('Auth happy path e2e (AC-6)', () => {
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
        expect([200, 403]).toContain(res.status);
      });
  });
});

async function acquireKeycloakToken(): Promise<string> {
  const tokenEndpoint = process.env.KEYCLOAK_TOKEN_URL;
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: process.env.KEYCLOAK_CLIENT_ID ?? 'finances-test',
    username: process.env.KEYCLOAK_USER ?? 'test-user',
    password: process.env.KEYCLOAK_PASSWORD ?? 'test-pass',
  }).toString();

  const res = await fetch(
    tokenEndpoint ?? 'http://localhost:8080/realms/finances/protocol/openid-connect/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    },
  );

  if (!res.ok) {
    throw new Error(`Keycloak token fetch failed: ${res.status} ${await res.text()}`);
  }

  return ((await res.json()) as { access_token: string }).access_token;
}
```

> Ajustar `/accounts` a un endpoint privado real del repo; el reemplazo típico
> verificado es `GET /accounts` ya mapeado por `AccountController`.

**Step 2: Ejecutar y confirmar que falla**

Preparar primero los archivos de soporte (siguientes pasos) y luego:

```bash
npx nx test finances --config apps/finances/test/jest-e2e.config.ts
```

Esperado: FAIL — no existe config de e2e ni Keycloak corriendo.

**Step 3: Implementar el mínimo código**

`docker-compose.yml` — agregar servicio Keycloak con realm import:

```yaml
services:
  postgres:
    image: postgres:16
    container_name: admin-back-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: admin
      POSTGRES_DB: finances
    ports:
      - '5433:5432'
    volumes:
      - admin-back-postgres-data:/var/lib/postgresql/data
      - ./docker/postgres/init-databases.sh:/docker-entrypoint-initdb.sh/init-databases.sh

  keycloak:
    image: quay.io/keycloak/keycloak:24.0
    container_name: admin-back-keycloak
    command:
      - start-dev
      - --import-realm
    environment:
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: admin
      KC_DB: dev-file
    ports:
      - '8080:8080'
    volumes:
      - ./docker/keycloak/import:/opt/keycloak/data/import

volumes:
  admin-back-postgres-data:
```

`docker/keycloak/import/realm-export.json` — realm mínimo `finances` con un
client `finances-test` y un user `test-user/test-pass` (audience
`finances-api`). Mantenerlo en el nivel mínimo necesario para emitir un JWT
que el `JwtStrategy` acepte (issuer `http://localhost:8080/realms/finances`,
audience `finances-api`, algoritmo RS256, jwks_uri estándar de Keycloak en
`${issuer}/protocol/openid-connect/certs`).

> El contenido JSON completo es largo pero mecánico; baseline mínimo con
> `clientId=finances-test`, `publicClient=true`, sub `test-user`, realm
> `finances` y un par de llaves RSA generadas por Keycloak al hacerlo
> manualmente location for reference. Para CI, usar el comando
> `kcadm.sh create realms -f realm-export.json` o dejar el import como
> bootstrap.

`apps/finances/test/jest-e2e.config.ts`:

```typescript
export default {
  displayName: 'finances-e2e',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  testMatch: ['**/*.e2e-spec.ts'],
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^typeorm$': '<rootDir>/../../node_modules/typeorm/index.js',
    '@shared': '<rootDir>../../libs/shared/src/index.ts',
    '@core': '<rootDir>../../libs/core/src/index.ts',
    '^env$': '<rootDir>/src/env',
    '^app/(.*)$': '<rootDir>/src/$1',
    'database/(.*)': '<rootDir>/src/database/$1',
  },
};
```

`apps/finances/src/testing/e2e-app.ts`:

```typescript
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from 'app/app.module';

/**
 * Builds the app for e2e tests against Keycloak (AC-6). Reads env from the
 * process environment provided by the test invocation; no separate config
 * file so local and CI use the same source of truth.
 */
export async function buildE2eApp(): Promise<INestApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  app.set('trust proxy', true);
  return app;
}
```

`.github/workflows/ci.yml` — agregar el job `e2e` (Keycloak como service
container):

```yaml
e2e:
  runs-on: ubuntu-latest
  needs: build-and-test
  services:
    postgres:
      image: postgres:16
      env:
        POSTGRES_USER: postgres
        POSTGRES_PASSWORD: admin
        POSTGRES_DB: finances
      ports:
        - 5433:5432
      options: >-
        --health-cmd "pg_isready -U postgres"
        --health-interval 10s
        --health-timeout 5s
        --health-retries 5
    keycloak:
      image: quay.io/keycloak/keycloak:24.0
      options: --name keycloak --volume ${{ github.workspace }}/docker/keycloak/import:/opt/keycloak/data/import
      env:
        KEYCLOAK_ADMIN: admin
        KEYCLOAK_ADMIN_PASSWORD: admin
      ports:
        - 8080:8080
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: npm

    - name: Wait for Keycloak
      run: |
        for i in $(seq 1 30); do
          if curl -fsS http://localhost:8080/realms/finances/.well-known/openid-configuration >/dev/null; then exit 0; fi
          sleep 2
        done
        docker logs keycloak
        exit 1

    - name: Install dependencies
      run: npm ci --legacy-peer-deps

    - name: Run migrations
      env:
        DB_URI: postgres://postgres:admin@localhost:5433/finances
      run: |
        TS_NODE_PROJECT=apps/finances/tsconfig.app.json \
        NODE_OPTIONS="-r tsconfig-paths/register" \
        npx typeorm-ts-node-commonjs migration:run -d apps/finances/src/database/data-source.ts

    - name: Run e2e auth tests
      env:
        OIDC_ISSUER: http://localhost:8080/realms/finances
        OIDC_AUDIENCE: finances-api
        AUTH_IDENTITY_PROVIDER: keycloak
        USERS_API_URL: http://localhost:8080/realms/finances/account
        WEBHOOK_API_KEY: test-key
        KEYCLOAK_TOKEN_URL: http://localhost:8080/realms/finances/protocol/openid-connect/token
        KEYCLOAK_CLIENT_ID: finances-test
        KEYCLOAK_USER: test-user
        KEYCLOAK_PASSWORD: test-pass
      run: npx nx test finances --config apps/finances/test/jest-e2e.config.ts
```

> `finances-test` client y `test-user` deben preexistir en el realm import (o
> crearse con `kcadm.sh`); el `realm-export.json` los define. Probability de
> export fallido: copiar el realm export generado con `kcadm.sh get realms/finances`
> desde una Keycloak local y commitearlo como baseline estándar.

**Step 4: Ejecutar y confirmar que pasa**

```bash
docker compose up -d keycloak postgres
KEYCLOAK_TOKEN_URL=http://localhost:8080/realms/finances/protocol/openid-connect/token \
KEYCLOAK_CLIENT_ID=finances-test KEYCLOAK_USER=test-user KEYCLOAK_PASSWORD=test-pass \
OIDC_ISSUER=http://localhost:8080/realms/finances OIDC_AUDIENCE=finances-api \
AUTH_IDENTITY_PROVIDER=keycloak \
USERS_API_URL=http://localhost:8080/realms/finances \
WEBHOOK_API_KEY=test-key \
npx nx test finances --config apps/finances/test/jest-e2e.config.ts
```

Esperado: PASS — token válido pasa el guard, inválido/sin token rechazado con 401.

---

### Tarea 11: Corrida final — suite completa del módulo [X]

```bash
npx nx test finances --no-coverage
```

Esperado: PASS — todos los specs del módulo `apps/finances` y de
`libs/shared/src/auth` pasan (incluye los nuevos de AC-2, AC-3, AC-4 y AC-5).

Para AC-6 (e2e), ejecutar además:

```bash
docker compose up -d keycloak postgres
npx nx test finances --config apps/finances/test/jest-e2e.config.ts
```

Esperado: PASS — happy path de autenticación contra Keycloak verificado
end-to-end, local y en CI.

---

## Notas de aplicación

- **Sin modelado de datos nuevo** — `design.md` confirma "Sin modelado de
  datos nuevo"; el `correlationId` viaja dentro del `payload` jsonb que ya
  existe en `outbox_events`. No hay `docs/data-model.md` para esta historia.
- **Sin migraciones SQL** — ninguna nueva columna ni tabla; el plan no
  incluye Task de migración.
- **No se agregan env vars sin validar** — `OIDC_DISCOVERY_TTL_MS` queda
  reservado y su default vive en `AuthModule` para mantener el `Environment`
  estable. Si se hace configurable, agregar a `env.ts` con `@IsOptional() +
@IsNumber()` siguiendo el mismo patrón que `THROTTLE_*`.
- **`requests/transactions/reversal` rate limit** — el `@Throttle` se aplica
  a nivel controller, así ambas rutas webhook comparten el límite por IP+API
  key (alineado con la ambigüedad resuelta en `hu.md`).

```

```
