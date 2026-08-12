# design: sm-0034

## Flujo entre microservicios

Este ítem no involucra múltiples apps ni comunicación entre servicios. Extiende
el script de verificación `tools/validate-diagrams.ts` en dos direcciones:
(1) agrega verificación inversa (código → diagrama) para detectar símbolos sin
documentar, y (2) crea un script independiente `tools/verify-c4-translations.ts`
que compara las `dynamic view` LikeC4 originales contra sus `sequenceDiagram`
Mermaid actuales. Además crea dos unidades de documentación nuevas
(`apps/ledger/docs/ledger/`, `libs/shared/docs/`) y migra 3 flujos entre
unidades.

> Diagramas completos: [`docs/diagram.md`](./docs/diagram.md).

## Componentes del módulo

Se agregan 4 funciones nuevas a `tools/validate-diagrams.ts`
(`collectDocumentedSymbols`, `collectDocumentableSymbols`, más las constantes
`DOCUMENTABLE_PATTERN` y la lógica en `main`), un script CLI nuevo
(`tools/verify-c4-translations.ts` con sus helpers de parsing), y se modifica
el mapa `UNITS` (2 entradas nuevas, 1 corregida). `tools/validate-diagrams.spec.ts`
gana tests negativos para las 3 clases de error.


## Impacto en Arquitectura Global

**¿Toca arquitectura global?** No.

El cambio es interno al tooling de verificación y a la documentación de los
módulos existentes. No se agregan apps, libs, integraciones externas, ni actores
nuevos. La creación de `libs/shared/docs/` documenta una lib que ya existía en
el diagrama de contenedores (Nivel 2); no la agrega.

## Contratos por microservicio

Este ítem no agrega ni modifica endpoints de API. El `api.delta.yaml` es
mínimo — solo declara la ausencia de cambios de contrato.

> Contrato API: [`docs/api.delta.yaml`](./docs/api.delta.yaml).

## Modelado de datos

No aplica. El ítem no crea ni modifica tablas de base de datos.

## Validación de Quality Gates

| Gate | Resultado | Justificación |
|------|-----------|---------------|
| Simplicity | ✅ | No se agregan capas ni abstracciones: los scripts usan las mismas funciones (`walk`, `extractIdentifiers`) que el validador existente. `verify-c4-translations.ts` es un script CLI autónomo, no un microservicio ni un módulo NestJS. |
| Anti-Abstraction | ✅ | El parsing de `.c4` y Mermaid se hace con regex sobre el DSL existente, sin introducir una librería de parsing ni un modelo intermedio. La verificación inversa reusa `collectSymbols`, `walk` y `extractIdentifiers` del validador actual. |
| Integration-First | ✅ | No hay integraciones nuevas. El contrato API (`api.delta.yaml`) declara explícitamente la ausencia de cambios. El diseño describe la interfaz de cada función nueva antes de implementarla. |
| Test-First | ✅ | AC-5 exige tests negativos que fallen antes del código de producción. El plan escribirá los tests primero, consistente con el Artículo 4 (TDD estricto). |
