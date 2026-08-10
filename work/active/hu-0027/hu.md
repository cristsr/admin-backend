# hu-0027: Volúmenes y doble fecha en el read model

> Origen: [`docs/proposals/formance-ledger-ideas.md`](../../../docs/proposals/formance-ledger-ideas.md)
> — hallazgos **F-1** (volúmenes input/output) y **F-3** (doble fecha en los postings).
> Épica: [EP-6](../../ledger/EP-6-formance.md), Ola 2. **Prerrequisito de hu-0028 y hu-0029.**

## Historia de Usuario

**Como** consumidor de las proyecciones del ledger
**Quiero** que los saldos se expresen como volúmenes de entrada y salida, y que cada posting
registre tanto su fecha contable como cuándo se proyectó
**Para** saber cuánto entró y cuánto salió de cada cuenta sin recorrer todos los postings, y
para poder ordenar de forma estable movimientos de la misma fecha

## Criterios de Aceptación

### AC-1: `proj_balances` almacena volúmenes, no un escalar

La proyección de saldos deja de almacenar un único monto por estado y almacena el par
`(input, output)` por cuenta y moneda, para cada una de las dos poblaciones que hoy distingue
(confirmada y pendiente).

El proyector acumula `input += max(amount, 0)` y `output += max(−amount, 0)` a partir del monto
con signo. **No** se adopta el posting unidireccional de Formance: el modelo con signo se
mantiene intacto (§2.3).

### AC-2: El saldo es siempre derivado, nunca almacenado

`balance = input − output` se calcula al leer. No existe una tercera columna persistida con el
saldo: persistirla reintroduce el estado inconsistente que INV-5 evita.

### AC-3: Las lecturas exponen las tres magnitudes

Las consultas de saldo devuelven `input`, `output` y `balance` por cuenta y moneda, para
confirmados y pendientes. Los consumidores actuales que solo leen el saldo siguen funcionando.

### AC-4: `proj_postings` registra fecha contable y fecha de inserción

`proj_postings` gana `insertion_date` (cuándo el posting fue proyectado) junto a la `date`
contable que ya tiene. Ambas se pueblan en la proyección.

Sin las dos fechas separadas no se puede reconstruir "qué sabía el sistema en un momento dado"
ni ordenar de forma estable dos movimientos con la misma fecha contable.

### AC-5: El orden de desempate queda definido

Dos postings de la misma cuenta con la misma fecha contable se ordenan por `occurred_at` cuando
ambos lo tienen, y por posición global del stream cuando alguno no lo tiene.

Este orden es el que consumirá `hu-0028` para calcular volúmenes efectivos.

### AC-6: La verificación de consistencia compara volúmenes

`ConsistencyVerifier` deja de comparar un escalar contra el stream y compara las dos magnitudes
por separado.

Un error de signo en un proyector —que hoy puede cancelarse en el neto y quedar invisible— pasa
a ser detectable.

### AC-7: El rebuild reproduce volúmenes idénticos

Truncar y reconstruir por replay (RNF-5) produce exactamente los mismos `input` y `output` que
la proyección incremental, para cualquier secuencia de eventos.

## Reglas de Negocio

- Las proyecciones no llevan constraints de negocio (§6.3): la verdad vive en el stream y un
  bug se corrige por rebuild, nunca editando datos.
- El cambio se confina a `proj_balances`, `proj_postings` y sus proyectores. Ninguna otra
  proyección se entera.

## Fuera de Alcance

- Volúmenes post-commit por transacción (F-2): es `hu-0028`, que depende de esta.
- Agregación de volúmenes por prefijo de la jerarquía (F-18): es `hu-0029`.
- Duplicar cada posting en dos filas (una por lado), como hace la tabla `moves` de Formance:
  innecesario con montos con signo.
