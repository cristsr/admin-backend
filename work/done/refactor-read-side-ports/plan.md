# refactor-read-side-ports — Índice de planes

**Historia:** `work/active/refactor-read-side-ports/`
**App:** `apps/ledger`
**Diseño:** [`docs/proposals/read-side-ports.md`](../../../docs/proposals/read-side-ports.md)

Un plan por fase, no un plan único: cada fase es un commit revisable por separado y deja la
suite verde. Ejecutar con `/build refactor-read-side-ports <archivo del plan>`.

| # | Plan | Contenido | Tareas | Riesgo |
|---|---|---|---|---|
| 0 | [`plan-f0-schema.md`](./plan-f0-schema.md) | `user_id` en `proj_balances`, 2 índices, projector, `ConsistencyVerifier` | 6 | bajo |
| 1 | [`plan-f1-accounts.md`](./plan-f1-accounts.md) | 4 puertos, 4 adapters, `views/`, 3 query handlers, 2 servicios de aplicación | 15 | **alto** |
| 2 | [`plan-f2-ledger.md`](./plan-f2-ledger.md) | 3 puertos, reubica 2 de `reconciliation`, migra `RecordOpeningBalance` | 10 | medio |
| 3 | [`plan-f3-transactions.md`](./plan-f3-transactions.md) | 2 puertos, adapter SQL + gemelo + contract test | 10 | medio |
| 4 | [`plan-f4-reference.md`](./plan-f4-reference.md) | 1 puerto, cierra la firma de `createQueryBus` | 6 | bajo |
| 5 | [`plan-f5-cierre.md`](./plan-f5-cierre.md) | guard en CI, renombres de `reconciliation`, filtros al `WHERE` | 6 | bajo |

**Orden:** la fase 0 es prerrequisito duro de la 1. Las fases 1–4 son independientes entre
sí salvo por `read-side-ports.factory.ts`, que cada una completa con su parte (la 1 la crea;
si se ejecuta otra primero, esa la crea). La fase 5 va última: su guard sólo puede quedar
verde con las cuatro anteriores hechas.

**Rama:** todas sobre `feat/core`, un commit por fase. No se crea rama nueva (la
constitución sólo prohíbe trabajar sobre `master`).

---

## Trazabilidad AC → Fase · Tarea

| AC | Cubierto por |
|----|-------------|
| AC-1 — `application/` no conoce el read model | F1·T13, F2·T8, F3·T8, F4·T4, F5·T1 |
| AC-2 — el guard lo verifica en CI | F5·T1 |
| AC-3 — el scope por usuario está en el `WHERE` | F0·T1, F0·T4, F1·T6, F1·T7 |
| AC-4 — una declaración de esquema por proyección | F1·T1, F2·T1, F3·T1, F4·T1, F5·T4 |
| AC-5 — los `View` viven en `application/views/` | F1·T2, F1·T5, F2·T2, F3·T2, F4·T1, F5·T4 |
| AC-6 — nomenclatura de puertos verificable | F1·T3/T6/T8/T10, F2·T3/T4/T5, F3·T3/T5, F4·T2, F5·T2 |
| AC-7 — `RecordOpeningBalance` no lee la proyección | F2·T6 |
| AC-8 — puertos de `ledger` separados por responsabilidad | F2·T3/T4/T5, F2·T7 |
| AC-9 — composiciones in-memory verdes sin gemelos nuevos | F1·T14, F2·T9, F3·T5, F3·T9, F4·T5 |
| AC-10 — `ReadModelStore` conserva su rol | F0·T5, F5·T5 |
| AC-11 — sin cambio de contrato HTTP | F1·T14, F3·T9, F5·T5 |

Las 11 AC de `hu.md` están cubiertas.

---

## Desviaciones del pipeline SDD, declaradas

Esta no es una historia de producto y el workspace no sigue `STORY_ID_PATTERN`
(`hu-<number>`). Precedente: `work/active/audit-hexagonal-ledger.md`.

- **Sin `/hu`, `/clarify`, `/scan`** — `hu.md` se escribió a mano (no hay historia de
  usuario que estructurar) y `context.md` es el relevamiento del read side ya hecho.
- **Sin `/design`** — el diseño es `docs/proposals/read-side-ports.md`, revisado y aprobado
  con sus cuatro decisiones cerradas. `design.md` aporta lo que el pipeline necesita y que
  el proposal no tiene en su formato (componentes, flujos, impacto arquitectónico,
  decisiones de diseño para `docs/decisions.md`).
- **Sin `docs/api.yaml` ni `docs/diagram.md`** — `/plan` normalmente los exige y se detiene
  si faltan. Acá **deben** faltar: la refactorización no cambia ningún contrato HTTP
  (AC-11 lo verifica) ni introduce flujo nuevo. Generar un delta de OpenAPI vacío sería
  ceremonia sin producto.
- **Sin `docs/data-model.md`** — el único cambio de esquema (`user_id` en `proj_balances`)
  está en la fase 0 con el DDL completo, y toca una tabla de proyección, no un modelo de
  dominio.
- **Tarea 0 no crea rama** — el perfil declara `BASE_BRANCH: develop`, pero este repo viene
  trabajando sobre `feat/core`.

Al cerrar: `/sync refactor-read-side-ports` reconcilia los `.c4` de los cinco módulos,
appendea las decisiones a `docs/decisions.md` y archiva en `work/done/`. No invoca
`/architecture` — `design.md` declara "Impacto en Arquitectura Global: **No**".
