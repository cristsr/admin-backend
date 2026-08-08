# design: refactor-module-boundaries

Refactorización interna de `apps/ledger` sin cambio de contrato. Cierra los hallazgos de la
tercera pasada de auditoría hexagonal (score 30/39): acoplamiento entre bounded contexts y
composición duplicada.

## Decisiones de Diseño

- **Creación de las cuentas técnicas en `InitializeLedger`:** `OpenSystemAccountCommand` propio
  del módulo `accounts`, despachado por el `CommandBus` dentro del `withTransaction` existente —
  no toca el contrato HTTP de `OpenAccount`, deja INV-13 explícito y permite que el handler no
  despache proyecciones. Ver [`docs/research.md`](./docs/research.md#decisión-1).
- **Raíz única de composición:** la factory de `bootstrap/`. Es la que ya corre y la única que
  sirve a las composiciones in-memory y a los cinco e2e, que montan el ledger sin Nest. Se borran
  los seis providers muertos. Ver [`docs/research.md`](./docs/research.md#decisión-2).
- **Esquemas compartidos:** puerto para el adapter de `transactions`, JSDoc de contrato para el
  projector y para el adapter de `reconciliation` — con el ajuste justificado en
  [`docs/research.md`](./docs/research.md#decisión-3), donde la verificación mostró que los dos
  adapters no son simétricos.
- **Barrels (AC-11): resuelto por la constitución, no por este diseño.** El Artículo 13 ya decidió
  imports por ruta completa, con barrels permitidos solo en cuatro conjuntos cerrados —uno de
  ellos "puertos de un módulo"—, y lo documenta como desviación deliberada de la skill
  `hexagonal-architecture` "para que no se reabra en cada review". AC-11 se reinterpreta en
  consecuencia: **no** se eliminan los barrels ni se agregan nuevos; lo único que se corrige es
  que `transactions/application/ports/index.ts` exporte los 4 puertos y no 2, porque un conjunto
  cerrado incompleto es lo que el Artículo describe como no-cerrado. Que
  `transactions.module.ts` importe por ruta completa es correcto bajo Art. 13 y se deja como está.

## Resumen

Cinco cambios, ninguno con efecto observable sobre la API:

1. **Kernel compartido.** `PostingLine` y `TransactionStatus` se mueven de `transactions/domain/`
   a `shared/domain/`, junto a `PostingOrigin`, que ya vivía ahí por la misma razón. Elimina de
   una sola vez los siete imports de `domain/` ajeno.
2. **El cruce `ledger → accounts` pasa por el bus.** `InitializeLedgerHandler` deja de construir
   el agregado `Account`; despacha `OpenSystemAccountCommand`. Único flujo con cambio interno.
3. **El composition root sale del módulo de negocio.** `LedgerCoreModule` se mueve de
   `src/ledger/` a `src/bootstrap/`, junto a las tres factories que ya viven ahí. Rompe el ciclo
   `ledger ↔ reference`.
4. **Una sola raíz de composición.** Se borran los seis providers de Nest que nadie resuelve; los
   dos que sí se inyectan (`SystemAccountLookup`, `LedgerTimezoneReader`) pasan a `useFactory`
   sobre la misma composición, eliminando las dos instancias vivas del mismo adapter.
5. **Fronteras de lectura.** `ReadModelAccountLookup` pasa a delegar en `AccountFactsReader`
   (puerto nuevo de `accounts`); el projector y el reader de `reconciliation` declaran su contrato
   en JSDoc y quedan como excepción explícita del guard.

Todo esto queda protegido por un cuarto caso en `hexagonal-isolation.spec.ts` (AC-2) y un test de
doble binding en `app.wiring.spec.ts` (AC-6): sin ellos, la próxima historia reintroduce el mismo
acoplamiento sin que nada falle — que es exactamente cómo llegó hasta acá.

## Flujos afectados

| Flujo | Módulo | Operación | Trigger | Entrypoint |
|---|---|---|---|---|
| [`initialize-ledger`](./docs/flows/initialize-ledger.md) | accounts | `modify` | rest | `POST /ledger/initialize` |

Ningún otro flujo cambia. `OpenSystemAccountCommand` no genera flujo propio: no tiene trigger
externo (no encaja en `TRIGGER_TAXONOMY`) — es un paso interno del flujo de arriba y se modela
como componente, no como caso de uso.

## Componentes del módulo

Delta completo en [`docs/model.delta.c4`](./docs/model.delta.c4), validado con
`npx likec4 validate` (✓ Valid, 8 files).

- **`accounts`** — nuevos: `InitializeLedgerHandler` (existía en código, no estaba modelado),
  `OpenSystemAccountHandler`, `AccountFactsReader`.
- **`shared`** — nuevos: `PostingLine` y `TransactionStatus` (movidos desde `transactions`),
  `LedgerCoreModule` (movido desde `ledger`).
- **`transactions`** — `PostingLine` marcado `#delta-changed` (se va al kernel); nuevo
  `ReadModelAccountLookup` como adaptador anti-corrupción.

### Instrucción de reconciliación para `/sync`

La vista `initializeLedgerDelta` del delta es **temporal**. `likec4.config.json` excluye
`work/done/**` pero no `work/active/**`, así que el delta entra al modelo mientras vive activo y
no puede llevar el id real sin duplicar la vista `initializeLedger` de `accounts.c4`. Al
reconciliar: reemplazar el cuerpo de `initializeLedger` con los pasos de la temporal, quitar el
prefijo `[CHANGED]` del title, y borrar `initializeLedgerDelta`.

## Contrato API

**Sin cambios.** No se genera `docs/api.delta.yaml`: ningún path, operación ni schema de
`apps/ledger/docs/*/api.yaml` se agrega ni se modifica (AC-12). Los cinco `*.e2e.spec.ts` de API
son la verificación de que sigue siendo cierto — deben pasar sin tocar una sola expectativa.

Por lo mismo no corresponde correr `oasdiff`: no hay delta de contrato que clasificar.

## Modelado de datos

**Sin cambios.** No se agrega ni modifica ninguna tabla, columna ni migración. Las tablas `proj_*`
conservan su esquema; lo que cambia es qué módulo declara el contrato de lectura sobre ellas.

## Impacto en Arquitectura Global

**¿Toca arquitectura global? No.**

No hay app nueva, ni módulo nuevo, ni integración nueva o eliminada con un sistema o actor
externo. Los cinco módulos de `apps/ledger` listados en `context.md` siguen siendo los mismos, y
`libs/cqrs` no se toca. `LedgerCoreModule` se mueve **dentro** de la misma app, de una carpeta a
otra: es un cambio de C4 Nivel 3, ya cubierto por el delta. `/sync` no necesita invocar
`/architecture`.

## Validación de Quality Gates

| Gate | Resultado | Justificación |
|------|-----------|---------------|
| Simplicity | ✅ | Se agrega **un** puerto (`AccountFactsReader`) y **un** command (`OpenSystemAccount`), ambos con consumidor presente. El segundo puerto que la decisión 3 sugería se descartó explícitamente por no tener segundo caso de uso — ver el ajuste en `research.md`. El neto es negativo: se borran 6 providers y 1 función (`toBalanceView` se mueve, no se duplica). |
| Anti-Abstraction | ✅ | No se envuelve ningún framework. Se evitó envolver `AssertionPostingReader` —que ya es el puerto— en un segundo puerto de `transactions`, que habría sido abstracción sobre abstracción. |
| Integration-First | ✅ | No hay contrato HTTP nuevo que definir. El equivalente acá son los contract tests existentes (`transaction-finder.contract.ts`, los dos de `reconciliation`), que siguen corriendo idénticos contra el adapter real y el in-memory, como exige el Artículo 1. |
| Test-First | ✅ | AC-2 y AC-6 son tests que **deben fallar antes** del refactor y pasar después — el guard de módulos y el de doble binding. `/plan` los ordena primero, y son la red que hace seguro el resto de los movimientos. |

### Artículos de la constitución verificados

- **Art. 1 (núcleo aislado):** se refuerza — el guard gana un caso.
- **Art. 10 (CQRS estricto):** `OpenSystemAccountHandler` devuelve `CommandResult`
  (`aggregateId` + `streamPosition`), nunca una representación de lectura. Los projectors siguen
  siendo los únicos escritores.
- **Art. 13 (imports por ruta completa):** respetado; corrige la lectura de AC-11 (ver Decisiones).
- **Art. 4 (TDD estricto):** todo el refactor va con test previo; no hay backfill.

Sin excepciones a la constitución.

## Riesgos conocidos

1. **`ensureAvailable` sobre proyección vacía.** Si `OpenSystemAccountHandler` reusa la validación
   de unicidad de nombre, en la inicialización lee `proj_accounts` antes de que el dispatch de la
   primera cuenta haya corrido. Con nombres constantes y distintos no hay colisión, pero el
   handler debe decidirlo explícitamente y el plan debe cubrirlo con un test.
2. **`tooling/` importa los schemas afectados.** `consistency-verifier.ts:13`,
   `rebuild.command.ts:26` y tres specs importan `PROJ_BALANCES`. AC-7 solo mueve `toBalanceView`,
   no la constante, pero el plan debe verificar que la suite de rebuild siga verde.
3. **`LedgerCoreModule` es `@Global()`.** Al moverlo, los siete módulos que heredan sus providers
   deben seguir resolviéndolos; `app.wiring.spec.ts` lo cubre.
4. **`accounts.module.ts` queda sin providers.** Es correcto, pero conviene decidir en el plan si
   sobrevive como declaración de imports o se fusiona con `AccountsHttpModule`.
