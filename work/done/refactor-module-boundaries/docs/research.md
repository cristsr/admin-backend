# research: refactor-module-boundaries

Tres decisiones no triviales. Las tres nacen de la tercera pasada de auditoría hexagonal y
ninguna estaba forzada por un patrón existente en `context.md`.

---

## Decisión 1: cómo `InitializeLedger` crea las cuentas técnicas

- **Contexto:** `initialize-ledger.handler.ts:87-98` construye `Account.open({…isSystem: true})`
  y lo persiste con `AccountRepository`, ambos del módulo `accounts`. Es el acceso directo al
  agregado de otro bounded context (Art. 10 de la skill, rules Art. 1 por extensión). El fix
  tiene que preservar INV-13 (las cuentas existen desde la inicialización) e INV-7 (settings y
  cuentas en una sola transacción), y no puede meter el dispatch de proyecciones dentro del
  scope transaccional, que `:76-77` evita a propósito.

- **Opciones evaluadas:**
  1. **`OpenSystemAccountCommand` propio de `accounts`** — command y handler dedicados, sin
     dispatch de proyecciones propio (lo hace el caller). `InitializeLedger` lo manda por el
     `CommandBus` dentro de su `withTransaction` y toma el id de `CommandResult.aggregateId`.
     *Pros:* no toca el contrato HTTP de `OpenAccount`; INV-13 queda explícito en un command
     con nombre propio; el handler puede no despachar proyecciones sin condicionar nada.
     *Contras:* una clase de command y un handler más.
  2. **Extender `OpenAccountCommand` con `isSystem`/`origin`** — análogo a `PostingOrigin.SYSTEM`
     en `RecordTransactionCommand`. *Pros:* menos clases. *Contras:* toca un command que hoy es
     HTTP-facing (`accounts.controller.ts`), y obliga a `OpenAccountHandler` a condicionar su
     dispatch de proyecciones (`open-account.handler.ts:45`) según quién lo llame — un `if` sobre
     el origen dentro de un handler que hoy no lo tiene.
  3. **Seeding por evento en `accounts`** — un reactor sobre `LedgerInitialized`. *Pros:*
     desacople total. *Contras:* rompe INV-7 (dos transacciones separadas) y obliga a cambiar
     `LedgerSettings.initialize`, que hoy exige los dos `accountId` en construcción
     (`initialize-ledger.handler.ts:60-61`).

- **Elegida:** opción 1 — `OpenSystemAccountCommand` en `accounts`. Es la única que satisface
  AC-3 conservando INV-7 e INV-13 sin cambiar un contrato público ni un agregado.

- **Descartadas por:** la 2 ensucia un command HTTP-facing con una preocupación interna; la 3
  rompe un invariante que el AC exige preservar.

- **Precedente que la sostiene:** `record-opening-balance.handler.ts:45` ya cruza a
  `transactions` despachando `RecordTransactionCommand` por el bus y protegiendo la cuenta
  técnica con `PostingOrigin.SYSTEM` (`:69`). El mecanismo está probado en producción del
  proyecto; lo que cambia es que acá el dispatch ocurre dentro de un `withTransaction` abierto
  por el caller.

- **Riesgo a cubrir con test:** `OpenAccountHandler` llama `names.ensureAvailable`
  (`:32`), que lee `proj_accounts`. En la inicialización esa proyección está vacía y el dispatch
  de la primera cuenta todavía no corrió, así que el chequeo de unicidad de la segunda no ve a
  la primera. Con nombres constantes y distintos (`Equity:OpeningBalances`, `Equity:Adjustments`)
  no hay colisión posible, pero el handler nuevo debe decidir explícitamente si valida unicidad
  o no — y el plan debe cubrirlo con un test, no dejarlo implícito.

---

## Decisión 2: qué raíz de composición queda como única

- **Contexto:** los puertos de lectura están bindeados en dos lugares —
  `bootstrap/read-side-ports.factory.ts` (que corre) y los `@Module` de Nest (seis providers que
  nadie resuelve, verificado consumidor por consumidor en `context.md`). Cambiar un adapter hoy
  es un cambio de dos líneas y una es silenciosa.

- **Opciones evaluadas:**
  1. **La factory de `bootstrap/`** — se borran los providers muertos; los dos puertos que Nest
     sí inyecta (`SystemAccountLookup`, `LedgerTimezoneReader`) se proveen con `useFactory` sobre
     la misma composición. *Pros:* es la raíz que ya corre; es la única que sirve a las
     composiciones in-memory y a los cinco e2e, que montan el ledger sin contenedor de Nest;
     elimina las dos instancias vivas del mismo adapter. *Contras:* el binding queda lejos del
     módulo dueño, que es lo idiomático en NestJS.
  2. **El contenedor de Nest** — cada módulo bindea y las factories reciben los puertos por DI.
     *Pros:* idiomático, binding cerca del dueño. *Contras:* obliga a `fixed-ledger-doubles.ts` y
     a los cinco `*.e2e.spec.ts` a levantar un `TestingModule` o a construir dobles de cada
     puerto; hoy componen sin Nest y eso es lo que los hace rápidos.
  3. **Mantener ambas con un test de coincidencia.** *Pros:* diff mínimo. *Contras:* deja en pie
     la duplicación que causó los seis providers muertos — el test detecta la divergencia, no la
     imposibilita.

- **Elegida:** opción 1 — la factory de `bootstrap/`. Decide el uso real, no la costumbre del
  framework: las composiciones sin Nest son ciudadanas de primera en este proyecto (Art. 1 de la
  constitución exige contract tests que corran idénticos contra el adapter real y el in-memory).

- **Descartadas por:** la 2 impone Nest a un núcleo que la constitución mantiene deliberadamente
  libre de él; la 3 no resuelve el defecto, solo lo vigila.

---

## Decisión 3: puerto vs. contrato documentado para los esquemas compartidos

- **Contexto:** tres archivos leen el `*.schema.ts` de una proyección ajena
  (`read-model-account-lookup.ts:7`, `transaction-list.projector.ts:8`,
  `read-model-assertion-posting-reader.ts:11`). El cuarto caso —`accounts` leyendo `proj_balances`—
  ya está documentado y justificado y queda fuera de alcance.

- **Opciones evaluadas:**
  1. **Documentar el contrato en los tres**, como ya hace `account-balances.schema.ts:6-13`, y
     declararlos como excepción con motivo en el guard del AC-2.
  2. **Puerto para los dos adapters, doc para el projector.**
  3. **Puerto en los tres**, incluido el projector.

- **Elegida:** opción 2, **con un ajuste** que la verificación posterior hizo necesario (abajo).

- **Descartada la 3 por:** metería un puerto inyectado en `TransactionListProjector`, cuando los
  otros ocho projectors reciben `(event, store)` y no inyectan nada. Rompería el patrón y
  complicaría `ProjectionRebuilder`, que los construye a mano.

### Ajuste sobre la opción elegida (verificado leyendo los dos adapters)

Los dos adapters no son simétricos, y aplicar la misma solución a ambos habría violado el
Simplicity Gate en el segundo:

**`ReadModelAccountLookup` (transactions → accounts): se aplica el puerto.**
Necesita `{ accountId, type, currency, isBankMirror }` (`:25-30`). El puerto candidato,
`AccountConstraintsReader`, devuelve `AccountConstraints` sin `isBankMirror`
(`account-constraints-reader.port.ts:11-20`), y su JSDoc declara que son "the facts a posting is
validated against" — `isBankMirror` no valida ningún posting, sirve a la detección de
transferencias. Meterlo ahí desvirtúa el tipo. Por eso el diseño agrega un puerto nuevo en
`accounts`, `AccountFactsReader`, con `factsOf(userId, accountId)`, y `ReadModelAccountLookup`
pasa a ser el **adaptador anti-corrupción** de `AccountLookup` (puerto local de `transactions`)
sobre él. Es exactamente el patrón que la skill prescribe para el cruce entre módulos.

**`ReadModelAssertionPostingReader` (reconciliation → transactions): se documenta, no se
enpuerta.** `AssertionPostingReader` **ya es** el puerto local de `reconciliation`
(`reconciliation/domain/ports/assertion-posting-reader.port.ts`), y su JSDoc ya declara el cruce:
*"This is the one permitted inter-aggregate read: no accounting invariant depends on it"*.
Ponerle debajo otro puerto en `transactions` sería un puerto envolviendo un puerto, con un shape
(`AssertablePosting` = `Money` + `LedgerDate` + `TransactionStatus`) que lo dicta el único
consumidor. Sería una abstracción sin segundo caso de uso: Simplicity Gate y Anti-Abstraction
Gate lo rechazan.

**Resultado:** un puerto nuevo (`AccountFactsReader`), y dos JSDoc de contrato
(`account-tree.schema.ts` para el projector, `transaction-list.schema.ts` para reconciliation),
ambos declarados como excepción con motivo en el guard del AC-2.
