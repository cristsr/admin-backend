# hu-0017: Documentación viva del módulo reconciliation y reconciliación de transactions

## Historia de Usuario

**Como** desarrollador que retoma el ledger después de un tiempo
**Quiero** que el módulo `reconciliation` tenga la misma documentación viva que
`accounts`, `transactions`, `shared` y `shared-kernel` (modelo LikeC4, README arc42-lite,
OpenAPI y un doc por caso de uso)
**Para** entender la conciliación sin leer los 70 archivos del módulo, y que los docs de
`transactions` dejen de describir una funcionalidad que ya no existe

## Criterios de Aceptación

### AC-1: Modelo LikeC4 del módulo

Existe `apps/ledger/docs/reconciliation/reconciliation.c4` con la vista de componentes
(C4 Nivel 3) del módulo, extendiendo `admin.ledger` como hacen `transactions.c4` y
`accounts.c4`. Cubre el agregado `BalanceAssertion`, el evaluador, la `AdjustmentFactory`,
los puertos (`AssertionStatusStore`, `AdjustmentAuditStore`, `AssertionPostingReader`,
`LedgerSettingsReader`, `SystemAccountLookup`, `AssertionLookupPort`), los dos projectors
y el reactor.

### AC-2: README arc42-lite

Existe `apps/ledger/docs/reconciliation/README.md` con propósito, invariantes, lenguaje
ubicuo y la tabla de casos de uso, siguiendo el formato de
`apps/ledger/docs/transactions/README.md`.

### AC-3: Un doc de flujo por caso de uso

Existe `apps/ledger/docs/reconciliation/flows/` con un documento por caso de uso, con
frontmatter y trigger según `TRIGGER_TAXONOMY`:

| Caso de uso | Trigger | Entrypoint |
|---|---|---|
| Afirmar saldo | rest | `POST /balance-assertions` |
| Revocar aserción | rest | `POST /balance-assertions/{id}/revoke` |
| Resolver discrepancia | rest | `POST /balance-assertions/{id}/resolve` |
| Consultar aserción | rest | `GET /balance-assertions/{id}` |
| Listar aserciones | rest | `GET /balance-assertions` |
| Evaluar aserción | domain-event | `EvaluateAssertionHandler` |
| Re-evaluar aserciones | domain-event | `ReevaluateAssertionsReactor` |
| Proyectar assertion_status | domain-event | `AssertionStatusProjector` |
| Proyectar adjustment_audit | domain-event | `AdjustmentAuditProjector` |

### AC-4: OpenAPI del módulo

Existe `apps/ledger/docs/reconciliation/api.yaml` con los cinco endpoints de
`BalanceAssertionController`, sus DTOs de entrada y salida, y los códigos de error de
dominio que puede devolver (RF-14).

### AC-5: Los docs de `transactions` dejan de documentar la detección de transferencias

`apps/ledger/docs/transactions/README.md` describe hoy el módulo como *"detecta
transferencias entre cuentas"* y lista *"candidatos a transferencia"* entre sus
proyecciones; `transactions.c4` modela componentes que ya no existen y
`flows/detect-transfer.md` documenta un flujo retirado. Todo eso se reconcilia con el
código posterior al recorte de alcance (commit `934c3fa`): queda el flujo de fusión
(`POST /transfers/merge`) y desaparece el de detección.

### AC-6: El modelo LikeC4 valida

`npx likec4 validate` pasa sobre el modelo completo, incluyendo el `.c4` nuevo y el
`transactions.c4` corregido.

### AC-7: El landscape refleja el módulo

`docs/architecture/landscape.c4` incluye `reconciliation` como módulo del contenedor
`ledger` si todavía no está, sin duplicar lo que ya declara el `.c4` del módulo.

## Reglas de Negocio

- La unidad de documentación es el **caso de uso (flujo)**, no la historia
  (`docs/proposals/docs-as-code-likec4.md`).
- Modelo LikeC4 único: los `.c4` viven co-localizados por módulo y los fusiona
  `likec4.config.json` en la raíz.
- Los docs describen el código tal como está; donde el código diverja de la
  especificación, manda el código y la divergencia se registra.

## Fuera de Alcance

- Cambios de comportamiento en el módulo `reconciliation` — es documentación.
- La persistencia Postgres de sus proyecciones (hu-0015) y la re-evaluación ante
  anulaciones (hu-0016), aunque sus docs deban reflejar el estado final si esas historias
  se cierran antes.
