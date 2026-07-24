---
use_case: detect-transfer
module: transactions
trigger: domain-event
entrypoint: TransactionRecorded
command: MergePendingTransfersCommand
view: detectTransfer
invariants: [RF-4]
introduced_by: hu-0004
last_modified_by: hu-0005
status: active
---

# Detectar transferencia

Flujo **no iniciado por REST**: lo dispara el evento de dominio `TransactionRecorded`.
El `TransferCandidatesProjector` consume el evento, delega en el `TransferDetector` el
emparejamiento de postings candidatos y, si hay match, despacha `MergePendingTransfersCommand`
para fusionar los movimientos como una transferencia.

**Diagrama:** dynamic view `detectTransfer` en [`../transactions.c4`](../transactions.c4).

## Trigger

- **Tipo:** `domain-event` (adaptador secundario: projector suscrito al event store).
- **Entrypoint:** evento `TransactionRecorded`.
- No hay endpoint HTTP de entrada; el resultado sí es observable vía `GET /transactions`
  (los movimientos aparecen clasificados como `DerivedKind = TRANSFER`).

## Reglas

- **RF-4:** la clasificación `TRANSFER` la deriva la proyección, no el usuario.
- El emparejamiento respeta ventana temporal y montos opuestos por moneda
  (config en `transfer-detection.config.ts`).

## Notas de versión

- `hu-0004`: introduce la detección y el projector de candidatos.
- `hu-0005`: agrega el `MergePendingTransfersCommand` y el handler de fusión.
