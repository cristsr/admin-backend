# Diagrama de flujo: sm-0001

Historia transversal: un diagrama por flujo relevante. Todos ocurren en el microservicio **finances** salvo donde se indique el hop a `users` o `exchanges`.

## AC-1 — Notificación de umbral de presupuesto (mensajería async)

```mermaid
sequenceDiagram
  actor Usuario
  participant Fin as finances (HTTP)
  participant MovH as MovementSavedEventHandler
  participant DB as PostgreSQL
  participant Cola as Cola PGMQ (budget.threshold)
  participant Cons as Consumidor externo

  Usuario->>Fin: POST /movements (MovementInput)
  Fin->>DB: guardar movimiento + emit movement.saved
  MovH->>DB: findActiveMatching + sumAmount(EXPENSE)
  MovH->>MovH: percentage ≥ umbral?
  alt cruza umbral no notificado aún (budgets.notified_threshold)
    MovH->>DB: UPDATE budgets SET notified_threshold
    MovH->>Cola: publish BudgetThresholdExceeded (payload)
    Cons-->>Cola: consume (entrega la notificación)
  else umbral ya notificado en este período
    MovH->>MovH: no reemite
  end
  Fin-->>Usuario: MovementOutput
```

## AC-2 — Balance consolidado en moneda de presentación

```mermaid
sequenceDiagram
  actor Usuario
  participant Fin as finances
  participant Ex as exchanges
  participant DB as PostgreSQL

  Usuario->>Fin: GET /summary/balance (JWT con presentationCurrency)
  Fin->>DB: saldos por cuenta (agregación SQL)
  loop cuentas en otra moneda
    Fin->>Ex: GET tasa(from, presentationCurrency, fecha)
    Ex-->>Fin: rate (o más cercana anterior)
  end
  Fin-->>Usuario: ConsolidatedBalanceResponse
```

## AC-2 — Transferencia cross-currency

```mermaid
sequenceDiagram
  actor Usuario
  participant Fin as finances
  participant Ex as exchanges
  participant DB as PostgreSQL

  Usuario->>Fin: POST /transfers (TransferInput)
  Fin->>DB: findByIdAndUser(from), findByIdAndUser(to)
  alt monedas distintas
    Fin->>Ex: GET tasa(from.currency, to.currency, date)
    Ex-->>Fin: exchangeRate
    Fin->>Fin: toAmount = amount * exchangeRate
  else misma moneda
    Fin->>Fin: exchangeRate = 1, toAmount = amount
  end
  Fin->>DB: saveAll([TRANSFER_OUT(from,amount), TRANSFER_IN(to,toAmount)]) (transacción)
  Fin-->>Usuario: TransferOutput (con toAmount, toCurrency, exchangeRate)
```

## AC-3 — Saldo vivo por cuenta

```mermaid
sequenceDiagram
  actor Usuario
  participant Fin as finances
  participant DB as PostgreSQL

  Usuario->>Fin: GET /accounts/{id}/balance
  Fin->>DB: SUM(movimientos por account, signo por tipo, sin soft-deleted)
  DB-->>Fin: sumaMovimientos
  Fin->>Fin: balance = initialBalance + sumaMovimientos
  Fin-->>Usuario: AccountBalanceResponse
```

## AC-4 — Edición de movimiento

```mermaid
sequenceDiagram
  actor Usuario
  participant Fin as finances
  participant DB as PostgreSQL

  Usuario->>Fin: PATCH /movements/{id} (MovementPatch)
  Fin->>DB: findByIdAndUser(id, user)
  alt no existe o de otro usuario
    Fin-->>Usuario: 404
  else type inmutable / es transferencia
    Fin-->>Usuario: 422 (campo no editable)
  else source=WEBHOOK y toca campo protegido
    Fin-->>Usuario: 422 (dato de ingesta protegido)
  else
    Fin->>DB: validar subcategoría∈categoría + save
    Fin-->>Usuario: MovementOutput
  end
```

## AC-5 — Anular transferencia (reversa compensatoria)

```mermaid
sequenceDiagram
  actor Usuario
  participant Fin as finances
  participant DB as PostgreSQL

  Usuario->>Fin: POST /transfers/{transferGroup}/reversal
  Fin->>DB: findByTransferGroup(transferGroup, user)
  alt no existe
    Fin-->>Usuario: 404
  else
    Fin->>DB: saveAll([compensa OUT→IN, compensa IN→OUT]) nuevo reversalTransferGroup
    Fin-->>Usuario: TransferReversalResponse
  end
```

## AC-6 — Reversa de movimiento de webhook

```mermaid
sequenceDiagram
  participant Ingesta as Sistema (API key)
  participant Fin as finances
  participant DB as PostgreSQL

  Ingesta->>Fin: POST /webhooks/transactions/{externalReference}/reversal
  Fin->>DB: findByExternalReference(externalReference)
  alt no existe
    Fin-->>Ingesta: 404
  else ya revertido (idempotente)
    Fin-->>Ingesta: MovementReversalResponse (existente)
  else
    Fin->>DB: guardar movimiento compensatorio
    Fin-->>Ingesta: MovementReversalResponse
  end
```
