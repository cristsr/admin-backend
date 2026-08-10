# hu-0026: Fecha efectiva elegible en la reversa

> Origen: [`docs/proposals/formance-ledger-ideas.md`](../../../docs/proposals/formance-ledger-ideas.md)
> — hallazgo **F-13**.
> Épica: [EP-6](../../ledger/EP-6-formance.md), Ola 1.

## Historia de Usuario

**Como** usuario que corrige un error contable
**Quiero** elegir si la reversa de una transacción confirmada se asienta en la fecha original o
en la fecha de hoy
**Para** poder corregir el saldo histórico cuando el período sigue abierto, y dejarlo intacto
cuando el período ya fue conciliado y cerrado

## Criterios de Aceptación

### AC-1: `atEffectiveDate` es un parámetro explícito del comando

`ReverseConfirmedTransaction` acepta `atEffectiveDate: boolean`:

- `true` → la transacción de reversa nace con la **fecha contable de la original**. Corrige el
  saldo histórico y dispara la re-evaluación de las aserciones posteriores (RF-18).
- `false` → la reversa nace con la **fecha de hoy**. El saldo histórico queda intacto; las
  aserciones anteriores a hoy no se ven afectadas.

El default es `true`, que es el comportamiento actual
(`reverse-confirmed-transaction.handler.ts:51` copia `date: original.date`) y el
contablemente correcto por omisión.

### AC-2: El efecto sobre la conciliación queda documentado

`§7.3` de la especificación describe el flujo de corrección pero no dice con qué fecha nace la
reversa. Tras esta historia lo dice, y explica la consecuencia de cada opción sobre las
aserciones de saldo posteriores.

Hoy la decisión existe solo en el código, sin quedar registrada como decisión.

### AC-3: La doble reversa tiene un código de error estable

Revertir dos veces la misma transacción confirmada ya está impedido
(`ledger-transaction.aggregate.ts:174-176`), pero lanza `InvalidTransactionStateException`, un
error genérico que el cliente no puede distinguir de cualquier otro estado inválido.

Tras esta historia el rechazo usa el código estable `TRANSACTION_ALREADY_REVERSED` (RF-14),
mapeado a HTTP 409.

### AC-4: El endpoint expone la elección

`POST /transactions/{id}/reverse` acepta el parámetro y lo propaga al comando. Si el cliente no
lo envía, aplica el default de AC-1 — el contrato sigue siendo compatible con quien no lo
conozca.

## Reglas de Negocio

- La elección de fecha **no** relaja INV-6: los atributos económicos de la confirmada original
  siguen siendo inmutables. Lo que se elige es la fecha de la transacción **nueva** de reversa,
  no una modificación de la original.
- `force` de Formance no se adopta: presupone que el ledger autoriza movimientos por
  disponibilidad de fondos, y este ledger **registra lo que ya ocurrió** (principio de diseño
  #6). Un sobregiro real debe poder registrarse.

## Fuera de Alcance

- Cualquier cambio al vínculo `reverses_id` entre la original y la reversa: ya existe y
  funciona (§3.4).
