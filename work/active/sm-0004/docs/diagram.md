# Diagrama de flujo: sm-0004

Historia no-funcional transversal. Se diagraman los dos flujos con forma de secuencia:
la observabilidad de punta a punta (AC-4) y el readiness (AC-2). El resto de los ACs
(Swagger, discovery perezoso, rate limiting) son cross-cutting sin un flujo de secuencia
propio; su detalle vive en `design.md` y `research.md`.

## Flujo 1 — Trace id de punta a punta: webhook → evento de presupuesto (AC-4, AC-5)

```mermaid
sequenceDiagram
  actor Rust as invoices-name (Rust)
  participant NGINX
  participant WH as WebhookController
  participant TH as ThrottlerGuard
  participant SM as SaveMovementUsecase
  participant OB as outbox_events (jsonb)
  participant RL as OutboxRelayScheduler (cron)
  participant BH as MovementSavedEventHandler
  participant BT as BudgetThresholdExceeded handler

  Rust->>NGINX: POST /webhooks/transactions (X-Api-Key)
  NGINX->>WH: POST /webhooks/transactions (+ X-Forwarded-For, X-Request-Id?)
  Note over WH: pino genReqId toma X-Request-Id<br/>o genera correlationId
  WH->>TH: WebhookApiKeyGuard + rate limit 60/min por IP+API key
  alt límite superado
    TH-->>NGINX: 429 Too Many Requests
    NGINX-->>Rust: 429
  else dentro del límite
    WH->>SM: registrar movimiento (log correlationId)
    SM->>OB: INSERT outbox_event { eventType: movement.saved,<br/>payload: { ..., correlationId } }
    SM-->>WH: 200/201
    WH-->>NGINX: 200/201
    NGINX-->>Rust: 200/201
    RL->>OB: SELECT pending (poll)
    Note over RL: restaura correlationId del payload<br/>en el contexto de log
    RL->>BH: emit movement.saved (correlationId)
    BH->>BT: emit BudgetThresholdExceeded (correlationId) [si cruza umbral]
    Note over BH,BT: ambos loguean con el mismo correlationId
  end
```

## Flujo 2 — Readiness / liveness (AC-2, AC-3)

```mermaid
sequenceDiagram
  actor Orq as Orquestador / NGINX
  participant HL as GET /health/live
  participant HR as GET /health/ready
  participant DB as TypeOrmHealthIndicator
  participant OIDC as OidcHealthIndicator (resolver perezoso cacheado)

  Orq->>HL: GET /health/live (público, sin JWT)
  HL-->>Orq: 200 { status: "ok" }  (no toca dependencias)

  Orq->>HR: GET /health/ready (público, sin JWT)
  HR->>DB: ping SELECT 1
  HR->>OIDC: resolver discovery (cacheado, timeout corto)
  alt todas las dependencias up
    DB-->>HR: up
    OIDC-->>HR: up
    HR-->>Orq: 200 { status: "ok", info: { db, oidc } }
  else alguna dependencia down
    OIDC-->>HR: down (IdP no responde)
    HR-->>Orq: 503 { status: "error", error: { oidc } }
  end
```
