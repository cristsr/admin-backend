# hu-0009: Andamiaje del adaptador HTTP — OpenAPI/versionado + patrón controller→bus

## Historia de Usuario

**Como** desarrollador del adaptador conductor (driving) de `apps/ledger`
**Quiero** el esqueleto OpenAPI con versionado por URI y un patrón canónico de controller que
traduce HTTP a los buses de aplicación (command bus / query bus) sin lógica de dominio
**Para** disponer de la base compartida sobre la que se construyen todos los endpoints de
negocio (cuentas y transacciones), con un contrato publicado y estable desde el día uno

> Corresponde a **EP-2.1 + EP-2.2** del [roadmap del ledger](../../../ledger-roadmap.md).
> Detalle técnico: `work/ledger/EP-2-api.md` (secciones EP-2.1 y EP-2.2). Es el andamiaje
> base de EP-2; depende del command bus/handlers (`hu-0005`) y del query bus (`hu-0006`).

## Criterios de Aceptación

### AC-1: Versionado por URI con prefijo global `api`

`main.ts` habilita `app.setGlobalPrefix('api')` y
`app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })`. Todos los recursos
resuelven bajo `/api/v1/...`. Un controller sin `@Version` explícito responde en la versión
por defecto `1`.

### AC-2: Swagger servido fuera de producción

`GET /api/docs` sirve la UI de Swagger (`SwaggerModule.setup('docs', ...)`) cuando el
entorno no es producción (`NODE_ENV !== 'production'`), y no la expone en producción
(`NODE_ENV === 'production'`). El `ledger-swagger.builder.ts` declara título, versión del
documento y los esquemas de seguridad, aplicándolos globalmente. Swagger no respeta el
versionado URI (`/api/v1/docs` no existe — `VersioningType.URI` no aplica a rutas de
infraestructura registradas vía `SwaggerModule.setup`).

### AC-3: Esquemas de seguridad declarados

El documento OpenAPI declara dos esquemas de seguridad: `gatewayContext` (headers de contexto
firmados por el gateway) y `bearerAuth` (JWT). El esquema por defecto aplicado es
`gatewayContext`; ambos quedan disponibles para la decisión definitiva del servicio de
identidad.

### AC-4: Un controller solo traduce HTTP → bus (RNF-10)

El patrón canónico de controller construye un command a partir de fuentes disjuntas (contexto,
`external_ref`, body) y lo despacha al `CommandBus`, o traduce a un query y lo pregunta al
`QueryBus`. Un método de controller no reconstruye agregados, no toca el `EventStore`, no lee
proyecciones para decidir una escritura ni aplica reglas de negocio: la única lógica permitida
es mapeo de forma (DTO ↔ command/query, read model → response DTO).

### AC-5: Toda escritura retorna `CommandAcceptedDto`, nunca una vista

Una escritura retorna un `CommandAcceptedDto` con `{ id, streamPosition }` derivado del
`CommandResult` (el `streamPosition` — `bigint` en el núcleo — se serializa como string
decimal para JSON); jamás una representación de lectura del recurso (RNF-10). Si el cliente
quiere ver el recurso, hace un `GET` posterior.

### AC-6: Los controllers dependen solo de los buses

Los controllers dependen exclusivamente de `CommandBus`/`QueryBus` (más los decoradores de
contexto), nunca de puertos de infraestructura (`EventStore`, repositorios). Esto es
verificable por ausencia de tales dependencias en el constructor.

### AC-7: Wiring del contenedor

Cada controller resuelve sus dependencias (`CommandBus`, `QueryBus`) del contenedor de Nest
(test de wiring espejo de `apps/finances/src/app.wiring.spec.ts`).

## Reglas de Negocio

- **RNF-10 (segregación CQRS estricta)**: escrituras al command bus, lecturas al query bus;
  ninguna otra lógica en el controller.
- **RNF-11 (aislamiento hexagonal)**: el núcleo (Domain + Application) no conoce NestJS; los
  adaptadores HTTP viven en `shared/infrastructure/adapters/http/` (no en
  `shared-kernel/` — esa capa aloja el núcleo hexagonal de dominio y aplicación).
- Versionado por URI elegido sobre header/media-type por ser el más explícito para clientes
  heterogéneos y el más simple de enrutar en un gateway. Un cambio incompatible abre
  `/api/v2` conviviendo con `/api/v1` (`@Version('2')` selectivo).
- El OpenAPI se genera desde el código (decoradores `@nestjs/swagger`); disciplina de
  decoradores `@Api*` para que el documento publicado no divergir de la implementación.
- Reuso de plataforma: se reutiliza el Swagger builder y el patrón de `libs/shared`; **no** se
  reutiliza el dominio de `finances`.
- TDD estricto.

## Fuera de Alcance

- Endpoints de negocio concretos (cuentas → `hu-0013`, transacciones → `hu-0014`).
- El guard de contexto autenticado (RF-26) → `hu-0010`.
- El exception filter y los códigos de error estables → `hu-0011`.
- Read-your-writes e idempotencia por `external_ref` → `hu-0012`.

## Resolución de Ambigüedades

- **AC-2:** ¿Qué valor de `NODE_ENV` se considera "producción" para deshabilitar Swagger?
  → `NODE_ENV === 'production'` (estándar universal Node.js/NestJS).

## Technical Context

### Microservicio objetivo
- `apps/ledger`

### Artefactos a reutilizar
- `CommandBus`, `QueryBus`, `CommandResult` — de `hu-0005` / `hu-0006` (puertos de aplicación).
- `swagger.builder.ts` de `apps/finances/src/config/swagger/` como espejo (`DocumentBuilder`,
  `maybeMountSwagger`).
- Patrón de `app.wiring.spec.ts` de `apps/finances`.

### Artefactos a crear
- `apps/ledger/src/config/swagger/ledger-swagger.builder.ts` + `index.ts`.
- Ajuste de `apps/ledger/src/main.ts`: versionado URI + montaje de swagger.
- `apps/ledger/src/shared-kernel/infrastructure/adapters/http/dto/command-accepted.dto.ts`
  (+ `index.ts` de dto y de http).

### Patrones obligatorios
- Controller → command bus / query bus, sin lógica de dominio (RNF-10).
- `CommandAcceptedDto.from(result)` como única forma de respuesta de escritura.
- Alias de paths `@ledger/*` y `@shared`.
- TDD estricto.

### Restricciones técnicas
- El controller nunca conoce agregados ni eventos, solo commands/queries de aplicación.
- Escrituras nunca devuelven una vista de lectura.

### Decisiones abiertas (heredadas de EP-2, Apéndice C)
- Formato del contexto autenticado (headers firmados / JWT / mTLS) — abstraído en `hu-0010`,
  no bloquea esta HU.
