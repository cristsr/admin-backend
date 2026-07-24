# design: hu-0003

## Flujo entre microservicios

Un solo microservicio (`apps/ledger`) contiene tanto los agregados event-sourced
`Account` y `LedgerTransaction` como los adapters HTTP que exponen sus comandos.
No hay llamadas entre microservicios — las validaciones cruzadas (INV-3/INV-4) se
resuelven contra la proyección `account_tree` dentro del mismo proceso, con
consistencia relajada. El diagrama completo de secuencia está en `docs/diagram.md`.

## Componentes del módulo

Esta historia introduce los agregados `Account` y `LedgerTransaction` (capa de
dominio), sus repositorios y command handlers (capa de aplicación), y los
controladores HTTP + módulos NestJS (capa de infraestructura) en los directorios
`accounts/` y `transactions/` de `apps/ledger/src/`. El diagrama C4 Nivel 3
completo está en `docs/component.md`.

## Impacto en Arquitectura Global

**¿Toca arquitectura global?** No.

El alcance está circunscrito a los módulos `accounts/` y `transactions/` dentro
de `apps/ledger`, que ya existen en la base de código actual. No se introduce
ningún nuevo microservicio, lib compartida, ni integración externa.

- **Nivel:** N/A
- **Cambio:** Ninguno
- **Nodo/arista concreto:** N/A

## Contratos por microservicio

### apps/ledger

| Método | Ruta | Descripción de negocio |
|--------|------|-------------------------|
| POST | /accounts | Abrir una cuenta contable |
| GET | /accounts | Listar el árbol de cuentas |
| GET | /accounts/{id} | Obtener una cuenta por ID |
| GET | /accounts/{id}/balance | Saldos por moneda de una cuenta |
| POST | /accounts/{id}/rename | Renombrar una cuenta |
| POST | /accounts/{id}/close | Cerrar una cuenta |
| POST | /transactions | Registrar una transacción |
| GET | /transactions | Listar y filtrar transacciones |
| GET | /transactions/{id} | Obtener una transacción por ID |
| POST | /transactions/{id}/amend | Enmendar una transacción pendiente |
| POST | /transactions/{id}/annotate | Anotar una transacción |
| POST | /transactions/{id}/confirm | Confirmar una transacción |
| POST | /transactions/{id}/void | Anular una transacción pendiente |
| POST | /transactions/{id}/reverse | Reversar una transacción confirmada |

> Schemas de request/response, validaciones y códigos de respuesta completos: `docs/api.yaml`.

## Validación de Quality Gates

| Gate | Resultado | Justificación |
|------|-----------|---------------|
| Simplicity | ✅ | Sin capas ni abstracciones nuevas — los agregados siguen el patrón `AggregateRoot` existente en `shared-kernel` |
| Anti-Abstraction | ✅ | Se usa NestJS + CommandBus directo en los controladores, sin wrapper propio |
| Integration-First | ✅ | El contrato OpenAPI (`docs/api.yaml`) refleja los endpoints exactos del código existente |
| Test-First | ✅ | Todos los agregados y handlers existentes tienen tests (`*.spec.ts`); TDD es requisito explícito en las Reglas de Negocio |
