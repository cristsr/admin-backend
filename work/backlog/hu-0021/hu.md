# hu-0021: Runbook operativo de rebuild de proyecciones y verificación de consistencia

## Historia de Usuario

**Como** responsable de operar el ledger
**Quiero** un runbook que diga cuándo y cómo reconstruir una proyección, qué esperar
mientras corre y cómo confirmar que quedó bien
**Para** poder responder a una proyección corrupta o a un bug de projector sin improvisar
sobre la contabilidad de un usuario

## Criterios de Aceptación

### AC-1: El runbook cubre los tres comandos existentes

Documenta `nx run ledger:rebuild`, `ledger:rebuildAll` y `ledger:verify-balances`
(declarados en `apps/ledger/project.json`): qué hace cada uno, qué argumentos acepta, y
cuándo usar uno u otro. Los flujos ya tienen documentación técnica en
`apps/ledger/docs/shared-kernel/flows/`; el runbook es la capa operativa sobre ellos, no
un duplicado.

### AC-2: Escenarios de disparo

Documenta los escenarios concretos que motivan un rebuild: bug corregido en un projector,
proyección desincronizada detectada por `verify-balances`, esquema de proyección
modificado, y restauración desde backup (hu-0020).

### AC-3: Impacto durante el rebuild

Documenta qué le pasa a las lecturas mientras una proyección se reconstruye: si la tabla
queda vacía, inconsistente o intacta hasta el final, y qué ven los clientes del API
entretanto.

[NEEDS CLARIFICATION: ¿el `ProjectionRebuilder` reconstruye sobre la tabla en caliente o
contra una tabla sombra que se promueve al terminar? El comportamiento actual define qué
puede prometer el runbook — y si es en caliente, si hace falta una ventana de
mantenimiento.]

### AC-4: Verificación posterior obligatoria

Todo rebuild termina con `verify-balances` y el runbook define qué hacer si el reporte
sale inconsistente.

### AC-5: Interpretación del reporte de consistencia

Documenta cómo leer la salida de `ConsistencyVerifier` (`balance-verification-report.type.ts`):
qué significa cada discrepancia reportada y cuáles son accionables.

### AC-6: Estimación de duración y checkpoints

Documenta cómo estimar cuánto tarda un rebuild en función del tamaño del stream, y cómo
funcionan los `projection_checkpoints` si el proceso se interrumpe a mitad de camino.

### AC-7: El runbook vive versionado con el código

El documento queda en el repositorio, no en una wiki externa. Existió un
`ops/EP-5-rebuild-runbook.md` que fue borrado en el commit `aaa87cc`; esta historia
produce la versión definitiva y decide su ubicación definitiva.

## Reglas de Negocio

- Toda proyección es reconstruible desde el event stream (RNF-5). Un bug en una proyección
  se corrige con rebuild, nunca editando la tabla a mano (§6.3).
- Los projectors son los únicos escritores de los read models (RNF-10).
- El event store no se toca durante un rebuild: es append-only y la operación es de solo
  lectura sobre él.

## Fuera de Alcance

- Backups y restauración del event store: es hu-0020.
- Cambios al `ProjectionRebuilder` o al `ConsistencyVerifier` — salvo que AC-3 revele que
  el comportamiento actual no es operable, en cuyo caso se registra como hallazgo y se
  trata en una historia aparte.
