# Backlog condicionado

Historias escritas pero **no listas para trabajar**: dependen de una decisión que todavía
no está tomada. No están en `work/active/` para que no compitan con trabajo que sí se puede
hacer, y no están borradas para que la deuda no se vuelva invisible.

Cada una declara su **condición de disparo**. Mientras no se cumpla, diseñarlas produciría
supuestos que la realidad va a contradecir.

| Historia | Condición de disparo |
|---|---|
| [hu-0021](./hu-0021/) — Runbook de rebuild y verificación | Que exista un despliegue real y se haya ejecutado al menos un rebuild sobre datos que le importen a alguien. Un runbook redactado sin haber operado nunca describe un procedimiento imaginado. |
| [hu-0022](./hu-0022/) — Métricas OTel (RNF-12) | Que haya tráfico que observar y un colector al que exportar. Hoy el pump ya loguea con la posición global, que es la señal crítica; el resto no tiene quién lo lea. |

## Lo que se descartó

**hu-0020 — Backups del event store.** Se resuelve a nivel de infraestructura: un dump
completo de la base alcanza, porque el event store es la única fuente de verdad y las
proyecciones se reconstruyen por replay (RNF-5). No hay nada que seleccionar ni código que
escribir.

Lo único que la infraestructura no cubre es **verificar que un backup restaurado produce un
ledger correcto**, y eso ya son tres comandos existentes:

```bash
# restaurar el dump, y después:
nx run ledger:rebuildAll
nx run ledger:verify-balances --userId <uuid>
```

Esa secuencia es una nota para hu-0021, no una historia propia. La pregunta abierta #8 de
la especificación queda cerrada por esta vía.
