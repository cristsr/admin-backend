# hu-0019: Catálogo de monedas administrable vía API

## Historia de Usuario

**Como** cliente autenticado del ledger
**Quiero** registrar monedas con su precisión decimal (`minor_units`) vía API y
consultarlas
**Para** poder operar cuentas en monedas que hoy no están sembradas en el código, sin
recompilar ni deployar el servicio

## Criterios de Aceptación

### AC-1: El catálogo deja de estar fijado en código

`SeedCurrencyCatalog` sirve hoy un mapa constante `{ COP: 0, USD: 2 }` declarado en
`seed-currency-catalog.ts:8-11`, con un comentario que anticipa este reemplazo. El
`CurrencyCatalog` pasa a resolverse desde una proyección alimentada por eventos, sin que
el núcleo cambie: el puerto `CurrencyCatalog` y su firma `resolve(code): Currency` se
mantienen intactos.

### AC-2: Evento y command de registro

Existe el evento `CurrencyRegistered` y el command que lo emite, con `code` (ISO-4217) y
`minorUnits`.

[NEEDS CLARIFICATION: ¿el catálogo de monedas es **global del sistema** o **por usuario**?
Todo lo demás en el ledger está particionado por `user_id`, pero una moneda es un dato de
referencia universal: COP tiene 0 decimales para todos. Un catálogo por usuario obliga a
sembrar monedas en cada inicialización de ledger; uno global rompe el patrón de
particionado y necesita decidir quién puede escribirlo.]

### AC-3: Proyección del catálogo

Un projector mantiene la tabla de monedas desde `CurrencyRegistered`, con su migración
correspondiente y registro en el tooling de rebuild (RNF-5).

### AC-4: Endpoint de registro

`POST /v1/currencies` registra una moneda con contexto autenticado (RF-26) e idempotencia
por referencia externa (RF-11).

### AC-5: Endpoint de consulta

`GET /v1/currencies` lista las monedas registradas con su `minor_units`.

### AC-6: Validación de `minor_units`

`minorUnits` es un entero entre 0 y un máximo razonable. Registrar una moneda con
precisión inválida se rechaza con un código de error de dominio estable (RF-14).

[NEEDS CLARIFICATION: ¿cuál es el máximo aceptado para `minorUnits`? ISO-4217 llega hasta
4 (p. ej. CLF, UYW), pero `NUMERIC(20,6)` en las proyecciones soporta 6.]

### AC-7: Re-registrar una moneda existente

[NEEDS CLARIFICATION: ¿qué pasa al registrar una moneda que ya existe — es idempotente
(no-op), se rechaza, o permite corregir `minor_units`? Corregir la precisión de una moneda
con transacciones ya registradas cambiaría el significado de montos históricos, lo que
choca con el principio #5 (inmutabilidad económica).]

### AC-8: Las monedas semilla siguen disponibles

COP y USD siguen resolviéndose tras el cambio, sea porque se siembran en la
inicialización del ledger, sea por una migración que las inserta en la proyección. Ninguna
transacción existente deja de poder deserializarse (RNF-6).

### AC-9: Una moneda desconocida sigue fallando igual

Resolver una moneda no registrada sigue lanzando `UnknownCurrencyException` con el mismo
código de error estable que hoy, desde el adaptador nuevo.

## Reglas de Negocio

- Todo monto porta su moneda; las cuentas reales operan en su única moneda declarada
  (RF-21).
- El registro de monedas es un evento fechado (RF-21).
- La precisión decimal de cada moneda gobierna la serialización exacta de montos
  (INV-8, RNF-2): COP 0 decimales, USD 2. Prohibido float.

## Fuera de Alcance

- Registro de tasas de cambio `PriceRecorded` (RF-22) y corrección por superposición
  (§2.6): fuera del alcance del ledger por el recorte del 2026-07-25 — es dato de
  referencia externo cuyo único consumidor era la valoración.
- Valoración y conversión entre monedas (RF-23): fuera del alcance por el mismo recorte.
