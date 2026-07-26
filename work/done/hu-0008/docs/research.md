# Research: hu-0008 — Tooling de rebuild/replay + verificación de consistencia

## Decisión: `ProjectionRegistry` para resolución por nombre

- **Contexto:** El `ProjectionRebuilder` actual (hu-0004) recibe un `RebuildTarget` explícito
  (`projectors` + `tables`). Los AC de hu-0008 exigen `rebuild(projectionName)` y
  `rebuildAll()`, que requieren descubrir proyectores/tablas por nombre.
- **Opciones evaluadas:**
  1. **`ProjectionRegistry` (puerto en `application/`)** — un registro que mapea nombres de
     proyección a sus proyectores y tablas. El `ProjectionRebuilder` lo inyecta y resuelve por
     nombre. El CLI lo puebla al arrancar con las mismas definiciones de
     `createLedgerApplication`. Pros: extensible (futuros módulos registran sus proyecciones sin
     tocar el rebuilder), independiente de infraestructura (vive en `application/`), simple (un
     `Map`). Contras: agrega una abstracción nueva.
  2. **Configuración estática inline** — un objeto literal con el mapeo, importado directamente.
     Pros: sin nueva abstracción. Contras: acopla el rebuilder a módulos concretos (importa
     proyectores de `accounts/`, `transactions/`, etc.), no extensible por otros módulos.
- **Elegida:** `ProjectionRegistry` como clase concreta en `application/` (no necesita ser
  abstracta — es pura lógica de datos sin dependencias externas). Cumple AC-1, AC-2, AC-3 sin
  acoplar el rebuilder a módulos concretos (Artículo 1, Artículo 11).
- **Descartadas por:** la opción 2 acopla el rebuilder a módulos de dominio y viola el
  principio de que el shared-kernel no conoce módulos concretos.

## Decisión: Nx executor script sobre nestjs-command

- **Contexto:** La HU pide un adaptador driving tipo CLI para invocar rebuild/verify. Dos
  opciones naturales en un monorepo NestJS/Nx.
- **Opciones evaluadas:**
  1. **Nx executor script** — `ts-node` ejecuta un script que instancia manualmente los puertos
     (`PostgresEventStore`, `PostgresReadModelStore`, etc.) sin el contenedor DI de NestJS.
     Pros: sin nueva dependencia, `application/` sigue libre de NestJS, minimalista, cumple
     Artículo 10 (el CLI no es parte del núcleo). Contras: debe cablear dependencias manualmente
     (DataSource, migraciones, etc.).
  2. **nestjs-command** — paquete npm que integra comandos CLI en el ciclo de vida NestJS.
     Pros: usa el mismo DI container, experiencia NestJS uniforme. Contras: nueva dependencia,
     `application/` podría necesitar imports de NestJS (viola Artículo 1 si los comandos viven en
     `application/`), más pesado para una necesidad que es un script operacional simple.
- **Elegida:** Nx executor script. La HU es clara: `application/` libre de NestJS/TypeORM, el
  CLI es la única pieza de infraestructura. Un script standalone que cablea los adaptadores
  Postgres a mano respeta esa regla sin ambigüedad.
- **Descartadas por:** nestjs-command introduce una dependencia y un patrón que requiere
  NestJS en el punto de entrada, lo cual es innecesario para una operación batch que solo lee
  del event store y las proyecciones.

## Decisión: `ConsistencyVerifier` recalcula desde eventos, no desde `proj_postings`

- **Contexto:** AC-5 pide recalcular saldos "directamente del stream (sin pasar por la
  proyección)". Hay dos formas de hacerlo.
- **Opciones evaluadas:**
  1. **Desde eventos del stream** — leer `EventStore.readAll()`, deserializar cada evento con
     `EventRegistry`, extraer datos de posting de los eventos `TransactionRecorded`,
     `TransactionConfirmed`, `TransactionVoided`, `TransactionReversed`, `TransactionAmended`,
     y computar balances acumulados por `(accountId, currencyCode, status)` usando `Money`.
     Pros: independencia total del proyector (el propósito de verificación), verifica todo el
     pipeline (el proyector podría tener un bug y el verifier lo detecta). Contras: requiere
     conocimiento de la estructura de payload de cada evento.
  2. **Desde `proj_postings`** — leer la tabla de postings proyectada (que es la misma fuente que
     usa `AccountBalancesProjector`) y recalcular balances desde ahí. Pros: más simple, no
     necesita deserializar. Contras: no verifica independientemente (si `TransactionListProjector`
     tiene un bug, el verifier lo hereda), no cumple literalmente "directamente del stream".
- **Elegida:** desde eventos del stream con deserialización vía `EventRegistry`. La
  verificación debe ser independiente de los proyectores — si el proyector de postings se
  corrompe, el verifier debe detectarlo comparando contra lo que el stream realmente contiene.
  Esto respeta el espíritu de RNF-5 (reconstruibilidad desde el stream) y cierra EP-1 con la
  certeza de que el stream es la fuente de verdad.
- **Descartadas por:** la opción 2 reintroduce dependencia en el proyector que se quiere
  verificar — sería un verificador que solo chequea la proyección de balances contra la
  proyección de postings, ambas potencialmente corruptas por el mismo bug.
