# hu-0032: Metadata de cuenta y borrado por clave

> Origen: [`docs/proposals/formance-ledger-ideas.md`](../../../docs/proposals/formance-ledger-ideas.md)
> — hallazgo **F-19**.
> Épica: [EP-6](../../ledger/EP-6-formance.md), Ola 3. **Conviene antes de `hu-0031`** (su AC-5
> declara metadata por defecto en el plan de cuentas).

## Historia de Usuario

**Como** usuario del ledger
**Quiero** guardar datos propios en mis cuentas y poder quitar una anotación puntual de una
transacción
**Para** no tener que meter esa información en el nombre de la cuenta —que es lo que ensucia el
plan contable— ni reenviar el objeto entero para borrar una sola etiqueta

## Criterios de Aceptación

### AC-1: Las cuentas admiten metadata clave-valor

El agregado `Account` admite metadata arbitraria clave-valor, con sus eventos propios.

Hoy `Account` (§2.1) tiene tipo, nombre, monedas y fechas, pero ningún lugar para "últimos 4
dígitos", "color en el frontend" o "id de la cuenta en el banco". Sin este lugar, esos datos
terminan en el nombre de la cuenta —degradando la jerarquía— o en el cliente, donde se pierden.

### AC-2: Establecer y borrar metadata de cuenta son eventos distintos

Establecer metadata emite un evento; borrar una clave emite otro. Ambos entran al stream con el
envelope estándar (§3.4).

El borrado es **por clave**, no reemplazo del objeto completo.

### AC-3: Las anotaciones de transacción admiten borrado por clave

`TransactionAnnotated` permite hoy agregar anotaciones (payee, description, invoice_url, tags,
metadata) pero no quitar una.

Se añade el borrado por clave: quitar una etiqueta puesta por error deja de exigir reenviar el
objeto completo.

### AC-4: La intención de borrar queda en el stream

Reenviar el objeto completo para borrar una clave es *last-write-wins*: el stream registra el
estado nuevo pero pierde la intención ("quité este tag"), que es justamente lo que el event
sourcing debería conservar.

Tras esta historia, un borrado es un hecho explícito y auditable.

### AC-5: La metadata es anotativa, nunca económica

INV-6 se mantiene sin excepciones: la metadata de cuenta y las anotaciones de transacción no
tocan postings, montos, monedas ni fechas contables, y no alteran ningún saldo.

Una transacción `CONFIRMED` sigue admitiendo anotación; sus atributos económicos siguen siendo
inmutables.

### AC-6: La metadata se proyecta y se consulta

`proj_accounts` expone la metadata de cada cuenta, y las consultas de cuenta la devuelven. El
rebuild por replay la reproduce igual (RNF-5).

### AC-7: Límites definidos

[NEEDS CLARIFICATION: ¿hay límite de cantidad de claves, longitud de clave o tamaño del valor
por cuenta/transacción? Sin límite, la metadata es un vector para inflar el stream —que es
append-only e irreducible— con datos que nadie va a leer.]

### AC-8: Borrar una clave inexistente tiene comportamiento definido

[NEEDS CLARIFICATION: borrar una clave que no existe ¿es un no-op silencioso (idempotente, no
emite evento) o un error `NOT_FOUND`? Formance devuelve error; el no-op es más amable con
reintentos.]

## Reglas de Negocio

- Los eventos de metadata entran al hash de la cadena (`hu-0024`, AC-3) como cualquier otro
  evento: son decisiones del usuario, no derivados.
- No se adopta la historización opcional de metadata que Formance ofrece como capacidad
  activable: el stream **ya es** el historial. Guardar una tabla de versiones aparte sería
  duplicar lo que el event sourcing da gratis.

## Fuera de Alcance

- Metadata a nivel de ledger completo (Formance la tiene; aquí `LedgerSettings` ya cubre lo que
  el dominio necesita).
- Consultar o filtrar cuentas por el contenido de su metadata: si aparece la necesidad, entra
  por el lenguaje de filtros de `hu-0030`.
