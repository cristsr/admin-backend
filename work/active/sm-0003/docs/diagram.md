# Diagrama de flujo: sm-0003

Todo ocurre dentro de la app `finances` (monolito). Los "participantes" son módulos
internos, no microservicios separados. Se muestran los cuatro flujos con interacción
relevante; AC-5 (archivado en cascada) se incluye como flujo de borrado.

## AC-1 · AC-3 — Crear transferencia con validación de saldo e idempotencia

```mermaid
sequenceDiagram
  actor Usuario
  participant TC as TransferController
  participant II as IdempotencyInterceptor
  participant CT as CreateTransferUsecase
  participant AR as AccountRepository
  participant MR as MovementRepository

  Usuario->>TC: POST /transfers (TransferInput, header Idempotency-Key)
  TC->>II: intercepta
  II->>II: hash(body); busca (user_id, key)
  alt clave existente + mismo hash (COMPLETED)
    II-->>Usuario: respuesta original almacenada (replay)
  else clave existente + hash distinto
    II-->>Usuario: 422 IdempotencyConflict
  else clave nueva (o sin header)
    II->>CT: execute(TransferInput, user)
    CT->>AR: findByIdAndUser(sourceAccountId) + movementBalance
    alt saldo insuficiente y allowNegativeBalance=false
      CT-->>II: InsufficientBalanceException
      II-->>Usuario: 422 InsufficientBalance
    else saldo OK o cuenta admite negativo
      CT->>MR: saveAll([TRANSFER_OUT, TRANSFER_IN]) (transferGroup)
      MR-->>CT: par de movimientos
      CT-->>II: TransferOutput
      II->>II: persiste respuesta (idempotency_keys → COMPLETED, expires_at=+24h)
      II-->>Usuario: 201 TransferOutput
    end
  end
```

## AC-2 — Outbox transaccional + relay in-process

```mermaid
sequenceDiagram
  actor Usuario
  participant MC as MovementController
  participant SM as SaveMovementUsecase
  participant DB as PostgreSQL (misma transacción)
  participant RL as OutboxRelayScheduler (@Cron)
  participant EE as EventEmitter2
  participant BH as MovementSavedEventHandler
  participant PG as PgmqBudgetNotificationPublisher

  Usuario->>MC: POST /movements (MovementInput)
  MC->>SM: execute(MovementInput, user)
  SM->>DB: TX { INSERT movement + INSERT outbox_event(movement.saved, PENDING) }
  DB-->>SM: commit
  SM-->>Usuario: 201 MovementOutput
  Note over RL: independiente del request
  RL->>DB: SELECT pendientes FOR UPDATE SKIP LOCKED
  RL->>EE: emitAsync(movement.saved, payload)
  EE->>BH: handle(payload) (calcula %, deduplica threshold)
  BH->>PG: publish(BudgetThresholdExceeded) → pgmq.send(...)
  alt entrega OK
    RL->>DB: UPDATE outbox_event SET status=DELIVERED, processed_at=now()
  else falla el handler
    RL->>DB: UPDATE outbox_event SET status=FAILED, attempts+1, last_error, available_at=backoff
  end
```

## AC-4 — Auto-categorización por reglas

```mermaid
sequenceDiagram
  participant IN as Webhook / SaveMovementUsecase
  participant CR as ApplyCategorizationRulesUsecase
  participant RR as CategorizationRuleRepository
  participant CAT as CategoryRepository

  IN->>CR: categorize(merchant, description, user) (movimiento sin categoría)
  CR->>RR: findByUserOrderByPriorityDesc(user)
  RR-->>CR: reglas [priority desc]
  loop primera regla cuyo pattern es substring (case-insensitive) de merchant/description
    CR-->>IN: categoryId / subcategoryId de la regla
  end
  alt ninguna regla matchea
    CR->>CAT: findSystemDefault() ("Sin categorizar")
    CAT-->>CR: categoría por defecto
    CR-->>IN: categoryId por defecto
  end
```

## AC-5 — Archivado de cuenta en cascada

```mermaid
sequenceDiagram
  actor Usuario
  participant AC as AccountController
  participant RA as RemoveAccountUsecase
  participant DB as PostgreSQL (transacción)

  Usuario->>AC: DELETE /accounts/:id
  AC->>RA: execute(id, user)
  RA->>DB: TX {
  Note over RA,DB: soft-delete cuenta<br/>soft-delete movimientos de la cuenta<br/>soft-delete ambas patas de cada transferGroup afectado
  RA->>DB: }
  DB-->>RA: commit
  RA-->>Usuario: 200 AccountArchivedOutput { archivedMovements, archivedTransfers }
```
