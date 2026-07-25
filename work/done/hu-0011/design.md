# design: hu-0011

## Decisiones de Diseño

- **Status de `ACCOUNT_CLOSED`:** **422** (se mantiene el código implementado) —
  posting a cuenta cerrada (INV-3) es una violación semántica del payload que el
  cliente corrige eligiendo otra cuenta, misma categoría que `CURRENCY_NOT_ALLOWED`;
  el mapping-spec ya lo congeló así con rationale explícito. Se corrige AC-2 de la
  HU vía `/refine`.
- **Status de `LEDGER_NOT_INITIALIZED`:** **422** (se mantiene el código
  implementado) — se agrega la fila faltante al mapping-spec y se corrige AC-2 de
  la HU vía `/refine`.
- **Ubicación de `LEDGER_ERROR_CODE`:** se mantiene en
  `apps/ledger/src/shared/domain/errors/ledger-error-code.ts` — los códigos son
  contrato de dominio (Art. 1: el dominio no importa desde `infrastructure/`) y no
  existe ningún adapter `http/` bajo shared-kernel. Se corrige la HU vía `/refine`.
- **Alcance de la tabla RF-14:** se suman **settings y Money** — las excepciones de
  settings (`InvalidCurrencyCodeException`, `InvalidTimeZoneException`) se
  reclasifican dentro de `DomainException` y las de Money reciben `code` propio;
  los 6 códigos entran a `LEDGER_ERROR_CODE` y al mapping-spec (aditivo).

## Flujo entre componentes

Cualquier `DomainException` lanzada durante el dispatch de un command/query burbujea
hasta el `ExceptionFilter` global (ya registrado en `main.ts`), que responde
`ErrorResponseBody` con el `status` de la familia y el `code` estable de
`LEDGER_ERROR_CODE`; un error no tipado → 500 sin `code`. Esta HU **congela** ese
mapeo como contrato: 6 códigos nuevos (settings + Money), 1 fila faltante
(`LEDGER_NOT_INITIALIZED`) y la documentación del flujo. El diagrama del flujo es la
dynamic view `shared_http_map_domain_error` en `docs/model.delta.c4`.

## Flujos afectados

| Operación | Slug | Módulo | Trigger | Entrypoint |
|---|---|---|---|---|
| `create` | `map-domain-error` | shared | rest | `ALL /api/v1/*` |

Flujo nuevo — el inventario de `docs/shared/` (`command-dispatch`, `query-dispatch`,
`get-swagger-docs`) no cubría el mapeo de errores.

## Componentes del módulo

Dos componentes nuevos en `admin.ledger.shared` (ver `docs/model.delta.c4`):
`ExceptionFilter` (filter global de `@shared`, documentado por primera vez) y
`LEDGER_ERROR_CODE` (const de dominio, fuente única RF-14). A nivel de código, la HU
toca además: `settings.exception.ts` (reclasificación de 2 excepciones),
`money.exception.ts` (4 `code` propios) y `ledger-error-code-mapping.spec.ts`
(7 filas nuevas).

## Impacto en Arquitectura Global

**¿Toca arquitectura global?** No.

El alcance es interno al módulo `shared` de `apps/ledger` (más reclasificación de
excepciones en `settings` y `shared/domain/money`): no hay app/módulo/integración
nueva que cruce el boundary del módulo — el `ExceptionFilter` ya venía de
`libs/shared` y ya estaba registrado globalmente.

- **Nivel:** N/A
- **Cambio:** ninguno
- **Nodo/arista concreto:** N/A

## Contratos por componente

### ledger (app)

Sin endpoints nuevos ni modificados. El delta de API aporta únicamente los schemas
transversales del cuerpo de error:

| Schema | Descripción de negocio |
|---|---|
| `ErrorResponseBody` | Cuerpo uniforme de toda respuesta de error: `{ statusCode, error, message, code?, path, timestamp }` |
| `LedgerErrorCode` | Enum estable de 17 códigos RF-14 (fuente única `LEDGER_ERROR_CODE`); branching del consumidor |

> Schemas completos: `docs/api.delta.yaml` (tag `shared`). La tabla semántica
> código → condición → status está en `docs/flows/map-domain-error.md`.

## Validación de Quality Gates

| Gate | Resultado | Justificación |
|------|-----------|---------------|
| Simplicity | ✅ | Cero capas/abstracciones nuevas: se reusan el filter, la jerarquía `DomainException` y el const ya existentes; los 6 códigos nuevos responden a excepciones reales ya lanzadas |
| Anti-Abstraction | ✅ | Se usa directo el mecanismo de NestJS (`@Catch()` filter de `@shared`) y `extends` de las familias existentes — sin wrappers ni filters por familia |
| Integration-First | ✅ | Contrato (`api.delta.yaml` + enum de 17 códigos) y contract test tabular (7 filas nuevas) definidos antes de tocar implementación |
| Test-First | ✅ | `/plan` escribirá primero las filas del mapping-spec (rojo) y luego la reclasificación/códigos (verde) — TDD estricto (Art. 4) |

## Riesgos conocidos / observaciones

- **Refactor pendiente (fuera de alcance):** el módulo `settings` duplica el VO
  `CurrencyCode` del shared-kernel (con su propia `InvalidCurrencyCodeException`).
  Esta HU unifica el **code** expuesto (`INVALID_CURRENCY_CODE`) pero no deduplica
  el VO — ver `docs/research.md`, decisión 1.
- **Códigos fuera del const (preexistente):** las excepciones de VO del
  shared-kernel (`INVALID_ACCOUNT_NAME`, `UNKNOWN_CURRENCY`, `INVALID_LEDGER_DATE`,
  `INVALID_PAYEE`, `ROOT_TYPE_IMMUTABLE`) y las de buses (`UNREGISTERED_COMMAND`,
  etc.) ya exponen `code` sin estar en `LEDGER_ERROR_CODE`. No se tocan en esta HU;
  si se quieren en contrato, entran como aditivos en su propia historia.
- **Colisión de nombre en imports:** al agregar la fila de settings al
  mapping-spec, su `InvalidCurrencyCodeException` colisiona en nombre con la del
  shared-kernel — el test debería usar import con alias.
- **`npx likec4 validate` preexistente:** el workspace reporta 1 error de *layout
  drift* en la view `accountsComponents` (`docs/accounts/accounts.c4`), anterior a
  este delta. Este delta no introduce errores nuevos.
