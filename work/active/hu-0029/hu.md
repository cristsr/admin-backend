# hu-0029: Saldos agregados por prefijo de la jerarquía

> Origen: [`docs/proposals/formance-ledger-ideas.md`](../../../docs/proposals/formance-ledger-ideas.md)
> — hallazgo **F-18**.
> Épica: [EP-6](../../ledger/EP-6-formance.md), Ola 2. **Depende de `hu-0027`.**

## Historia de Usuario

**Como** cliente del ledger
**Quiero** consultar el saldo agregado de un subárbol de cuentas
**Para** saber cuánto tengo en todas las cuentas de un banco, o cuánto gasté en toda una
categoría, sin tener que sumar las hojas yo mismo

## Criterios de Aceptación

### AC-1: Consulta de saldo por prefijo de la jerarquía

Existe una consulta que devuelve el saldo agregado de todas las cuentas bajo un prefijo dado de
la jerarquía por nombre (§2.1), p. ej. `Assets:Bancolombia` agrega `Assets:Bancolombia:Ahorros`
y `Assets:Bancolombia:CreditCard`.

La jerarquía por nombre existe precisamente para agrupar; hoy las proyecciones solo dan saldo
por cuenta exacta y cada cliente reimplementa la agregación con sus propios bugs.

### AC-2: La agregación es siempre por moneda

El resultado se devuelve **por moneda**, nunca consolidado en una sola.

Consolidar monedas distintas exige tasas de cambio y redondeo de presentación, que son capa de
producto (§4.2, principio de diseño #7). Sumar un subárbol no requiere ninguna de las dos, por
lo que esta consulta **no** cae en la exclusión de alcance: es contabilidad, no reporte.

### AC-3: Agrupación por profundidad de segmentos

Además del prefijo exacto, la consulta acepta agrupar por los primeros N segmentos del nombre,
devolviendo un saldo por cada grupo distinto a esa profundidad.

Ejemplo: profundidad 2 sobre `Expenses` devuelve una fila por `Expenses:Food`,
`Expenses:Subscriptions`, etc.

### AC-4: Incluye volúmenes cuando están disponibles

Con `hu-0027` aplicada, la consulta agrega `input` y `output` además del saldo, de modo que el
subárbol responde también "cuánto entró y cuánto salió", no solo "cuánto queda".

### AC-5: Distingue confirmado de pendiente

La agregación mantiene separadas las dos poblaciones que `proj_balances` ya distingue, sin
sumarlas: un consumidor que necesite el total lo hace explícitamente.

### AC-6: Comportamiento definido ante cuentas cerradas

[NEEDS CLARIFICATION: ¿las cuentas cerradas (`AccountClosed`) entran en la agregación? Una
cuenta cerrada con saldo cero no cambia el resultado, pero una cerrada con saldo residual sí.
¿Se incluyen siempre, se excluyen siempre, o es un parámetro de la consulta?]

### AC-7: La consulta se sirve desde proyecciones

La agregación se resuelve sobre `proj_balances` y `proj_accounts`, sin lógica de dominio ni
acceso al event store (RNF-10).

## Reglas de Negocio

- Es el complemento natural de `get-account-tree`, que ya existe: el árbol da la estructura,
  esta consulta da los saldos de cada nodo del árbol.
- La agregación por prefijo se apoya en que los postings referencian `account_id` y el nombre
  es un atributo renombrable (§2.1.1): un renombre cambia los grupos sin tocar ningún posting.

## Fuera de Alcance

- Conversión a moneda de presentación y patrimonio neto consolidado (RF-23): capa de producto.
- Filtro por patrón de segmentos con comodines (`Assets:*:Ahorros`). Formance lo soporta con un
  índice dedicado de segmentos; aquí no hay caso de uso que lo pida.
