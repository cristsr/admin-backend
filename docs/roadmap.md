# Roadmap — Migración a `apps/ledger` (event sourcing + CQRS + partida doble)

Desglose de implementación de la [especificación técnica del ledger](./especificacion-tecnica-ledger.md).
Cada **épica** corresponde a una fase; las **subtareas** son unidades implementables
e independientes en lo posible. Estado: propuesta.

## Estrategia de convivencia

- Se crea una app nueva `apps/ledger`; `apps/finances` **se congela** (no se
  evoluciona) y se retira por reemplazo a medida que `ledger` alcanza paridad.
- **No hay datos de producción**, así que no hay migración de datos: el esquema
  del event store se crea desde cero (elimina la pregunta abierta #1 de la spec).
- `apps/ledger` queda **autocontenido**: lo que ya vive en `libs/shared`
  (primitivas de config `configValidator`/`ToBoolean`/`ToNumber`, `AuthModule`/
  `JwtAuthGuard`, `Criteria`, exception filter, jerarquía `DomainException`) se
  reutiliza directo; lo que hoy vive **dentro** de `finances` (`DatabaseModule`,
  telemetría OTel) se **duplica** en `apps/ledger`. **`finances` no se toca.** El
  outbox **no** se cablea en el ledger (el `event_store` es el outbox por
  construcción, §8.1/§9.3). **No** se reutiliza el dominio (`movement`, `account`,
  `category`, `transfer`, `summary`): es paradigma incompatible.
- El núcleo (`domain` + `application`) permanece libre de NestJS y de
  infraestructura; todo acceso externo pasa por puertos (§3.8).

Convención de ids: `EP-n` épica, `EP-n.m` subtarea.

## Decisiones resueltas (2026-07-22)

Confirmadas por el usuario tras la ronda de planeación por subagentes:

- **Librería decimal → `big.js`** con `Big.strict = true` (INV-8 reforzado por la
  librería). Se promueve a dependencia directa. *(EP-0.3)*
- **Despliegue → app y base de datos propias**: `ledger` deployable independiente,
  event store en base `ledger` aislada. *(EP-0.5)*
- **Plataforma → mover a `libs/shared` parametrizada**: `DatabaseModule.forRoot`
  y telemetría OTel viven en `@shared`; `finances` solo re-apunta sus imports
  (cambio mecánico, comportamiento y suite intactos). Sin outbox. *(EP-0.2)*
- **Idempotencia multi-evento → anchor-only stamping**: `external_ref` en el evento
  ancla + `EventStore.findByExternalRef` (short-circuit) + índice único como defensa
  en profundidad. *(EP-1.3/EP-1.8)*

Adoptadas por defecto (recomendación de los planes, sin objeción): outbox no se
cablea; `Clock`/`IdGenerator` en EP-0.4; monedas semilla `{COP:0, USD:2}`; CI
dispara en `master`; renombre = un `AccountRenamed` + propagación en proyección;
sesgo síncrono de proyecciones núcleo; presupuesto `confirmed`/`pending` separados
(alerta sobre la suma); detector de transferencias `windowDays=3`, `tolerance=0`;
meta no reversible; `LedgerDate` = `YYYY-MM-DD` plano.

Diferidas a su épica: formato del contexto autenticado (EP-2, tras acuerdo con el
servicio de identidad); retiro de `categorization-rule`/`scheduled`/`webhook`/
`exchange` y notificaciones PGMQ (EP-5, al alcanzar paridad); estilo REST fino (EP-2).

---

## EP-0 — Andamiaje `apps/ledger` + plataforma compartida

Prerrequisito de todo. Deja el repo listo para escribir dominio.

- [x] **EP-0.1** Generar app Nx `apps/ledger` (NestJS) con tsconfig paths
      (`@ledger/*`), lint y estructura hexagonal por módulo.
- [x] **EP-0.2** Mover a `libs/shared` (parametrizado) la plataforma que vivía
      dentro de `finances` (`DatabaseModule`, telemetría OTel); `finances`
      re-apunta sus imports. Sin outbox en el ledger.
- [x] **EP-0.3** `Money` nuevo: aritmética **decimal exacta** con `big.js` v6
      (`Big.strict`), `minor_units` por moneda, construcción desde `number`
      **prohibida** (INV-8). Contract tests del value object.
- [x] **EP-0.4** Harness de testing: unit + **contract tests** reusables entre
      adaptador real e in-memory; utilidades `Clock`/`IdGenerator` deterministas.
- [x] **EP-0.5** CI de la app nueva (build, lint, test + paso de migraciones
      cableado) y decisión de despliegue en paralelo a `finances`.

**Hecho cuando:** `apps/ledger` compila y corre vacío, `libs/shared` expone la
plataforma, `Money` decimal pasa sus tests, la suite de contract tests corre.

---

## EP-1 — Núcleo de dominio, puertos y adaptadores base (Fase 1)

La épica más grande y de mayor riesgo. Deja el ledger usable por código (sin API).

- [ ] **EP-1.1** Value objects: `AccountName` (jerarquía por nombre, 5 tipos
      raíz, validación de colisión), `Payee`, `PostingLine`, `Currency`.
- [ ] **EP-1.2** Envelope de eventos de dominio (`event_id`, `aggregate_id`,
      `sequence`, `user_id`, `client_id`, `external_ref`, `occurred_at`,
      `recorded_at`) + serialización con montos como strings decimales (RNF-2).
- [ ] **EP-1.3** Puerto `EventStore` (`append`/`load`/`readAll`) con su semántica:
      concurrencia optimista, idempotencia por `external_ref` (INV-10), orden por
      posición global. Consume los puertos `Clock`/`IdGenerator` (entregados en
      EP-0.4).
- [ ] **EP-1.4** Adaptador **in-memory** de `EventStore` + contract tests.
- [ ] **EP-1.5** Adaptador `PostgresEventStore` (esquema §6.1: tabla append-only,
      trigger de inmutabilidad, índices únicos, `projection_checkpoints`) que pasa
      **los mismos** contract tests (RNF-11).
- [ ] **EP-1.6** Agregado `Account`: eventos `AccountOpened`/`Renamed`/`Closed`;
      invariantes INV-3 (parcial), INV-4, INV-13, INV-14.
- [ ] **EP-1.7** Agregado `LedgerTransaction`: `TransactionRecorded`/`Amended`/
      `Annotated`/`Confirmed`/`Voided`/`Reversed`; INV-1 (balanceo cero por moneda
      en **componente único**, INV-11), INV-2, INV-6.
- [ ] **EP-1.8** Command bus + políticas transversales (idempotencia, contexto,
      concurrencia optimista). Handlers núcleo: `InitializeLedger` (cuentas
      técnicas), `OpenAccount`, `RecordTransaction`, `ConfirmTransaction`,
      `AmendPendingTransaction`, `AnnotateTransaction`, `VoidPendingTransaction`,
      `ReverseConfirmedTransaction`.
- [ ] **EP-1.9** Puerto `ReadModelStore` + `ProjectionDispatcher` (modo síncrono
      en transacción del command + poller con checkpoint; mismo código de proyector).
- [ ] **EP-1.10** Proyectores núcleo: `account_tree`, `transaction_list`
      (+ `proj_postings`), `account_balances`. Derivador de `derived_kind` (RF-4)
      como servicio de dominio.
- [ ] **EP-1.11** Query bus + query handlers sobre esas proyecciones.
- [ ] **EP-1.12** Tooling de **rebuild/replay** y verificación stream vs proyección
      (RNF-5).

**Hecho cuando:** se puede inicializar un ledger, abrir cuentas, registrar y
confirmar transacciones balanceadas end-to-end sobre Postgres, y reconstruir las
proyecciones por replay. Todo cubierto por contract tests idénticos in-memory/PG.

---

## EP-2 — API REST (Fase 2)

Expone el núcleo de EP-1 a clientes externos.

- [ ] **EP-2.1** Contrato OpenAPI inicial + versionado del API (RNF-8).
- [ ] **EP-2.2** Adaptador HTTP driving: controllers → command bus / query bus.
- [ ] **EP-2.3** Integración del **contexto autenticado** externo (`user_id`,
      `client_id`) vía guard/middleware; rechazo sin contexto válido (RF-26).
- [ ] **EP-2.4** Endpoints de cuentas: `/ledger/initialize`, `/accounts`
      (crear/listar árbol/renombrar/cerrar/saldo).
- [ ] **EP-2.5** Endpoints de transacciones: crear, listar/filtrar (incl. payee),
      `confirm`, `void`, `amend`, `annotate`, `reverse`.
- [ ] **EP-2.6** Códigos de error de dominio estables (RF-14:
      `UNBALANCED_TRANSACTION`, `ACCOUNT_CLOSED`, `CURRENCY_NOT_ALLOWED`,
      `DUPLICATE_EXTERNAL_REF`, `IMMUTABLE_TRANSACTION`, `CONCURRENCY_CONFLICT`,
      `NAME_COLLISION`, `SYSTEM_ACCOUNT_PROTECTED`) vía exception filter.
- [ ] **EP-2.7** Lectura de escrituras propias (posición de stream / proyección
      síncrona, RNF-9) e idempotencia por `external_ref` expuesta (RF-11).

**Hecho cuando:** un cliente HTTP autenticado ejecuta el ciclo de vida completo de
cuentas y transacciones, con errores estables y read-your-writes.

---

## EP-3 — Conciliación y transferencias (Fase 3)

Primeros reactors y la conciliación bancaria — el motor del caso de uso.

- [ ] **EP-3.1** Agregado `BalanceAssertion`: `BalanceAsserted`/`Evaluated`/
      `Revoked`.
- [ ] **EP-3.2** Servicio evaluador de aserciones con semántica temporal §2.4
      (`occurred_at` vs cierre de día en la zona horaria configurada, población
      `CONFIRMED`+`PENDING`, resultado `INDETERMINATE`, tolerancia).
- [ ] **EP-3.3** Commands `AssertBalance`, `RevokeAssertion` + endpoints
      `/balance-assertions`, `/balance-assertions/{id}/revoke`.
- [ ] **EP-3.4** Reactor de **re-evaluación** de aserciones (RF-18): process
      manager que escucha eventos y despacha commands, nunca escribe directo.
- [ ] **EP-3.5** Resolución de discrepancias: command `ResolveDiscrepancy` →
      ajuste contra `Equity:Adjustments` + `DiscrepancyResolved`; endpoint
      `/balance-assertions/{id}/resolve`.
- [ ] **EP-3.6** Proyecciones `assertion_status` y `adjustment_audit`.
- [ ] **EP-3.7** Detección de transferencias: proyección `transfer_candidates`
      (RF-15) + command `MergePendingTransfers` (RF-16) + endpoints
      `/transfers/candidates`, `/transfers/merge`.

**Hecho cuando:** se registran aserciones, se evalúan/re-evalúan solas ante
cambios previos, se resuelven discrepancias con ajuste auditado, y se detectan y
fusionan pares de transferencia.

---

## EP-4 — Producto: presupuestos, metas, valoración y reportes (Fase 4)

Capa de producto sobre el núcleo ya reforzado.

- [ ] **EP-4.1** `LedgerSettings`: `presentation_currency`, `timezone`
      (`ChangePresentationCurrency`, `ChangeTimezone`) + `/ledger/settings`.
- [ ] **EP-4.2** Datos de referencia: `CurrencyRegistered` (`/currencies`) y
      `PriceRecorded` con corrección por superposición (§2.6, `/prices`).
- [ ] **EP-4.3** Agregado `Budget` (`Defined`/`Amended`/`Removed`) + proyección
      `budget_consumption` distinguiendo confirmados de pendientes (RF-24) +
      `/budgets`.
- [ ] **EP-4.4** Agregado `Goal` (`Defined`/`Amended`/`Achieved`/`Archived`) con
      progreso desde balances y reactor de detección de logro (RF-25) + `/goals`.
- [ ] **EP-4.5** Valoración: proyección `net_worth` + conversión **half-even solo
      en lectura** a moneda de presentación (§2.7.1, RF-23).
- [ ] **EP-4.6** Reportes: gastos por categoría/período/payee, patrimonio,
      auditoría de ajustes (`/reports/*`).

**Hecho cuando:** presupuestos y metas con ciclo de vida completo, reportes
consolidados valorados en moneda de presentación, todo desde proyecciones.

---

## EP-5 — Cierre: deprecación de `finances` y operabilidad

Se hace en paralelo/al final; asegura operar con datos reales.

- [ ] **EP-5.1** Retirar módulos de `finances` (`movement`, `transfer`,
      `category`, `summary`, `budget` viejo) una vez cubiertos por `ledger`.
- [ ] **EP-5.2** Backups automatizados del event store + prueba de restauración
      (pregunta abierta #8; **obligatorio antes de datos reales**).
- [ ] **EP-5.3** Runbook de rebuild de proyecciones y verificación de consistencia.
- [ ] **EP-5.4** Métricas OTel del diseño (RNF-12): lag de proyecciones asíncronas,
      tasa de conflictos de concurrencia optimista, errores de projectors/reactors.

---

## Secuencia y dependencias

```
EP-0 ─► EP-1 ─► EP-2 ─► EP-3 ─► EP-4
                          └────► EP-5 (parcial, en paralelo desde EP-2)
```

- EP-0 y EP-1 son secuenciales y bloqueantes; el resto puede solaparse una vez
  que EP-1 está estable.
- Cada épica deja el sistema en estado consistente y usable (criterio de la §11).
- Regla de disciplina de la spec: **la fase de producto (EP-4) no se construye
  hasta que los invariantes del núcleo estén reforzados** y las proyecciones
  verificadas contra el stream por replay.
