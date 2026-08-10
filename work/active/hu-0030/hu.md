# hu-0030: Paginación por cursor con corte temporal

> Origen: [`docs/proposals/formance-ledger-ideas.md`](../../../docs/proposals/formance-ledger-ideas.md)
> — hallazgos **F-16** (PIT + cursor) y **F-17** (filtros compuestos, recortado).
> Épica: [EP-6](../../ledger/EP-6-formance.md), Ola 3.

## Historia de Usuario

**Como** cliente que recorre listados del ledger
**Quiero** paginar sobre una foto estable de los datos y combinar filtros
**Para** que las transacciones que el automatizador escribe mientras yo paso de página no me
hagan ver elementos duplicados ni saltarme otros

## Criterios de Aceptación

### AC-1: La paginación es por cursor, no por offset

Los listados dejan de aceptar `offset`/`limit` (`page-request.type.ts`) y aceptan un cursor
opaco más un tamaño de página.

Con offset y un stream que crece, paginar produce elementos duplicados o saltados en cuanto
entra una escritura entre dos páginas — que es el caso normal de la bandeja de pendientes con
el automatizador escribiendo.

### AC-2: El cursor es opaco y autocontenido

El cursor codifica el estado de paginación —última clave leída, orden, corte temporal y
filtros— en un string opaco que el cliente devuelve sin interpretarlo.

Un cursor manipulado o inválido se rechaza con un error de validación, no con un resultado
parcial silencioso.

### AC-3: El corte temporal se fija en la primera página

La primera consulta fija un instante de corte (*point in time*). Las páginas siguientes lo
arrastran dentro del cursor y ven exactamente el mismo estado, aunque hayan entrado escrituras
nuevas.

El cliente puede fijarlo explícitamente para consultar el pasado; si no lo envía, se toma el
instante de la consulta.

### AC-4: El corte temporal se apoya en la posición global del stream

El corte se expresa sobre el mismo orden total que RNF-9 ya expone al cliente (posición de
stream), de modo que "leer mis propias escrituras" y "paginar de forma estable" usen el mismo
concepto en vez de dos mecanismos distintos.

[NEEDS CLARIFICATION: ¿el corte se expresa como posición global del stream, como timestamp, o
ambos? La posición es exacta y ya existe; el timestamp es más legible para el cliente pero
ambiguo si dos eventos comparten instante.]

### AC-5: Filtros compuestos acotados a los campos de RF-13

Los listados aceptan combinar filtros con `and`/`or` sobre los campos que RF-13 ya nombra:
cuenta, período, estado, tipo derivado, payee y `client_id` de origen.

Cada campo declara qué operadores admite, y un operador no permitido para un campo se rechaza
con un mensaje que nombra el campo y el operador — no un 500 ni un resultado vacío inexplicable.

### AC-6: Los filtros simples siguen funcionando

Los filtros comunes siguen disponibles como parámetros simples. El lenguaje compuesto es la vía
avanzada, no el reemplazo: un cliente que solo filtra por cuenta y período no necesita
aprenderlo.

### AC-7: Ningún filtro llega crudo al SQL

La validación contra el esquema de campos permitidos es obligatoria y previa a construir la
consulta. Un lenguaje de filtros que llega sin validar al SQL es superficie de inyección y de
consultas patológicas.

### AC-8: El cambio de contrato se versiona

El reemplazo de `offset` por cursor es un cambio incompatible y se trata como tal (RNF-8).

No hay clientes en producción, así que es el momento barato de hacerlo: la historia declara la
versión resultante del API en vez de mantener las dos formas.

[NEEDS CLARIFICATION: ¿se mantiene `offset`/`limit` en paralelo durante una transición, o se
reemplaza directo? Sin clientes en producción, mantener ambos es deuda sin beneficio — pero la
decisión debe ser explícita.]

## Reglas de Negocio

- El núcleo no se entera del cambio: `PageRequest` es un tipo de aplicación y los puertos de
  lectura ya están aislados (`refactor-read-side-ports`). El cambio se concentra en los
  adaptadores de lectura y el contrato OpenAPI.
- El alcance del lenguaje de filtros está **deliberadamente recortado** respecto de la fuente:
  implementar el sistema completo de Formance (operadores por tipo, expansión de recursos,
  plantillas de consulta) sería desproporcionado para este ledger. Solo `and`/`or` sobre los
  campos de RF-13.

## Fuera de Alcance

- Consultas guardadas y versionadas (`query templates` de Formance): resuelven que clientes
  heterogéneos no armen filtros crudos contra una API pública; con dos clientes conocidos es
  indirección sin beneficio.
- Expansión de recursos relacionados (`expand`) en la respuesta.
- Operadores `like` o de texto libre sobre payee: si aparece la necesidad de búsqueda, es otra
  historia con otro diseño.
