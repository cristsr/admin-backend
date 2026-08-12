# research: hu-0026

Decisiones técnicas no triviales de esta historia. Las ambigüedades del requerimiento ya
las resolvió `/clarify` (ver `hu.md` → «Resolución de Ambigüedades»); acá van solo las
alternativas de **implementación** que el diseño elige y por qué.

---

## Decisión: quién resuelve «la fecha de hoy»

- **Contexto:** AC-1 pide que con `atEffectiveDate: false` la reversa nazca con la fecha de
  hoy, y la decisión consultada fija que la fecha se resuelva **en el agregado** (una sola
  fuente de verdad, dentro del `ReversalPlan`). El agregado necesita entonces acceso al
  instante actual, que es infraestructura.

- **Opciones evaluadas:**
  1. **El agregado recibe el `Clock`** — `reverse(reversalId, atEffectiveDate, clock)`.
     *Pros:* precedente exacto en el mismo agregado (`confirm(clock)`, línea 141, ya recibe
     un `Clock` para timestamps del evento); la elección completa queda encapsulada en el
     dominio; el `Clock` es un puerto (`@cqrs/domain/ports`), no una dependencia de
     infraestructura, así que no viola el Artículo 1.
     *Contras:* el argumento se pasa aunque `atEffectiveDate: true` no lo use.
  2. **El handler pre-calcula y pasa la fecha** — `reverse(reversalId, date: LedgerDate)`.
     *Pros:* el agregado queda sin dependencia temporal; test trivial.
     *Contras:* devuelve la decisión al handler — exactamente lo que la decisión consultada
     descarta. El agregado pasaría a recibir una fecha ya elegida sin poder garantizar que
     `true` significa «la mía».

- **Elegida:** opción 1. El precedente `confirm(clock)` la vuelve la forma idiomática del
  agregado, y es la única que cumple la regla de negocio «la fecha se decide en un solo
  lugar».

- **Descartadas por:** la 2 reintroduce la doble fuente de verdad que la historia viene a
  eliminar.

---

## Decisión: dónde vive la conversión instante → día calendario

- **Contexto:** `LedgerDate` es un día calendario puro (`YYYY-MM-DD`) y **no** sabe
  construirse desde un instante — no hay `LedgerDate.today()`. El único caso existente arma
  el string a mano: `resolve-discrepancy.handler.ts:70` hace
  `this.clock.now().toISOString().slice(0, 10)` sobre un `string`, sin pasar por el VO.

- **Opciones evaluadas:**
  1. **`LedgerDate.today(clock): LedgerDate` en el value object** — *Pros:* la conversión
     queda en el tipo que representa el concepto; un único lugar que define qué zona se usa
     para «hoy», que es precisamente la inconsistencia que `context.md` registra como gap 2;
     el agregado no manipula strings.
     *Contras:* agrega superficie al VO compartido.
  2. **Repetir `clock.now().toISOString().slice(0, 10)` dentro del agregado** — *Pros:*
     cero superficie nueva. *Contras:* tercera copia de una conversión que ya está duplicada,
     y en el dominio, donde manipular strings de fecha es justo lo que el VO existe para
     evitar.
  3. **Un `TodayResolver` (servicio de dominio)** — *Pros:* permitiría inyectar la timezone
     del ledger más adelante. *Contras:* una abstracción para un caso de uso que no existe
     todavía; el Simplicity Gate la rechaza.

- **Elegida:** opción 1, `LedgerDate.today(clock)`. Además de servir a AC-1, deja **un solo
  punto** donde cambiar la semántica de «hoy» si el proyecto decide más adelante unificarla
  con la timezone del ledger (gap 2 de `context.md`).

- **Descartadas por:** la 2 propaga la duplicación al dominio; la 3 es abstracción
  especulativa.

> **Alcance explícito:** esta historia **no** migra `resolve-discrepancy.handler.ts:70` al VO
> nuevo. Es un cambio en otro módulo que el ítem no pide; queda anotado como seguimiento.

---

## Decisión: cómo se construye la reversa a partir del `ReversalPlan`

- **Contexto:** el handler debe pasar a usar el `ReversalPlan`, pero hoy el orden lo impide:
  `LedgerTransaction.record()` genera el id internamente (`new LedgerTransaction(idGenerator.next())`),
  así que el handler crea primero la reversa y recién después llama a `original.reverse(reversing.id)`.
  Si el plan es quien lleva la fecha, el orden debe invertirse: primero el plan, después la
  transacción — y esa transacción tiene que nacer con el `reversalId` que el plan ya declaró.

- **Opciones evaluadas:**
  1. **Factory de dominio dedicado** — `LedgerTransaction.fromReversalPlan(plan, balance): LedgerTransaction`,
     que construye con `plan.reversalId` y emite `TransactionRecorded` con `date`, `postings` y
     `description` del plan, `status: CONFIRMED`, `metadata: { reverses_id: plan.sourceTransactionId }`.
     *Pros:* el plan pasa a ser un contrato real y no un valor muerto; el conocimiento de «cómo
     se ve una reversa» queda entero en el dominio; el handler se reduce a orquestar.
     *Contras:* un método estático más en el agregado.
  2. **`record()` acepta un id opcional** — *Pros:* sin API nueva. *Contras:* ensucia
     `RecordTransactionArgs` con un parámetro que solo un caller usa, y deja abierta la puerta
     a que cualquiera fuerce ids de transacciones normales.
  3. **Mantener el orden actual y pasar solo `atEffectiveDate` al handler** — *Pros:* cambio
     mínimo. *Contras:* es la opción «mínimo» que la decisión consultada ya descartó: la fecha
     seguiría decidiéndose en el handler.

- **Elegida:** opción 1. Mantiene INV-1/INV-2 por el mismo camino (`ensureWellFormed`) y hace
  que el `ReversalPlan` deje de ser código muerto.

- **Descartadas por:** la 2 degrada un contrato público del agregado por conveniencia de un
  caller; la 3 contradice la decisión ya tomada.

---

## Decisión: `TransactionReversed` no registra la elección de fecha

- **Contexto:** la original emite `TransactionReversed(reversalId)`. Podría además registrar
  `atEffectiveDate` para dejar la elección explícita en el stream de la original.

- **Opciones evaluadas:**
  1. **No tocar el evento** — *Pros:* la fecha elegida ya es observable: es el `date` del
     `TransactionRecorded` de la reversa, a la que `reversalId` apunta. No hay pérdida de
     auditoría. Evita el Artículo 9 (nueva `schema_version` + upcaster) por un dato derivable.
     *Contras:* leer la elección exige seguir el vínculo al otro stream.
  2. **Agregar `atEffectiveDate` al payload** — *Pros:* la elección queda literal en el stream
     de la original. *Contras:* dispara versionado de evento y upcaster para almacenar
     información redundante; duplica un hecho en dos streams, que es justo lo que el JSDoc de
     `mergedFrom()` argumenta en contra.

- **Elegida:** opción 1. **Ningún evento cambia de esquema en esta historia** — no se activa el
  Artículo 9.

- **Descartadas por:** la 2 paga el costo del versionado de eventos por un dato derivable.

---

## Decisión: `atEffectiveDate` siempre explícito en el command

- **Contexto:** el default `true` puede resolverse en el DTO, en el controller o en el
  constructor del command. `/clarify` ya fijó «en el controller» por precedente; acá importa la
  consecuencia sobre la idempotencia.

- **Opciones evaluadas:**
  1. **Controller resuelve, command recibe `boolean` requerido** —
     `new ReverseConfirmedTransactionCommand(id, dto.atEffectiveDate ?? true)`.
     *Pros:* `IdempotencyPolicy` hashea `canonicalJson({ userId, command })`: con el valor
     siempre presente, el mismo request produce siempre el mismo hash.
     *Contras:* ninguno relevante.
  2. **Default en el constructor del command (`atEffectiveDate = true`)** — *Contras:* si el
     campo llegara `undefined`, `canonicalJson` podría serializarlo distinto que el literal
     `true`, y dos requests equivalentes producirían hashes distintos: un mismatch de
     idempotencia fantasma (AC-5).

- **Elegida:** opción 1 — parámetro requerido en el command, default resuelto en el borde HTTP.

- **Descartadas por:** la 2 introduce un riesgo real sobre AC-5 sin ganar nada.
