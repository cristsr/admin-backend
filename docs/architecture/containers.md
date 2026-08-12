# Diagrama de Contenedores — admin-back (C4 Nivel 2)

> Vista de contenedores: apps/microservicios, libs compartidas, bases de
> datos e integraciones externas. Generado por `/architecture` (bootstrap) y
> actualizado quirúrgicamente por `/architecture` en modo Update, invocado
> desde `/sync` cuando una historia toca arquitectura global.
> Última actualización: 2026-08-11 (spec-0033 — migración a Mermaid; se
> incorporó `libs/cqrs`, ausente desde su extracción en julio).

```mermaid
flowchart TB
  subgraph apps["Apps (Nx)"]
    finances["finances<br/>monolito NestJS<br/>congelado, pendiente de reemplazo<br/>(folds in: user, exchange)"]
    ledger["ledger<br/>NestJS, event sourcing + CQRS<br/>partida doble<br/>en desarrollo activo"]
  end

  subgraph libs["Libs compartidas"]
    shared["shared<br/>Money, Nullable&lt;T&gt;, DomainException,<br/>Criteria, PropertiesOnly"]
    cqrs["cqrs<br/>event store, command/query bus,<br/>pipeline de proyecciones<br/>(extraída de ledger, 2026-07-27)"]
  end

  subgraph infra["Infraestructura"]
    pg[("PostgreSQL 16<br/>una instancia, DBs separadas")]
    keycloak["Keycloak<br/>Identity Provider (OIDC)"]
  end

  finances --> shared
  ledger --> shared
  ledger --> cqrs
  cqrs --> shared

  finances -- "DB: finances" --> pg
  ledger -- "DB: ledger<br/>(event store + read models)" --> pg

  finances -- "valida tokens OIDC<br/>(health check + auth)" --> keycloak
  ledger -. "espera contexto de auth<br/>ya resuelto por un gateway/IdP<br/>upstream (no llama a Keycloak<br/>directamente en el código)" .-> keycloak
```

## Notas

- **`finances`** es el monolito original (incluye los módulos plegados `user`
  y `exchange`), congelado a la espera de que `ledger` lo reemplace por
  completo — no recibe funcionalidad nueva, solo mantenimiento si algo se
  rompe.
- **`ledger`** es el reemplazo event-sourced + CQRS + partida doble, en
  desarrollo activo. Es el único destino de historias nuevas hoy.
- Ambas apps comparten una única instancia de PostgreSQL (`docker-compose.yml`,
  puerto `5433`) pero con **bases de datos separadas** (`finances`, `ledger`)
  — no hay una DB compartida entre servicios.
- **Keycloak** es el único sistema externo real hoy. `finances` lo integra
  directamente (validación de token + health check). `ledger` no lo llama en
  código: su `ledger-context.guard` asume que el `userId`/`clientId` ya llegó
  resuelto por la infraestructura externa (gateway/servicio de identidad) —
  ver RF-26/RF-12 de `especificacion-tecnica-ledger.md`.
- **`libs/cqrs`** contiene la maquinaria de event sourcing y CQRS: event store
  append-only, buses de comando y consulta, y el pipeline de proyecciones. Se
  extrajo de `apps/ledger/src/shared-kernel` el 2026-07-27 y es deliberadamente
  ignorante de qué se registra — conoce streams, envelopes y posiciones, nunca
  cuentas ni dinero. Su documentación vive en
  [`libs/cqrs/README.md`](../../libs/cqrs/README.md) y
  [`libs/cqrs/docs/flows/`](../../libs/cqrs/docs/flows/).
- No hay lib `core` pese a lo que menciona `CLAUDE.md`. Hoy existen
  `libs/shared` y `libs/cqrs`.

> **Nivel 3.** Los componentes internos de cada módulo no viven acá: cada uno
> tiene su `flowchart` en el `README.md` de su unidad de documentación
> (`apps/ledger/docs/<módulo>/`, `libs/cqrs/`), y cada caso de uso su
> `sequenceDiagram` inline en `flows/`. Ver
> [`docs/proposals/docs-as-code-mermaid.md`](../proposals/docs-as-code-mermaid.md).
