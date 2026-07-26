# Módulo: accounts (apps/ledger)

> C4 Nivel 3 · documentación viva. El modelo estructural y los diagramas de flujo
> se derivan de [`accounts.c4`](./accounts.c4) (LikeC4). Este README es el
> arc42-lite del módulo: propósito, invariantes y lenguaje ubicuo.

## Propósito

Gestiona el ciclo de vida de las cuentas contables del ledger: apertura, renombre,
cierre y las lecturas del árbol de cuentas y sus saldos. Es un módulo event-sourced:
cada transición de estado emite un evento de dominio persistido en el `EventStore`.

Aloja además el **ciclo de vida a nivel ledger** (`LedgerController`): inicialización y
lectura de settings. Vive acá por cercanía — el efecto observable de inicializar es la
aparición de las cuentas técnicas de sistema.

## Diagramas

- **Componentes (C4 L3):** vista `accountsComponents` en `accounts.c4`.
- **Flujos (dynamic views):** una vista por caso de uso — ver [`flows/`](./flows/).
  Renderizadas a SVG en `assets/` por CI (`likec4 export`).

Para previsualizar localmente: extensión LikeC4 de VS Code, o `npx likec4 start`.

## Casos de uso (flujos)

| Caso de uso | Trigger | Entrypoint | Doc |
|---|---|---|---|
| Inicializar ledger | rest | `POST /ledger/initialize` | [initialize-ledger](./flows/initialize-ledger.md) |
| Leer settings del ledger | rest | `GET /ledger/settings` | [get-ledger-settings](./flows/get-ledger-settings.md) |
| Abrir cuenta | rest | `POST /accounts` | [open-account](./flows/open-account.md) |
| Renombrar cuenta | rest | `POST /accounts/{id}/rename` | [rename-account](./flows/rename-account.md) |
| Cerrar cuenta | rest | `POST /accounts/{id}/close` | [close-account](./flows/close-account.md) |
| Listar cuentas (lista plana) | rest | `GET /accounts` | [list-accounts](./flows/list-accounts.md) |
| Consultar cuenta | rest | `GET /accounts/{id}` | [get-account-by-id](./flows/get-account-by-id.md) |
| Consultar saldos | rest | `GET /accounts/{id}/balance` | [get-account-balances](./flows/get-account-balances.md) |

> **Nota de contrato (hu-0013).** Las cuatro lecturas devuelven la fila de proyección tal
> cual, en `snake_case`; los DTO de respuesta decoran Swagger pero no se construyen. Los
> parámetros `?view` (lista) y `?currency` (saldos) se aceptan y se ignoran, y un recurso
> inexistente responde `200 null` en vez de `404`. Detalle en cada flujo y en
> [`api.yaml`](./api.yaml).

## Invariantes de dominio

| ID | Regla |
|---|---|
| AC-2 | Una cuenta real acepta una única moneda; las cuentas de agregación pueden multi-moneda. |
| INV-3 / INV-4 | Validación cruzada de jerarquía y tipo de cuenta (`AccountValidationService`). |
| INV-13 | Las cuentas de sistema están protegidas: no se renombran ni cierran. |
| INV-14 | El tipo raíz de una cuenta es inmutable. |

## Lenguaje ubicuo

- **Account:** agregado que representa una cuenta contable; su identidad es estable
  y su estado se reconstruye desde sus eventos.
- **Account tree:** proyección jerárquica de las cuentas (`proj_accounts`).
- **System account:** cuenta creada por el sistema (p. ej. al inicializar el ledger),
  protegida contra renombre y cierre.

## Contrato

- OpenAPI canónico del módulo: [`api.yaml`](./api.yaml).
