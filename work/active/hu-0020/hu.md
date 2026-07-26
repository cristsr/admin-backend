# hu-0020: Backups automatizados del event store y prueba de restauración

## Historia de Usuario

**Como** responsable de operar el ledger
**Quiero** backups automatizados del event store con una prueba de restauración
verificable
**Para** poder recuperar la contabilidad completa ante una pérdida de datos — el stream es
la única fuente de verdad y no hay forma de reconstruirlo desde las proyecciones

## Criterios de Aceptación

### AC-1: Backup automatizado del event store

Existe un mecanismo automatizado que respalda la tabla `event_store` y su secuencia de
`global_position`, con periodicidad definida y retención definida.

[NEEDS CLARIFICATION: ¿dónde corre el backup y dónde se guarda? Las opciones cambian el
entregable por completo: cron dentro del contenedor de la app, un `CronJob` de la
plataforma de despliegue, o backups gestionados por el proveedor de Postgres. El
despliegue del ledger aún no está definido — el roadmap solo dice "app y base de datos
propias, deployable independiente".]

### AC-2: El backup incluye todo lo necesario para reconstruir

El respaldo cubre `event_store` (append-only, la verdad) y las tablas de proyección son
explícitamente **excluidas o incluidas** según decisión registrada: las proyecciones son
reconstruibles por replay (RNF-5), así que respaldarlas es opcional y solo acelera la
recuperación.

### AC-3: Prueba de restauración ejecutable

Existe un procedimiento ejecutable que restaura un backup sobre una base limpia y verifica
que el resultado es correcto, no solo que el comando terminó sin error.

### AC-4: La verificación post-restauración usa el tooling existente

Tras restaurar, `nx run ledger:rebuildAll` reconstruye las proyecciones desde el stream
restaurado y `nx run ledger:verify-balances` confirma la consistencia entre stream y
proyecciones (RNF-5). El tooling ya existe; esta historia lo integra al procedimiento de
recuperación.

### AC-5: La prueba de restauración corre sola

La prueba de restauración se ejecuta de forma periódica y automática, no solo a demanda:
un backup que nunca se probó no es un backup.

[NEEDS CLARIFICATION: ¿la prueba de restauración corre en CI, en un entorno dedicado, o
como job programado? Depende de la respuesta de AC-1.]

### AC-6: Documentación operativa

El procedimiento queda documentado con los comandos exactos, dónde viven los backups, cómo
restaurar y cómo verificar. Existió un `ops/EP-5-backups.md` que fue borrado en el commit
`aaa87cc`; esta historia produce el documento definitivo, alineado con la decisión de
AC-1.

## Reglas de Negocio

- El event stream es la única fuente de verdad; las proyecciones son derivadas y
  reconstruibles (principio de diseño #2, RNF-5).
- El event store es append-only: un backup nunca necesita reconciliar actualizaciones,
  solo capturar hasta una `global_position`.
- **Obligatorio antes de operar con datos reales** (pregunta abierta #8 de la
  especificación). Hoy no hay datos en producción y nada está deployado.

## Fuera de Alcance

- Alta disponibilidad, replicación o failover: esta historia cubre respaldo y
  recuperación, no continuidad de servicio.
- El runbook de rebuild de proyecciones: es hu-0021.
