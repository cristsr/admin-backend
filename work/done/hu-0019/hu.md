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

### AC-2: Evento y command de registro, con catálogo **global del sistema**

Existe el evento `CurrencyRegistered` y el command que lo emite, con `code` (ISO-4217) y
`minorUnits`.

El catálogo es **global**, no por usuario: una moneda es un dato de referencia universal
—COP tiene 0 decimales para todos— y no un dato de negocio de nadie. Es una excepción
consciente al Artículo 5, acotada a datos de referencia.

La razón técnica pesa igual: `CurrencyCatalog.resolve(code)` es **síncrono** y lo consumen
22 archivos, incluida la deserialización de eventos (`BalanceAsserted.fromPayload` y
compañía). Un catálogo por usuario obligaría a propagar `userId` hasta la rehidratación del
stream; uno global conserva la firma intacta.

El stream del catálogo se identifica con un `aggregateId` fijo y conocido, no con un
`user_id`.

### AC-3: Proyección del catálogo

Un projector mantiene la tabla de monedas desde `CurrencyRegistered`, con su migración
correspondiente y registro en el tooling de rebuild (RNF-5).

### AC-4: Endpoint de registro

`POST /v1/currencies` registra una moneda con contexto autenticado (RF-26) e idempotencia
por referencia externa (RF-11).

### AC-5: Endpoint de consulta

`GET /v1/currencies` lista las monedas registradas con su `minor_units`.

### AC-6: Validación de `minorUnits` entre 0 y 4

`minorUnits` es un entero de **0 a 4**, el rango que define ISO-4217 (0 para COP o JPY, 2
para USD o EUR, 4 para CLF y UYW). Registrar una moneda fuera de ese rango se rechaza con un
código de error de dominio estable (RF-14).

`Currency.of` ya valida que sea un entero no negativo; esta historia agrega el techo.

### AC-7: Re-registrar es idempotente si nada cambia, y se rechaza si difiere

- Registrar una moneda **idéntica** a la existente (mismo código, mismos `minorUnits`) es un
  no-op: no emite evento y responde `2xx` (RNF-4). Un reintento de red se resuelve solo.
- Registrar el mismo código con **distinta precisión** se rechaza con un código estable.
  Cambiar los `minorUnits` de una moneda reinterpretaría el significado de todos los montos
  ya registrados en ella —`100` pasaría de ser 100 a ser 1,00— y eso viola el principio de
  diseño #5, la inmutabilidad económica de lo ya registrado.

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
