# hu-0016: Re-evaluación de aserciones ante anulaciones — Plan de Implementación

**Historia:** `work/active/hu-0016/`
**App:** `apps/ledger`, módulo `reconciliation`
**Objetivo:** Que anular una transacción anterior al corte de una aserción vuelva a
evaluarla, cerrando el `TODO(reactor)` de RF-18.
**Arquitectura:** El reactor gana el disparador `TransactionVoided`. Como ese evento no
lleva postings, las cuentas tocadas se resuelven leyendo `proj_postings` por
`transaction_id` a través del puerto que el módulo ya usa para conciliar.
**Stack:** NestJS · TypeScript · event-sourcing · Jest

### Trazabilidad AC → Tareas

| AC | Cubierto por |
|----|-------------|
| AC-1 (`Voided` dispara re-evaluación) | Tarea 3 |
| AC-2 (`Confirmed`/`Reversed` sin disparador, con tests) | Tarea 4 |
| AC-3 (cuentas tocadas desde `proj_postings`) | Tarea 1, Tarea 2 |
| AC-4 (re-evaluar es idempotente) | Tarea 3 |
| AC-5 (revocadas nunca se re-evalúan) | Tarea 3 |
| AC-6 (cobertura de los flujos) | Tarea 3, Tarea 4 |

---

### Tarea 0: Rama — no aplica

Se trabaja en `feat/core`, como el resto de las HU del ledger. `/forge` no toca git.

---

### Tarea 1: Extender `AssertionPostingReader` con `touchedByTransaction` [X]

**Archivos:**
- Modificar: `apps/ledger/src/reconciliation/domain/ports/assertion-posting-reader.port.ts`

**Step 1: Agregar el tipo y la firma**

```typescript
/** An account touched by a transaction, with the transaction's accounting date. */
export interface TouchedAccount {
  readonly accountId: string;
  readonly date: LedgerDate;
}

// en la clase abstracta:
/**
 * Accounts posted to by one transaction, with its accounting date. Serves the
 * reactor when the triggering event carries no postings in its payload
 * (`TransactionVoided`). Includes VOIDED rows: the reactor needs to know which
 * accounts a now-voided transaction used to touch.
 */
abstract touchedByTransaction(
  userId: string,
  transactionId: string,
): Promise<readonly TouchedAccount[]>;
```

**Nota clave:** a diferencia de `byAccountUpToDate`, esta lectura **no** puede excluir los
`VOIDED` — justamente busca las cuentas de una transacción que acaba de anularse.

---

### Tarea 2: Implementar la lectura en el adaptador [X]

**Archivos:**
- Modificar: `apps/ledger/src/reconciliation/infrastructure/adapters/persistence/read-model-assertion-posting-reader.ts`
- Modificar: `apps/ledger/src/reconciliation/infrastructure/adapters/persistence/read-model-assertion-posting-reader.spec.ts` (o crear si no existe)

**Step 1: Test que falla** — sembrar `proj_postings` con dos postings de una transacción y
uno de otra; verificar que `touchedByTransaction` devuelve solo los dos primeros, con su
fecha, sin duplicar cuentas, y que filtra por `user_id`. Incluir el caso de una transacción
inexistente → `[]`.

**Step 2: Implementar** con `Criteria.none().equals('user_id', …).equals('transaction_id', …)`
sobre `PROJ_POSTINGS`, deduplicando por `account_id`.

---

### Tarea 3: `TransactionVoided` como disparador del reactor [X]

**Archivos:**
- Modificar: `apps/ledger/src/reconciliation/application/reactors/reevaluate-assertions.reactor.ts`
- Modificar: `apps/ledger/src/reconciliation/application/reactors/reevaluate-assertions.reactor.spec.ts`

**Step 1: Tests que fallan**
- Una aserción `MATCHED` sobre una cuenta se re-evalúa cuando se anula una transacción
  anterior a su corte (AC-1).
- Una aserción con corte **anterior** a la transacción anulada no se toca.
- Una aserción **revocada** no se re-evalúa (AC-5) — lo garantiza
  `nonRevokedOnAccountFrom`, el test lo fija.
- Reprocesar el mismo `TransactionVoided` despacha el command de nuevo pero no cambia el
  resultado (AC-4).

**Step 2: Implementar**
- Agregar `'TransactionVoided'` a `REEVALUATION_TRIGGERS`.
- En `touchedAccounts`, bifurcar: si el payload trae `postings`, seguir leyéndolo (camino
  actual de `Recorded`/`Amended`); si no, resolver por
  `AssertionPostingReader.touchedByTransaction`. Eso vuelve el método asíncrono —
  actualizar el `for` de `on()` en consecuencia.
- Inyectar el puerto en el constructor y actualizar el cableado del módulo.
- Borrar el `TODO(reactor)` del comentario de `REEVALUATION_TRIGGERS`.

---

### Tarea 4: Tests que documentan por qué `Confirmed` y `Reversed` no disparan (AC-2) [X]

**Archivos:**
- Modificar: `apps/ledger/src/reconciliation/application/reactors/reevaluate-assertions.reactor.spec.ts`

- **`TransactionConfirmed` no re-evalúa:** el reactor lo ignora, y un test a nivel
  evaluador confirma que el veredicto no cambia al pasar un posting de `PENDING` a
  `CONFIRMED` (mismo monto, misma población).
- **`TransactionReversed` queda cubierto:** el reactor lo ignora, pero el
  `TransactionRecorded` de la transacción de reversa —que sí lleva postings— dispara la
  re-evaluación por el camino de siempre.

Ambos con un comentario que explique la razón, para que un lector futuro no los tome por
un olvido.

---

### Tarea 5: Cableado y suite completa [X]

**Archivos:**
- Modificar: `apps/ledger/src/reconciliation/reconciliation.module.ts` (si cambia la
  construcción del reactor)

```bash
npx nx test ledger --skip-nx-cache
npx tsc -p apps/ledger/tsconfig.app.json --noEmit
npx eslint "apps/ledger/src/reconciliation/**/*.ts"
```
Esperado: verde, sin errores, sin errores de lint nuevos.
