---
version: 1.2.0
ratified: 2026-07-23
last_amended: 2026-08-08
---

# Constitución del Proyecto — admin-back

## Propósito

Este documento define los principios **no-negociables** que gobiernan el
diseño, la implementación y la revisión de código de este proyecto. Es
**normativo** (usa DEBE / NUNCA), no descriptivo. Ante conflicto entre este
documento y cualquier otra guía (`docs/`, comentarios, costumbre), **prevalece
la constitución**.

Las skills del flujo lo consumen así:
- `/design` valida los **Quality Gates** antes de aprobar un contrato.
- `/plan` respeta los artículos al generar tareas.
- La revisión de código (humana o `conventions-reviewer`) chequea cumplimiento.

Este proyecto tiene dos apps con alcances distintos: `apps/finances` (monolito
congelado pendiente de reemplazo) y `apps/ledger` (su reemplazo event-sourced,
en desarrollo activo). Cada artículo indica su alcance explícitamente.

---

## Principios (Artículos)

### Artículo 1: Núcleo aislado de infraestructura

**Principio:** El código de `domain/` y `application/` de `apps/ledger` NUNCA
importa `@nestjs/*` ni `typeorm` ni ningún driver o protocolo concreto; todo
acceso a infraestructura entra por puertos definidos como `abstract class`,
verificados con contract tests que corren idénticos contra el adaptador real
(PostgreSQL) y el in-memory.

**Razón:** mantiene el dominio testeable sin infraestructura y evita que un
invariante de negocio dependa de un detalle de adaptador (RNF-11).

**Cómo se verifica:** review de imports en `domain/`/`application/` + suite de
contract tests en CI.

*Alcance: `apps/ledger`.*

### Artículo 2: El agregado es la transacción, no el posting

**Principio:** `LedgerTransaction` es el único agregado que valida el balance
a cero por moneda de sus postings; el invariante se verifica de forma síncrona
y transaccional al procesar cada comando, antes de emitir cualquier evento.

**Razón:** el balance a cero (INV-1) debe ser una garantía interna atómica, no
una validación externa o eventual.

**Cómo se verifica:** tests del agregado `LedgerTransaction` (INV-1, INV-2) +
review de que ningún comando bypassee el agregado.

*Alcance: `apps/ledger`.*

### Artículo 3: Event store append-only

**Principio:** Ningún evento se edita ni se borra en ninguna capa del sistema;
las correcciones son siempre eventos nuevos (reversas, ajustes, anotaciones).

**Razón:** la auditabilidad y la reconstrucción por replay dependen de que el
stream nunca se reescriba (INV-12).

**Cómo se verifica:** constraint append-only a nivel de storage + review de
que no exista ningún `UPDATE`/`DELETE` sobre la tabla de eventos.

*Alcance: `apps/ledger`.*

### Artículo 4: TDD estricto

**Principio:** Todo archivo de producción se precede por su `*.spec.ts`
correspondiente; un cambio que agregue código de producción sin test previo se
rechaza en review, salvo backfill documentado explícitamente como excepción
(ver `/hotfix` y las excepciones registradas en `design.md`).

**Razón:** sostiene la disciplina test-first declarada como no negociable en
`CLAUDE.md` y evita deuda de cobertura silenciosa.

**Cómo se verifica:** review + Test-First Gate de `/design` y `/plan`.

*Alcance: todo el repo.*

### Artículo 5: Aislamiento por usuario

**Principio:** Todo evento pertenece a un único `userId`; ninguna query,
proyección ni comando cruza datos entre usuarios.

**Razón:** es la garantía mínima de multi-tenancy del ledger; una fuga cruzada
es un incidente de seguridad, no un bug funcional (INV-9).

**Cómo se verifica:** contract tests de cada puerto de lectura con `userId`
variado + review de queries.

*Alcance: `apps/ledger`.*

### Artículo 6: Idempotencia por referencia externa

**Principio:** Todo command que acepte `external_ref` es idempotente: repetirlo con la
misma referencia **y los mismos inputs** para el mismo usuario nunca emite eventos
nuevos y retorna el resultado original. Repetirlo con la misma referencia e **inputs
distintos** se rechaza de forma explícita (`IDEMPOTENCY_INPUT_MISMATCH`, 409): devolver
el resultado viejo perdería la operación nueva en silencio.

**Razón:** los clientes automatizados (integraciones bancarias) reintentan; sin la
primera mitad de la garantía se duplicarían transacciones reales (INV-10, RNF-4). Sin
la segunda, un reuso accidental de la referencia con datos distintos se resolvía
silenciosamente contra el resultado viejo — el fallo que hu-0024 cierra.

**Cómo se verifica:** tests de idempotencia por handler + el contract test de
`IdempotencyPolicy` que cubre los dos caminos (pre-check y carrera concurrente).

*Alcance: `apps/ledger`.*

### Artículo 7: Dinero sin float

**Principio:** Ningún monto de dinero se representa como `number`/float en
ninguna capa; `Money` rechaza en construcción valores con más decimales que
los `minor_units` de su moneda, y siempre serializa/deserializa como string
decimal.

**Razón:** la exactitud monetaria (INV-8, RNF-2) es la base de la partida
doble; un error de redondeo de punto flotante rompe el balanceo.

**Cómo se verifica:** tests de `Money` + round-trip de serialización (como los
de `posting.serializer.spec.ts`/`transaction-recorded.event.spec.ts`) + review
de tipos.

*Alcance: todo el repo (aplica a `Money` de `@shared`, usado por `ledger` y
potencialmente por `finances`).*

### Artículo 8: Comentarios en inglés y enums en la capa de aplicación

**Principio:** Todo comentario del código está en inglés (JSDoc para clases,
métodos y exports públicos); los enums de negocio viven solo en la capa de
aplicación, nunca como enum de base de datos (columnas `varchar`/`text`).

**Razón:** consistencia de idioma para el equipo, y evita que un cambio de
enum requiera una migración de esquema de base de datos.

**Cómo se verifica:** review + lint de `eslint-plugin-jsdoc`; revisión de
migraciones (nunca `CREATE TYPE ... AS ENUM`).

*Alcance: todo el repo.*

### Artículo 9: Versionado de eventos, nunca migración in situ

**Principio:** Los cambios de esquema de un evento se resuelven agregando una
nueva `schema_version` y un upcaster en deserialización; nunca se reescriben
eventos ya persistidos.

**Razón:** el event store es append-only (Artículo 3) y es la fuente de
auditoría — mutarlo retroactivamente destruye esa garantía (RNF-6).

**Cómo se verifica:** tests de `EventRegistry` de upcasting v(n) → v(n+1).

*Alcance: `apps/ledger`.*

### Artículo 10: CQRS estricto

**Principio:** Los command handlers nunca retornan representaciones de
lectura (solo identificadores, posición de stream y errores); los projectors
son los únicos escritores de los read models.

**Razón:** mezclar lectura y escritura en el mismo componente reintroduce el
acoplamiento que CQRS busca eliminar y complica el rebuild de proyecciones
(RNF-10).

**Cómo se verifica:** review de firmas de command handlers + tests de
projectors.

*Alcance: `apps/ledger`.*

### Artículo 11: El núcleo no conoce integraciones externas

**Principio:** El dominio y la aplicación de `ledger` no tienen conocimiento
de fuentes externas específicas (bancos, formatos de archivo, proveedores);
toda integración entra por el API con un `client_id` opaco.

**Razón:** mantiene el núcleo reutilizable ante cualquier origen de datos
futuro sin acoplarlo a un proveedor concreto.

**Cómo se verifica:** review de dependencias del dominio/aplicación — ningún
import ni referencia a un proveedor nombrado.

*Alcance: `apps/ledger`.*

### Artículo 12: Balanceo centralizado

**Principio:** La lógica de balanceo (INV-1) vive en un único componente del
dominio; futuras extensiones (balanceo al costo, otros modos) extienden ese
componente, nunca lo duplican en otro lugar.

**Razón:** duplicar la lógica de balanceo es la forma más directa de
introducir una inconsistencia contable no detectada (INV-11).

**Cómo se verifica:** review de que no exista una segunda implementación de
suma-a-cero fuera del componente designado.

*Alcance: `apps/ledger`.*

### Artículo 13: Imports por ruta completa, no por barrel

**Principio:** Los imports entre carpetas usan la ruta completa del archivo con
el alias del app (`@ledger/accounts/application/open-account/open-account.command`).
No se agregan `index.ts` de reexportación salvo donde ya existen: eventos de un
agregado, DTOs de un adaptador HTTP, value objects compartidos y puertos de un
módulo — conjuntos cerrados que se consumen como una unidad.

**Razón:** el alias ya hace la ruta legible, y la ruta dice en qué capa y en qué
caso de uso vive lo importado, que es exactamente lo que una revisión de
fronteras necesita ver. Un barrel por carpeta lo esconde: `import { X } from
'@ledger/accounts'` no delata si `X` es un agregado, un handler o un adaptador.
El guard de `hexagonal-isolation.spec.ts` compara **segmentos de ruta**, así que
un barrel intermedio también le quitaría precisión.

Esta es una desviación deliberada de la convención "un barrel por carpeta" de la
skill `hexagonal-architecture`; se documenta acá para que no se reabra en cada
review.

**Cómo se verifica:** review. Un `index.ts` nuevo fuera de los cuatro casos
listados se justifica o se rechaza.

*Alcance: `apps/ledger`, `libs/cqrs`.*

---

## Quality Gates obligatorios

Checklist binaria que `/design` (y donde aplique `/plan`) debe pasar antes de
aprobar. Cada gate se cumple o se documenta explícitamente por qué no aplica.
Estos cuatro ya se venían aplicando informalmente (ver `design.md` de
hu-0001); esta constitución los formaliza.

- [ ] **Simplicity Gate** — no se agrega ninguna capa/proyecto/abstracción sin
  un caso de uso presente que lo justifique.
- [ ] **Anti-Abstraction Gate** — se usa el framework/librería directo antes
  de envolverlo en una abstracción propia.
- [ ] **Integration-First Gate** — el contrato (OpenAPI/schema) y los contract
  tests están definidos antes de implementar el endpoint.
- [ ] **Test-First Gate** — el test se escribe y falla antes del código de
  producción.

---

## Restricciones de flujo de trabajo

- Nunca ejecutar `/build`, `/hotfix`, `/sync` o `/commit` sobre la rama base
  (`master`).
- Estilo de commit: `type(scope): message` (conventional commits, ver
  `git log` para el estilo exacto vigente).
- `/commit` verifica el índice de git antes y después de cada `git add`; nunca
  se asume que el índice está vacío al empezar (ver incidente documentado en
  la skill `commit`).

---

## Gobernanza

**Enmiendas:** cualquier cambio a este documento se hace vía `/constitution`
(modo enmendar), con versión actualizada y fecha en `last_amended`.

**Versionado semántico del documento:**
- **MAJOR** — se elimina o redefine un principio de forma incompatible.
- **MINOR** — se agrega un principio, gate o sección nueva.
- **PATCH** — aclaración de redacción sin cambiar el alcance.

**Precedencia:** ante conflicto, esta constitución prevalece sobre `docs/` y
sobre cualquier convención tácita. Si una historia necesita violar un
principio, eso es una excepción explícita que debe justificarse y aprobarse,
no una decisión silenciosa de implementación.
