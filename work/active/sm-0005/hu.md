# sm-0005: Nuevas capacidades de producto

## Historia de Usuario

**Como** usuario que quiere gestionar su vida financiera, no solo registrarla
**Quiero** metas de ahorro, cuentas compartidas, deudas en cuotas, comprobantes adjuntos, presupuestos con rollover y una API de eventos
**Para** que el backend deje de ser solo un libro de registro y me ayude a planificar y colaborar

> Contexto: agrupa las ideas del **Grupo E** (visión a largo plazo) de `LLUVIA_DE_IDEAS.md`.
> Varias requieren decisión de producto antes de diseñarse; esta historia las encuadra.

## Criterios de Aceptación

### AC-1: Metas de ahorro (`goals`)

El usuario puede apartar dinero hacia un objetivo con un aporte recurrente, reusando la
maquinaria de `scheduled`.

- El usuario puede crear una meta con monto objetivo y (opcionalmente) fecha límite.
- El usuario puede registrar aportes a la meta, manuales o recurrentes.
- El sistema reporta el progreso de la meta (aportado vs. objetivo).

[NEEDS CLARIFICATION: ¿el dinero apartado sale de una cuenta real (movimiento/transferencia a una "cuenta meta"), o la meta es solo un contador lógico sin afectar saldos?]
[NEEDS CLARIFICATION: ¿los aportes recurrentes se modelan como `scheduled` existentes o como una entidad nueva?]

### AC-2: Cuentas compartidas / finanzas de pareja

Una cuenta puede tener varios miembros con permisos, extendiendo el scoping actual (hoy todo
es estrictamente por un `user.id`).

- Una cuenta puede compartirse con otros usuarios.
- Los miembros ven y (según permiso) operan sobre los movimientos de la cuenta compartida.
- El scoping por usuario sigue valiendo para todo lo no compartido.

[NEEDS CLARIFICATION: ¿qué niveles de permiso existen (lectura / escritura / admin)?]
[NEEDS CLARIFICATION: ¿la unidad compartible es la cuenta, o también presupuestos y categorías?]
[NEEDS CLARIFICATION: ¿cómo se invita/acepta a un miembro, y qué pasa con sus movimientos si deja de ser miembro?]

### AC-3: Deudas y cuotas

Un gasto a crédito en N cuotas genera automáticamente los `scheduled` correspondientes y se
refleja en la proyección de cierre.

- El usuario puede registrar una compra en N cuotas.
- El sistema genera las ocurrencias futuras (una por cuota) como movimientos programados.
- Las cuotas pendientes aparecen en la proyección de fin de mes (`sm-0002` AC-3).

[NEEDS CLARIFICATION: ¿la primera cuota es en el momento de la compra o en el siguiente ciclo?]
[NEEDS CLARIFICATION: ¿se soportan cuotas con interés (monto por cuota distinto del capital/N)?]

### AC-4: Adjuntos de comprobante

`movements.invoiceUrl` ya existe como puntero; falta un servicio de storage para subir el
PDF/foto del recibo.

- El usuario puede subir un archivo de comprobante asociado a un movimiento.
- El archivo se guarda en un storage externo y su URL queda en `invoiceUrl`.

[NEEDS CLARIFICATION: ¿qué storage se usa (S3, GCS, otro) y quién lo provee?]
[NEEDS CLARIFICATION: ¿límites de tamaño y tipos de archivo permitidos? ¿El acceso al archivo es autenticado o por URL firmada temporal?]

### AC-5: Presupuestos por categoría con rollover

El budget ya distingue "período vigente" e historial. Se agrega arrastrar el sobrante o
déficit al período siguiente (estilo envelope budgeting).

- Al cerrar un período de presupuesto, el remanente (positivo o negativo) puede arrastrarse al siguiente.
- El presupuesto del nuevo período refleja el monto base más/menos el arrastre.

[NEEDS CLARIFICATION: ¿el rollover es opcional por presupuesto (flag), o siempre activo?]
[NEEDS CLARIFICATION: ¿un déficit arrastrado reduce el presupuesto siguiente, o solo se arrastran sobrantes positivos?]

### AC-6: Webhooks salientes / API de eventos para terceros

Así como se reciben transacciones de la ingesta Rust, el sistema expone sus propios eventos
(`movement.created`, `budget.exceeded`) a integraciones del usuario.

- El usuario puede registrar un endpoint destino para recibir eventos.
- El sistema entrega los eventos suscritos a ese destino, con reintentos y firma verificable.

[NEEDS CLARIFICATION: ¿qué eventos son suscribibles y cómo se autentica/verifica la entrega (firma HMAC)?]
[NEEDS CLARIFICATION: esta capacidad depende del outbox de `sm-0003` (AC-2) — ¿se construye sobre él?]

## Reglas de Negocio

- El scoping por usuario es la base; las cuentas compartidas son la única excepción y deben
  definir permisos explícitos.
- Las cuotas y aportes recurrentes reutilizan `scheduled` y respetan su cadencia (`Frequency`).
- Las columnas tipo-enum se guardan como varchar; los valores viven en la capa de aplicación.

## Fuera de Alcance

- La UI de todas estas capacidades: esta historia define el comportamiento del backend.
- El outbox y el canal de entrega base, que son prerequisito de AC-6, se definen en
  `sm-0003` (AC-2) y `sm-0001` (AC-1) respectivamente.

> Nota: por su tamaño y por depender de decisiones de producto, se recomienda dividir esta
> historia en historias hijas (una por AC) antes de `/design`. Se deja agrupada aquí para
> mantener la visión completa del Grupo E.
