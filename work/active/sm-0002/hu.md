# sm-0002: Reportes y analítica de finanzas

## Historia de Usuario

**Como** usuario del backend de finanzas
**Quiero** reportes y analítica que vayan más allá del `summary` actual (balance, top-5 gastos, últimos movimientos)
**Para** entender mi flujo de dinero en el tiempo, por categoría, comercio y método de pago, y anticipar el cierre del mes

> Contexto: agrupa las ideas del **Grupo B** de `LLUVIA_DE_IDEAS.md`. El dominio ya persiste
> todo lo necesario (fechas, tipos, `merchant`, `paymentMethod`, `scheduled`); falta agregarlo.

## Criterios de Aceptación

### AC-1: Serie temporal de flujo de caja

El sistema expone ingresos vs. gastos agregados por período dentro de un rango de fechas
explícito (`from`/`to`, ISO date), para graficar la evolución del flujo de caja.

- El endpoint recibe el rango vía `from`/`to` y una `granularity` con valores `day | week |
month | year`; el server agrupa el rango en buckets de ese tamaño.
- El agregado separa ingresos de gastos por cada bucket de la granularidad elegida.
- Excluye `TRANSFER_IN`/`TRANSFER_OUT` (usa `reportableMovementTypes`): mover dinero entre
  cuentas propias no es ingreso ni gasto.
- Asume una sola moneda por usuario: cada bucket devuelve totales simples, sin desglose por
  moneda ni conversión (la conversión vive en `sm-0001` y queda fuera de alcance).
- Está scopeado al usuario autenticado.

### AC-2: Gasto por categoría/subcategoría con comparativa de período anterior

El sistema expone el gasto agregado por categoría con sus subcategorías anidadas para un
rango `from`/`to`, junto a la variación respecto del período anterior equivalente.

- Devuelve, por categoría, el total gastado en el rango y el delta (absoluto y/o porcentual)
  contra el período anterior, definido como el tramo de igual duración que termina justo antes
  de `from` (los `to - from` días inmediatamente previos al rango pedido).
- Cada categoría trae anidadas sus subcategorías con el mismo total + delta. Como cada
  movimiento pertenece a una única subcategoría y cada subcategoría a una única categoría, el
  agregado por subcategoría rola exactamente al de su categoría (sin doble conteo). El desglose
  viene siempre anidado, no depende de un parámetro.
- Solo considera movimientos de tipo `EXPENSE`.

### AC-3: Proyección de cierre de mes

El sistema estima el saldo/gasto proyectado al cierre del período combinando el estado actual
con los `scheduled` pendientes que caen dentro de lo que resta del período. El período es el
rango `from`/`to` que pasa el cliente (no un mes calendario fijo); "el cierre" es `to`.

- La proyección suma al estado actual las ocurrencias de movimientos programados cuya próxima
  fecha cae entre hoy y `to` (el fin del rango).
- No incorpora tendencia ni promedio histórico: es determinista (estado actual + `scheduled`
  pendientes), para que el resultado sea explicable y testeable sin modelos estadísticos.

### AC-4: Reporte por comercio (`merchant`)

Los datos de comercio ya se persisten (`movements.merchant`) pero nadie los agrega. El sistema
expone el total y el conteo de operaciones agrupado por comercio dentro de un rango, separando
gasto de ingreso.

- Devuelve, por `merchant`, el total y la cantidad de movimientos en el período, desglosados
  por tipo (`EXPENSE` e `INCOME` en columnas separadas). Excluye `TRANSFER_IN`/`TRANSFER_OUT`
  igual que el resto de los reportes.
- Los movimientos sin `merchant` (nulo/vacío) se agrupan en una fila propia etiquetada "Sin
  comercio", no se excluyen, para que el total del reporte cuadre con el gasto real del rango.

### AC-5: Reporte por método de pago

El sistema expone el gasto agregado por `paymentMethod` (CASH/DEBIT/CREDIT/TRANSFER/OTHER)
en un rango, para separar consumo a crédito del resto.

- Devuelve el total por cada método de pago presente en el período.
- Los movimientos con `paymentMethod` nulo se agrupan en una fila propia etiquetada "Sin
  método", no se excluyen (simétrico con "Sin comercio" de AC-4), para que el total cuadre.

### AC-6: Exportación de movimientos a CSV/Excel

El sistema permite exportar los movimientos de un rango a un archivo descargable, para
contabilidad o impuestos. Reusa los filtros ya existentes (fecha, cuenta, categoría, tipo).

- La exportación respeta los mismos filtros que `GET /movements`.
- Soporta ambos formatos, seleccionables por parámetro `format=csv|xlsx`.
- La generación es asíncrona: se encola un job (pgmq) que procesa los registros y deja el
  archivo disponible para descarga posterior; el request inicial no devuelve el archivo directo.
- Está scopeada al usuario autenticado.
- Columnas exportadas, en este orden: Fecha, Tipo, Cuenta, Categoría, Subcategoría, Comercio,
  Método de pago, Monto, Moneda, Descripción, Programado. Los encabezados van en español
  (coherente con el idioma del proyecto); las celdas de enum (Tipo, Método de pago) se exportan
  con su etiqueta legible, no con el código interno.

## Resolución de Ambigüedades

- **AC-1 / AC-2 / AC-3 (modelo de período):** ¿Fechas libres o período calendario? → Rango
  explícito `from`/`to` (ISO date) en todos los reportes de rango, igual que `GET /movements`.
  El "período anterior" de AC-2 y "el cierre" de AC-3 se derivan de ese rango.
- **AC-1 (granularidad):** ¿Qué granularidades y cómo se piden? → Parámetro `granularity` con
  valores `day | week | month | year`; el server agrupa el rango en buckets de ese tamaño.
- **AC-1 (moneda, transversal):** ¿Cómo se tratan monedas distintas en un agregado? → Se asume
  una sola moneda por usuario (totales simples, sin desglose ni conversión); la conversión es de
  `sm-0001` y queda fuera de alcance.
- **AC-2 (comparativa):** ¿Contra qué período se compara? → Contra el tramo de igual duración
  que termina justo antes de `from` (los `to - from` días inmediatamente previos), no contra el
  mes calendario anterior.
- **AC-3 (definición del período):** ¿Mes calendario en curso o rango arbitrario? → El rango
  `from`/`to` del cliente; la proyección proyecta hasta `to`.
- **AC-6 (formato):** ¿CSV, XLSX o ambos? → Ambos, seleccionables por parámetro `format=csv|xlsx`.
- **AC-6 (generación sync/async):** ¿Respuesta directa o job asíncrono? → Asíncrona vía cola
  pgmq detrás de un puerto `abstract class` intercambiable; descarga posterior.
- **AC-2 (subcategoría):** ¿Parámetro opcional o siempre anidado? → Siempre anidado (categoría
  → sus subcategorías). Cada movimiento tiene una única subcategoría que pertenece a una única
  categoría, así que el agregado por subcategoría rola exacto al de su categoría, sin doble conteo.
- **AC-3 (alcance de la proyección):** ¿Solo `scheduled` o también tendencia histórica? → Solo
  `scheduled` pendientes hasta `to`; proyección determinista, sin modelos estadísticos.
- **AC-4 (sin `merchant`):** ¿Omitir o "Sin comercio"? → Agrupar como "Sin comercio" (no se
  excluyen), para que el total cuadre con el gasto real del rango.
- **AC-4 (tipo de movimiento):** ¿Solo `EXPENSE` o también ingresos? → Ambos, desglosando
  `EXPENSE` e `INCOME` por comercio en columnas separadas; transferencias excluidas.
- **AC-5 (`paymentMethod` nulo):** ¿Excluir o "Sin método"? → Agrupar como "Sin método"
  (simétrico con "Sin comercio" de AC-4).
- **AC-6 (columnas/idioma):** ¿Qué columnas y en qué idioma? → Set fijo (Fecha, Tipo, Cuenta,
  Categoría, Subcategoría, Comercio, Método de pago, Monto, Moneda, Descripción, Programado) con
  encabezados en español y enums exportados con etiqueta legible.

## Reglas de Negocio

- Solo `INCOME`/`EXPENSE` cuentan como ingreso/gasto real en los reportes; las transferencias
  se excluyen siempre.
- Todos los reportes van scopeados al usuario autenticado.
- Los movimientos soft-deleted no se cuentan en ningún agregado.

## Fuera de Alcance

- La conversión de moneda subyacente que varios reportes necesitan para consolidar monedas —
  se define en `sm-0001` (AC-2). Esta historia asume esa capacidad disponible o un solo tipo de moneda.
- Dashboards/visualización en el front: esta historia entrega los datos, no la UI.

## Technical Context

### Microservicio objetivo

- `finances` — nuevo módulo `reports` (`apps/finances/src/reports/`)

### Artefactos a reutilizar

- Entidades y artefactos del sistema ya existentes donde apliquen (repositorio/consulta de
  movements, `reportableMovementTypes`, filtros de `GET /movements`)
- Crear entidades/artefactos específicos de `reports` solo cuando sea estrictamente necesario

### Patrones obligatorios

- Seguir las convenciones del proyecto (CLAUDE.md + `.agents/profile.md`): arquitectura
  hexagonal por módulo, puertos como `abstract class` para DI, un caso de uso por acción,
  DTOs `*-input`/`*-output`/`*-filter` con mappers separados, columnas tipo-enum como `varchar`

### Restricciones técnicas

- No introducir ni quitar propiedades en las entidades de dominio existentes salvo que sea
  estrictamente necesario
- Reportes read-only: no mutan movements ni su esquema

### Integraciones conocidas

- `exceljs` para generar el export en formato XLSX
- Cola `pgmq` (ya usada en el proyecto para notificaciones de presupuesto) para procesar el
  export de forma asíncrona, detrás de un puerto `abstract class` fácilmente intercambiable
