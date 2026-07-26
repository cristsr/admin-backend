# design: hu-0016

## Decisiones de Diseño

- **Solo `TransactionVoided` lleva disparador:** verificado contra `AssertionPostingReader`
  (devuelve `CONFIRMED`+`PENDING`, excluye `VOIDED`) y `AssertionEvaluator` (suma sin
  discriminar por estado). `Confirmed` no cambia el monto evaluado y `Reversed` ya se cubre
  por el `TransactionRecorded` de la reversa. AC-2 se reescribió con esa evidencia y la
  historia deja dos tests que la documentan.
- **El reactor lee `proj_postings` por `transaction_id`:** sin cambio de esquema de eventos
  y sin lag, porque esa proyección es síncrona (§8.1) y el pump proyecta antes de reaccionar
  (hu-0015). Se descartó enriquecer el payload de los eventos, que habría exigido
  `schema_version` 2 + upcasting (RNF-6) sin resolver los eventos ya escritos.
- **Se extiende `AssertionPostingReader`** con `touchedByTransaction` en vez de crear un
  puerto nuevo: mantiene un único punto de acceso del módulo a `proj_postings` (DRY).
- **La atomicidad cross-stream sale a hu-0023:** es integridad transaccional, no
  re-evaluación, y alcanza también a `MergePendingTransfers`.

> Alternativas evaluadas y descartadas: [`docs/research.md`](./docs/research.md).

## Flujo entre módulos

`ReconciliationPump` entrega cada evento al reactor tras proyectarlo. Ante un
`TransactionVoided`, el reactor pide a `AssertionPostingReader` las cuentas y la fecha de la
transacción anulada, busca en `assertion_status` las aserciones no revocadas de esas cuentas
con corte igual o posterior, y despacha `EvaluateAssertion` por cada una. El agregado
recalcula y solo emite evento si el veredicto cambió.

| Caso de uso | Op | Trigger | Entrypoint | Doc |
|---|---|---|---|---|
| Re-evaluar aserciones afectadas | create | domain-event | `TransactionRecorded`/`Amended`/`Voided` | [reevaluate-assertions](./docs/flows/reevaluate-assertions.md) |

Es `create` en cuanto a documentación: el reactor existe desde EP-3 y quedó modelado en
hu-0015, pero nunca tuvo flujo propio — aparecía solo como un paso dentro de
`run-reconciliation-pump`.

## Componentes del módulo

`ReevaluateAssertionsReactor` gana el disparador `TransactionVoided` y una rama que resuelve
las cuentas tocadas por lectura en vez de por payload. `AssertionPostingReader` y su
adaptador se incorporan al modelo C4 del módulo (existían en el código desde EP-3 pero no
estaban modelados). Delta en [`docs/model.delta.c4`](./docs/model.delta.c4); `npx likec4
validate` pasa (7 archivos).

## Impacto en Arquitectura Global

**¿Toca arquitectura global?** No.

- **Nivel:** N/A
- **Cambio:** ninguno
- **Nodo/arista concreto:** N/A — todo el alcance es interno al módulo `reconciliation`,
  que ya está en el modelo desde hu-0015. La lectura de `proj_postings` cruza módulos pero
  no containers: es la lectura inter-agregado permitida por §3.5/§3.6, ya presente en el
  código desde EP-3.

## Contratos por módulo

**No hay delta de API.** Ningún endpoint cambia: el flujo es interno, disparado por eventos.
El efecto es observable por `GET /v1/balance-assertions/{id}`, cuyo contrato no se toca.

## Modelado de datos

Sin cambios: no hay tabla nueva ni columna nueva. La historia consume `proj_postings` y
`proj_assertions` tal como están.

## Validación de Quality Gates

| Gate | Resultado | Justificación |
|------|-----------|---------------|
| Simplicity | ✅ | Un disparador y un método de puerto. La verificación previa **redujo** el alcance de tres disparadores a uno, en vez de agregar los tres por seguir el AC al pie de la letra. |
| Anti-Abstraction | ✅ | Se extiende el puerto existente en lugar de introducir uno nuevo; se reusa `AssertionLookupPort` y el pump tal como están. |
| Integration-First | ✅ | El contrato del puerto (`touchedByTransaction`) se define y se cubre con contract test antes de la rama nueva del reactor. |
| Test-First | ✅ | `/plan` ordena el test del disparador antes de tocar `REEVALUATION_TRIGGERS`, y los dos tests de AC-2 antes de cerrar. |

### Artículos verificados

- **Artículo 10 / RNF-10 (CQRS estricto):** el reactor sigue sin escribir eventos ni
  proyecciones — solo lee y despacha commands.
- **Artículo 1 (núcleo aislado):** el puerto vive en `domain/ports`, su adaptador en
  `infrastructure/`; el reactor no importa infraestructura.
- **Artículo 5 (aislamiento por usuario):** la consulta nueva filtra por `user_id` además
  de `transaction_id`.

## Excepciones a la constitución

Ninguna.
