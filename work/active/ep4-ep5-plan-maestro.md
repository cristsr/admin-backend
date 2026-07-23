# Plan Maestro — EP-4 (Producto) + EP-5 (Cierre)

## Estado Actual
- ✅ **EP-4.1** (LedgerSettings): ~60% implementado
  - Value Objects: 100% ✅
  - Agregado extendido: 100% ✅
  - Eventos: 100% ✅
  - Projector: 100% ✅
  - Handlers + Query: ~80% (imports menores)
  - Controller: ~80% (imports menores)
  - DDL: 100% ✅
  - Wiring: 100% ✅

## Arquitectura Establecida
El patrón de EP-4.1 establece el framework para EP-4.2..4.6:
- Hexágono por módulo: `domain/` + `application/` + `infrastructure/adapters/`
- Eventos como `DomainEvent` con `eventType`, `schemaVersion`, `toPayload()`/`fromPayload()`
- Value Objects con validación
- Proyecciones asíncronas vía `ReadModelStore`
- Handlers para commands/queries
- Controllers con `@CurrentUser()` + `AuthGuard`
- Migraciones TypeORM para `proj_*` tables

## Ruta de Ejecución Recomendada

### Fase 1: Completar EP-4.1 (1-2 horas)
- [ ] Arreglar imports finales en handlers/controller
- [ ] Verificar `nx build ledger` compila
- [ ] Ejecutar tests completos
- [ ] Wireador en `ledger-event-registry.factory.ts`

### Fase 2: Subtareas Paralelas (puede hacerse en paralelo)

**Grupo A: Reference Data (EP-4.2)**
- `apps/ledger/src/reference/` (Currency + Price)
- ~6 horas
- Bloquea: EP-4.3, EP-4.5

**Grupo B: Product Features (EP-4.3 + EP-4.4 paralelo)**
- `apps/ledger/src/product/budget/` (EP-4.3) — ~8 horas
- `apps/ledger/src/product/goal/` (EP-4.4) — ~6 horas
- Requiere: EP-4.2 para validación de moneda

**Grupo C: Reporting (EP-4.5 + EP-4.6)**
- `apps/ledger/src/reporting/` (Valuation + Reports)
- ~5 horas total
- Requiere: EP-4.1, EP-4.2

### Fase 3: Operabilidad (EP-5, paralelo a EP-4)

**EP-5.0: Pre-requisito — Swap EventStore**
- Cambiar `InMemoryEventStore` → `PostgresEventStore` en `ledger-core.module.ts`
- ~1 hora
- **Bloquea EP-5.2**

**EP-5.1, EP-5.2, EP-5.3, EP-5.4 (Paralelo)**
- Backups: WAL + dump (2-3 horas)
- Runbook rebuild + checker (2-3 horas)
- Retiro de módulos finances (3-4 horas)
- Métricas OTel (2 horas)

## Estimación Total
- **Phase 1 (EP-4.1 finish)**: 2h
- **Phase 2 (EP-4.2..4.6)**: ~25-30h
  - Paralelo reduce a: ~15h si se hace Group B + Group C en paralelo
- **Phase 3 (EP-5)**: ~10-12h
  - Paralelo reduce a: ~6h si Pre-EP-5, EP-5.2, EP-5.3, EP-5.4 en paralelo

**Tiempo estimado end-to-end: ~30-40 horas (realista en 1-2 semanas de trabajo concentrado)**

## Próximos Pasos
1. Terminar EP-4.1 (arreglos de import)
2. Elegir entre:
   - **Opción A**: Ejecución secuencial manual (permite testing completo)
   - **Opción B**: Automatizada con agentes subagentes (+ rápido, menos control)

## Decisiones Técnicas Aplicables a Todo EP-4
- Reutilizar VOs de `shared-kernel` cuando existan (ej: `CurrencyCode`)
- Path aliases: `@ledger/*` mapea a `apps/ledger/src/*`
- Montos: siempre `NUMERIC(20, 6)` en DDL, `string` en DTOs (INV-8)
- Enums: `text` en BD, solo en capa app
- Redondeo half-even: **SOLO en lectura, NUNCA persistido** (§2.7.1)

## Comandos clave para reproducir

```bash
# Verificar compilación
npx nx build ledger

# Ejecutar tests de un módulo
npx jest src/settings --passWithNoTests

# Ejecutar migración
npm run migration:run

# Validación completa
npx nx test ledger && npx nx lint ledger && npx nx build ledger
```

## Dependencias de Implementación (grafo)

```
EP-4.1 (settings) ──────┐
                         ├──> EP-4.5 (valuation) ──> EP-4.6 (reports)
EP-4.2 (reference) ─────┤
                         ├──> EP-4.3 (budget)
                         └──> EP-4.4 (goal)

Pre-EP-5 (PostgreSQL) ──┐
                         ├──> EP-5.2 (backups)
                         ├──> EP-5.3 (rebuild)
                         ├──> EP-5.4 (metrics)
                         └──> EP-5.1 (deprecate)
```

## Riesgos Identificados
1. **Imports**: Path aliases vs rutas relativas — resuelto con estructura de EP-4.1
2. **Concurrencia optimista**: Ya implementada en EP-1.5, reutilizar
3. **Determinismo de proyecciones**: Contract tests aseguran — verificar en rebuild
4. **Consistencia eventual**: Aceptable per RNF-8 para vistas no críticas
5. **Moneda multi-currency**: Decisión de diseño en EP-4.3 — documentar restricción v1
