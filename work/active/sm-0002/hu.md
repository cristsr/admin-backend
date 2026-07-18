# sm-0002: Reportes y analítica de finanzas

## Historia de Usuario

**Como** usuario del backend de finanzas
**Quiero** reportes y analítica que vayan más allá del `summary` actual (balance, top-5 gastos, últimos movimientos)
**Para** entender mi flujo de dinero en el tiempo, por categoría, comercio y método de pago, y anticipar el cierre del mes

> Contexto: agrupa las ideas del **Grupo B** de `LLUVIA_DE_IDEAS.md`. El dominio ya persiste
> todo lo necesario (fechas, tipos, `merchant`, `paymentMethod`, `scheduled`); falta agregarlo.

## Criterios de Aceptación

### AC-1: Serie temporal de flujo de caja

El sistema expone ingresos vs. gastos agregados por período (día/semana/mes) dentro de un
rango de fechas, para graficar la evolución del flujo de caja.

- El agregado separa ingresos de gastos por cada intervalo del período elegido.
- Excluye `TRANSFER_IN`/`TRANSFER_OUT` (usa `reportableMovementTypes`): mover dinero entre
  cuentas propias no es ingreso ni gasto.
- Está scopeado al usuario autenticado.

[NEEDS CLARIFICATION: ¿qué granularidades se soportan (día, semana, mes, año) y cómo se pide (parámetro `granularity`)?]
[NEEDS CLARIFICATION: ¿cómo se tratan movimientos en distinta moneda dentro del mismo período — se convierten (depende de sm-0001 AC-2), se separan por moneda, o se asume una sola moneda por usuario?]

### AC-2: Gasto por categoría/subcategoría con comparativa de período anterior

El sistema expone el gasto agregado por categoría (y opcionalmente subcategoría) para un
período, junto a la variación respecto del período anterior equivalente.

- Devuelve, por categoría, el total gastado en el período y el delta (absoluto y/o porcentual)
  contra el período inmediatamente anterior de igual duración.
- Solo considera movimientos de tipo `EXPENSE`.

[NEEDS CLARIFICATION: ¿la comparativa es contra el período calendario anterior (mes anterior) o contra los N días inmediatamente previos al rango pedido?]
[NEEDS CLARIFICATION: ¿el desglose por subcategoría es un parámetro opcional o siempre viene anidado?]

### AC-3: Proyección de cierre de mes

El sistema estima el saldo/gasto proyectado al cierre del período combinando el estado actual
con los `scheduled` pendientes que caen dentro de lo que resta del período.

- La proyección suma al estado actual las ocurrencias de movimientos programados cuya próxima
  fecha cae antes del fin del período.

[NEEDS CLARIFICATION: ¿la proyección considera solo `scheduled` confirmados, o también una tendencia/promedio de gasto histórico?]
[NEEDS CLARIFICATION: ¿qué define "el período" de la proyección — mes calendario en curso, o un rango arbitrario que pasa el cliente?]

### AC-4: Reporte por comercio (`merchant`)

Los datos de comercio ya se persisten (`movements.merchant`) pero nadie los agrega. El sistema
expone el gasto total y el conteo de operaciones agrupado por comercio dentro de un rango.

- Devuelve, por `merchant`, el total y la cantidad de movimientos en el período.
- Movimientos sin `merchant` se agrupan aparte o se excluyen de forma consistente.

[NEEDS CLARIFICATION: ¿los movimientos sin `merchant` se omiten o se muestran como "Sin comercio"?]
[NEEDS CLARIFICATION: ¿el reporte se limita a `EXPENSE`, o incluye ingresos por comercio también?]

### AC-5: Reporte por método de pago

El sistema expone el gasto agregado por `paymentMethod` (CASH/DEBIT/CREDIT/TRANSFER/OTHER)
en un rango, para separar consumo a crédito del resto.

- Devuelve el total por cada método de pago presente en el período.

[NEEDS CLARIFICATION: los movimientos con `paymentMethod` nulo — ¿se agrupan como "Sin método" o se excluyen?]

### AC-6: Exportación de movimientos a CSV/Excel

El sistema permite exportar los movimientos de un rango a un archivo descargable, para
contabilidad o impuestos. Reusa los filtros ya existentes (fecha, cuenta, categoría, tipo).

- La exportación respeta los mismos filtros que `GET /movements`.
- Está scopeada al usuario autenticado.

[NEEDS CLARIFICATION: ¿el formato es CSV, XLSX, o ambos seleccionables?]
[NEEDS CLARIFICATION: ¿qué columnas incluye el export y en qué idioma van los encabezados?]
[NEEDS CLARIFICATION: ¿la generación es síncrona (respuesta directa) o asíncrona (job + descarga posterior) para volúmenes grandes?]

## Reglas de Negocio

- Solo `INCOME`/`EXPENSE` cuentan como ingreso/gasto real en los reportes; las transferencias
  se excluyen siempre.
- Todos los reportes van scopeados al usuario autenticado.
- Los movimientos soft-deleted no se cuentan en ningún agregado.

## Fuera de Alcance

- La conversión de moneda subyacente que varios reportes necesitan para consolidar monedas —
  se define en `sm-0001` (AC-2). Esta historia asume esa capacidad disponible o un solo tipo de moneda.
- Dashboards/visualización en el front: esta historia entrega los datos, no la UI.
