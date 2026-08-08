# refactor-module-boundaries: Fronteras reales entre los bounded contexts del ledger

## Historia

**Como** mantenedor de `apps/ledger`
**Quiero** que cada módulo deje de alcanzar el `domain/` y la `infrastructure/` de sus
vecinos, y que cada puerto tenga un único binding vivo
**Para** que los cinco contextos puedan evolucionar por separado y para que cambiar un
adapter sea un cambio de una línea con efecto observable (Art. 1, Art. 10)

> No es una historia de producto: es una refactorización interna sin cambio de contrato
> HTTP. Ningún `api.yaml` de módulo cambia. Origen: tercera pasada de la auditoría
> hexagonal (2026-08-08), score 30/39. Las dos pasadas previas están cerradas en
> [`work/active/audit-hexagonal-ledger.md`](../audit-hexagonal-ledger.md).

## Criterios de Aceptación

### AC-1: `PostingLine` y `TransactionStatus` viven en el kernel compartido

Ambos tipos están en `apps/ledger/src/shared/domain/`, junto a `PostingOrigin`, que ya
estaba ahí por la misma razón. Ningún archivo bajo `apps/ledger/src/<módulo>/` importa
`@ledger/<otro-módulo>/domain/...`. Los seis imports actuales quedan en cero.

### AC-2: El guard verifica el acoplamiento entre módulos en CI

`hexagonal-isolation.spec.ts` gana un caso que falla si un archivo de un módulo importa
`@ledger/<otro>/domain` o `@ledger/<otro>/infrastructure`. El caso falla antes de la
migración y pasa después. Las excepciones que el diseño decida conservar se declaran como
lista explícita en el propio test, con el motivo de cada una — nunca por omisión del
detector.

### AC-3: `InitializeLedger` no construye el agregado `Account`

`initialize-ledger.handler.ts` no importa `Account` ni `AccountRepository`. Las dos cuentas
técnicas se crean por el mecanismo que el diseño elija (ver «Decisiones abiertas»),
preservando:

- **INV-13** — `Equity:OpeningBalances` y `Equity:Adjustments` existen desde la
  inicialización y son `isSystem: true`.
- **INV-7** — los tres appends (settings + dos cuentas) siguen ocurriendo dentro de un
  único `eventStore.withTransaction`.
- El despacho de proyecciones sigue **fuera** del scope transaccional.

Un test verifica que un fallo a mitad de la inicialización no deja cuentas técnicas sin
`LedgerSettings` ni settings apuntando a cuentas inexistentes.

### AC-4: El composition root no vive dentro de un módulo de negocio

`LedgerCoreModule` está en `apps/ledger/src/bootstrap/`, junto a las factories que ya viven
ahí. `apps/ledger/src/ledger/` contiene únicamente el contexto de settings. El ciclo
`ledger → reference → ledger` desaparece: ningún módulo importa la `infrastructure/` de
otro para bindear un provider.

### AC-5: `ReferenceModule` depende del puerto, no de la clase concreta

`reference.module.ts` inyecta `CurrencyCatalogCache`, no `ReadModelCurrencyCatalog`. El
binding de ese puerto existe en el composition root.

### AC-6: Un solo binding vivo por puerto de lectura

Cada puerto de lectura se ata a su adapter en exactamente un lugar. No queda ningún
provider de Nest que nadie resuelva: cambiar el adapter de `AccountTreeFinder`,
`AccountBalanceFinder`, `AccountConstraintsReader`, `AccountNameReader`,
`CurrencyCatalogFinder` o `LedgerSettingsFinder` altera el comportamiento observable de la
app en un único punto. `SystemAccountLookup` y `LedgerTimezoneReader` dejan de tener dos
instancias vivas según por dónde entre la llamada.

Un test de wiring falla si un puerto queda bindeado en dos raíces de composición.

### AC-7: El acoplamiento del read model es unidireccional

`transactions/infrastructure/projections/account-balances.schema.ts` no importa nada de
`accounts/`. `toBalanceView` vive del lado que ya conoce `BalanceView` y `BalanceRow`.

### AC-8: Los esquemas compartidos entre módulos declaran su contrato

Cada `*.schema.ts` que otro módulo lee declara en su JSDoc quién lo escribe, quién lo lee y
por qué —como ya hace `account-balances.schema.ts:6-13`— o el consumidor pasa a leerlo por
un puerto del módulo dueño. Aplica a `account-tree.schema.ts` (leído por `transactions` en
dos archivos) y a `transaction-list.schema.ts` (leído por `reconciliation`).

### AC-9: Topología sin archivos fuera de su carpeta-rol

- `read-model-currency-catalog.ts` está bajo `reference/infrastructure/adapters/persistence/`.
- `page-request.type.ts` está bajo `transactions/application/types/`.
- `transfer.exception.ts` está junto al concepto que lo levanta; `transactions/domain/`
  no tiene una carpeta `exceptions/` técnica en su raíz.
- `StaticCurrencyCatalogCache` no vive en `application/ports/`; esa carpeta contiene solo
  contratos abstractos.

### AC-10: Nomenclatura de puertos uniforme

Todo puerto termina en `.port.ts`. `ledger-context-resolver.ts` y `currency-catalog.cache.ts`
quedan alineados con los otros dieciséis.

### AC-11: Los barrels son una decisión, no una mezcla

O cada carpeta con contenido exporta un `index.ts` completo y los imports pasan por él, o
no hay barrels y todo import es por ruta explícita. No quedan barrels parciales:
`transactions/application/ports/index.ts` hoy exporta 2 de 4 puertos y `transactions.module.ts`
lo saltea igual.

### AC-12: Sin cambio de contrato ni regresión

Ningún `apps/ledger/docs/*/api.yaml` cambia. Los e2e de API pasan sin tocar sus
expectativas. Las suites de `ledger` y `cqrs` quedan verdes con el mismo número de tests o
más.

## Reglas de Negocio

Ninguna nueva. Las existentes que la refactorización debe preservar sin duplicar:

- **INV-13** — las cuentas técnicas solo aceptan postings de origen sistema, y existen
  desde la inicialización del ledger.
- **INV-7** — settings y cuentas técnicas se escriben en una sola transacción.
- **INV-9 / Art. 5** — todo método de puerto recibe `userId`; el scope se resuelve en la base.
- **Art. 10** — los projectors siguen siendo los únicos escritores de las tablas `proj_*`.

## Decisiones abiertas (para `/design`)

1. **Cómo crea `InitializeLedger` las cuentas técnicas (AC-3).** Despachar
   `OpenAccountCommand` por el `CommandBus` —la ruta que ya toma
   `RecordOpeningBalanceHandler`— no es un reemplazo directo: el command no tiene `isSystem`
   (`open-account.command.ts:7-14`), el handler lo fija en `false`
   (`open-account.handler.ts:40`) y despacha proyecciones por su cuenta
   (`open-account.handler.ts:45`), lo que las metería dentro del scope transaccional. Las
   opciones a evaluar son: extender el command con `isSystem` protegido por origen —análogo
   a `PostingOrigin.SYSTEM` en `RecordTransactionCommand`—, exponer un
   `OpenSystemAccountCommand` propio del módulo `accounts`, o mover el seeding entero a
   `accounts` y que `ledger` lo consuma por evento.
2. **Puerto vs. contrato documentado para los esquemas compartidos (AC-8).** Documentar es
   barato y no cambia comportamiento; el puerto es correcto pero agrega indirección al
   camino de un projector. Puede resolverse distinto por caso.
3. **Barrels: completar o eliminar (AC-11).** Ambas son defendibles; hay 6 barrels contra
   ~90 carpetas con contenido, lo que sugiere eliminar, pero es una decisión de estilo con
   impacto en todo el árbol.

## Fuera de alcance

- Reemplazar `| null` por `Nullable<T>` en los tres projectors que lo usan — es estilo, no
  arquitectura; va por la skill `typescript`.
- Cambios en `libs/cqrs`.
- Mover el registro de query handlers de `createQueryBus` a cada módulo (ya declarado fuera
  de alcance en `refactor-read-side-ports`).
- Reabrir la convención de que `accounts` lee `proj_balances`, escrita por `transactions`:
  está documentada y justificada en `account-balances.schema.ts:6-13`. Solo se corrige la
  dirección inversa (AC-7).
- Cualquier cambio de contrato HTTP o de esquema de base.
