---
use_case: register-currency
module: reference
trigger: rest
entrypoint: POST /v1/currencies
command: RegisterCurrencyCommand
view: registerCurrency
invariants: [RF-21, RF-11, RF-26, INV-8, RNF-4, principio #5]
introduced_by: hu-0019
last_modified_by: hu-0019
status: active
---

# Registrar una moneda

Agrega una moneda al catálogo de referencia con su precisión decimal. A partir de ahí el
ledger puede abrir cuentas y registrar montos en ella, sin recompilar.

El command corre contra el stream global del catálogo, no contra el del usuario que
registra: la precisión de una moneda es universal. El `client_id` del llamante igual viaja
en el envelope para auditoría (RF-12).

**Diagrama:** dynamic view `registerCurrency` en [`../reference.c4`](../reference.c4).

## Reglas

- **`minorUnits` entre 0 y 4 (ISO-4217).** Fuera de rango se rechaza con
  `INVALID_MINOR_UNITS`.
- **Re-registrar con la misma precisión es un no-op** (RNF-4): no emite evento y responde
  `2xx`. Un reintento de red se resuelve solo.
- **Re-registrar con otra precisión se rechaza** con `CURRENCY_PRECISION_CONFLICT`. Cambiar
  la precisión de una moneda reinterpretaría el significado de todo monto ya registrado en
  ella; es exactamente lo que prohíbe el principio de diseño #5.
- **La caché se refresca tras persistir**, para que el próximo `resolve` síncrono vea la
  moneda sin esperar a un poller.
- **Idempotencia por referencia externa** (RF-11) además de la del dominio.

## Errores

| Condición | Excepción | HTTP |
|---|---|---|
| `minorUnits` fuera de 0..4 | `InvalidMinorUnitsException` | 422 |
| El código ya existe con otra precisión | `CurrencyPrecisionConflictException` | 409 |
| Código fuera de ISO-4217 (formato) | validación del DTO | 400 |
| Sin contexto autenticado | — (guard, RF-26) | 401 |

## Respuesta

`201 Created` con `CommandAcceptedDto` y el header `X-Ledger-Stream-Position`.
