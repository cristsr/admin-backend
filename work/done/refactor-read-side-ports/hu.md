# refactor-read-side-ports: Puertos de lectura tipados para el read side del ledger

## Historia

**Como** mantenedor de `apps/ledger`
**Quiero** que cada caso de uso y servicio de aplicación lea a través de un puerto tipado
propio en lugar de hablarle al `ReadModelStore` genérico
**Para** que la capa de aplicación deje de conocer el esquema físico de las proyecciones
(nombres de tabla, `snake_case`, nulabilidad de columna) y para que el scope por usuario
y los filtros se resuelvan en la base y no en memoria (Art. 1, Art. 5)

> No es una historia de producto: es una refactorización interna sin cambio de contrato
> HTTP. Ningún `api.yaml` de módulo cambia. Origen y diseño completo en
> [`docs/proposals/read-side-ports.md`](../../../docs/proposals/read-side-ports.md).

## Criterios de Aceptación

### AC-1: `application/` no conoce el read model

Ningún archivo bajo `apps/ledger/src/**/application/` importa
`@cqrs/application/projection/read-model-store` ni `Criteria` de `@shared`. Las constantes
`PROJ_*` y los tipos `*Row` no existen fuera de `infrastructure/`.

### AC-2: El guard lo verifica en CI

`hexagonal-isolation.spec.ts` gana un tercer caso que falla si un archivo de `application/`
importa `read-model-store` o `Criteria`. El caso falla antes de la migración y pasa después.

### AC-3: El scope por usuario está en el `WHERE`

`GetAccountBalances` no trae de la base filas de balances que no sean del usuario del
contexto. Un test con dos usuarios y balances cruzados verifica que el segundo usuario no
aparece en el resultado **ni** en las filas leídas (INV-9, Art. 5).

### AC-4: Cada proyección declara su esquema una sola vez

Cada tabla `proj_*` tiene exactamente un archivo `infrastructure/projections/*.schema.ts`
con su constante `PROJ_*` y su tipo `*Row` completo (todas las columnas del DDL). No queda
ninguna declaración parcial duplicada de `AccountRow` ni de `PostingRow`.

### AC-5: Los `View` viven en `application/views/`

Los cinco módulos tienen `application/views/*.view.ts` con sólo el tipo `View`. La carpeta
`application/read-models/` no existe. Las funciones `to*View` viven en `infrastructure/`.

### AC-6: Nomenclatura de puertos verificable

Todo puerto de lectura nuevo se llama `*Finder` (consumido por query handlers, devuelve un
`View`), `*Reader` o `*Lookup` (consumido por el write side). Ningún puerto de lectura se
llama `*Repository`.

### AC-7: `RecordOpeningBalance` deja de leer la proyección directo

`RecordOpeningBalanceHandler` resuelve `Equity:OpeningBalances` por `SystemAccountLookup`.
Ningún command handler del ledger depende de `ReadModelStore`.

### AC-8: Los puertos de `ledger` están separados por responsabilidad

`proj_ledger_settings` se sirve por tres puertos —`LedgerSettingsFinder`,
`LedgerTimezoneReader`, `SystemAccountLookup`— y los dos puertos equivalentes de
`reconciliation` dejan de existir.

### AC-9: Las composiciones in-memory siguen verdes sin gemelos nuevos

Los e2e y las composiciones que montan el ledger sobre `InMemoryReadModelStore`
(`fixed-ledger-doubles.ts`, `ledger-application.spec.ts`, los `*.e2e.spec.ts`) pasan sin
cambios de comportamiento. El único puerto con adapter SQL —`TransactionFinder`— tiene un
gemelo in-memory y un contract test que corre contra ambos.

### AC-10: `ReadModelStore` conserva su rol

Los 8 projectors, el `ProjectionRebuilder` y las herramientas de `tooling/` siguen usando
`ReadModelStore`. La suite de rebuild y `consistency-verifier` pasan sin cambios de
contrato.

### AC-11: Sin cambio de contrato HTTP

Ningún `apps/ledger/docs/*/api.yaml` cambia. Los e2e de API existentes pasan sin tocar sus
expectativas de request ni de response.

## Reglas de Negocio

Ninguna nueva. Las existentes que la refactorización debe preservar sin duplicar:

- **INV-9 / Art. 5** — todo método de puerto recibe `userId` como primer parámetro.
- **INV-3 / INV-4 / INV-13** — las reglas siguen en `account-availability.ts` y en el
  agregado. `AccountConstraintsReader` devuelve datos, nunca veredictos (Art. 12).
- **Art. 10** — ningún puerto de lectura expone `save`; los projectors siguen siendo los
  únicos escritores.

## Fuera de alcance

- Mover el registro de query handlers de `createQueryBus` a cada módulo.
- Paginación por cursor.
- Cambios en `libs/cqrs`.
- Entidades TypeORM para las tablas `proj_*` (descartado en §2.3 del diseño).
