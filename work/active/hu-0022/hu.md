# hu-0022: Métricas OpenTelemetry de las señales críticas del diseño (RNF-12)

## Historia de Usuario

**Como** responsable de operar el ledger
**Quiero** que el ledger emita las tres señales que el diseño declara imprescindibles —
lag de proyecciones, conflictos de concurrencia y errores de projectors/reactors —
**Para** enterarme de que un reactor dejó de re-evaluar aserciones o de que una proyección
se quedó atrás, en vez de descubrirlo por un saldo mal mostrado semanas después

## Criterios de Aceptación

### AC-1: El ledger arranca con telemetría inicializada

`apps/ledger` cablea la instrumentación OTel que ya vive en `libs/shared/src/telemetry/`
(`instrumentation.ts`, `telemetry.config.ts`, `correlation.ts`), reutilizándola en vez de
duplicarla. Hoy ningún archivo de `apps/ledger/src` referencia OpenTelemetry.

### AC-2: Lag de proyecciones asíncronas

Se expone el lag de cada proyección como la diferencia entre su checkpoint en
`projection_checkpoints` y la `global_position` máxima del stream. Es la señal que delata
una proyección detenida.

### AC-3: Tasa de conflictos de concurrencia optimista

Se expone un contador de `ConcurrencyConflictException` con atributos de tipo de command y
tipo de agregado, para detectar agregados calientes y tormentas de reintento.

### AC-4: Errores de projectors y reactors

Se exponen los errores de projectors y reactors. La especificación lo justifica
explícitamente: *"un reactor fallando silenciosamente rompe la re-evaluación de aserciones
sin síntoma visible"* (RNF-12) — exactamente el flujo de hu-0016.

### AC-5: Trazas por command y query

Cada command y query genera una traza con atributos de dominio: tipo de command,
agregado y `client_id` (RF-12, RNF-12).

### AC-6: La instrumentación no entra al dominio

Toda la instrumentación vive en adaptadores y en decoradores de los buses. Ni el dominio
ni la capa de aplicación importan OpenTelemetry (RNF-11, RNF-12). El `CommandBus` ya usa
Chain of Responsibility con políticas, lo que da un punto natural de decoración.

### AC-7: La suite sigue verde sin colector

Los tests corren sin un colector OTel levantado: la instrumentación degrada a no-op cuando
no hay exportador configurado, sin romper ni ralentizar la suite.

### AC-8: Configuración por entorno

El endpoint del exportador y el `service.name` se configuran por variables de entorno,
validadas con el patrón del proyecto (`class-validator` + namespaces `registerAs`), no con
Joi.

[NEEDS CLARIFICATION: ¿a dónde exportan las métricas y las trazas? `finances` ya tiene
configuración OTLP en `libs/shared/src/telemetry/telemetry.config.ts` — ¿el ledger apunta
al mismo colector, o al tener base de datos y despliegue propios necesita el suyo?]

### AC-9: El documento de diseño se reemplaza por la implementación

`config/telemetry/otel-metrics.md` describe hoy instrumentos y snippets que nadie emite, y
usa nombres de command que no existen en el ledger (`CreateAccount`, `Record Movement`). Se
actualiza para reflejar lo implementado, o se retira si la documentación queda cubierta
por el código y el runbook.

## Reglas de Negocio

- La instrumentación vive en adaptadores y decoradores de buses, nunca dentro del dominio
  (RNF-11).
- Las tres señales imprescindibles del diseño son lag de proyecciones, conflictos de
  concurrencia y errores de projectors/reactors (RNF-12); el resto es opcional.
- Los projectors son los únicos escritores de read models y los reactors solo despachan
  commands (RNF-10): las métricas observan ese contrato, no lo alteran.

## Fuera de Alcance

- Dashboards, alertas y reglas de paginación: esta historia emite las señales, no define
  quién las mira.
- Instrumentar `apps/finances`: está congelada.
