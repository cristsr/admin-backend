# spec-0033: Migrar los diagramas de LikeC4 a Mermaid — Plan de Implementación

**Historia:** `work/active/spec-0033/`
**Unidades afectadas:** `apps/ledger/docs/*` (5 módulos) · `libs/cqrs` · `docs/architecture` · raíz del repo · `~/.agents` (fuera del repo)
**Objetivo:** reemplazar los 7 archivos LikeC4 por diagramas Mermaid inline, con un gate de CI propio que impida que un diagrama nombre código inexistente.
**Arquitectura:** el validador se construye **primero** y en TDD estricto — es el andamio que verifica las 6 tareas de migración que le siguen, no un cierre. Cada unidad de documentación se migra completa y se valida antes de pasar a la siguiente, de modo que un error de traducción se detecta en su propia tarea y no 40 archivos después.
**Stack:** TypeScript · Node/ts-node · Jest (`*.spec.ts`) · Mermaid
**Grupos de implementación:** Tareas 4-7 (`accounts`, `transactions`, `reconciliation`, `reference`) son independientes entre sí y van marcadas `[P]`. Las Tareas 8 y 9 son secuenciales: `shared` absorbe contenido de `shared-kernel/diagram.md` **antes** de que la Tarea 9 elimine esa carpeta.

> **Historia sin código de aplicación.** No se toca `apps/ledger/src/` (regla de negocio),
> no hay entidad, migración, DTO ni endpoint. El único código de producción es
> `tools/validate-diagrams.ts`, y es el único lugar donde aplica el ciclo TDD clásico.
> En las tareas de documentación el criterio verificable equivalente es
> `npm run docs:validate` en verde más el conteo de artefactos.

### Trazabilidad AC → Tareas

| AC | Cubierto por |
|----|-------------|
| AC-1 — diagrama inline por caso de uso | Tarea 4, 5, 6, 7, 8, 9 |
| AC-2 — componentes por módulo en Mermaid | Tarea 4, 5, 6, 7, 8, 9 |
| AC-3 — L1+L2 con una sola fuente de verdad | Tarea 10 |
| AC-4 — sin rastro de LikeC4 | Tarea 11, 15 |
| AC-5 — gate de validación en CI | Tarea 1, 2, 3, 15 |
| AC-6 — profile actualizado | Tarea 12 |
| AC-7 — skills SDD generan Mermaid | Tarea 13 |
| AC-8 — propuesta vigente superada | Tarea 14 |

---

### Tarea 0: Commitear lo pendiente y crear la rama

**Step 1: Verificar el estado actual**

```bash
git branch --show-current
git status --porcelain | wc -l
```
Esperado: `feat/core` y ~28 archivos. Son el cierre de hu-0026 y los artefactos de
spec-0033 (`work/active/spec-0033/`).

**Step 2: Commitear lo pendiente en `feat/core`**

Agrupar en dos commits, verificando el índice antes y después de cada `git add`
(Artículo de flujo de `rules.md` — nunca asumir el índice vacío):

```bash
git status --porcelain          # verificar índice ANTES
git add apps/ledger docs/decisions.md docs/ledger-spec.md work/done/hu-0026
git status --porcelain          # verificar índice DESPUÉS
git commit -m "feat(ledger): close hu-0026 reversal date selection"

git status --porcelain
git add work/active/spec-0033
git status --porcelain
git commit -m "docs(spec-0033): add spec, context and design artifacts"
```
Esperado: working tree limpio.

**Step 3: Crear la rama de trabajo**

```bash
git checkout -b docs/SPEC-0033-mermaid-diagrams
git status --porcelain          # esperado: vacío
```
Esperado: rama nueva y activa, partiendo de `feat/core` con todo commiteado.

---

### Tarea 1: Test del validador de diagramas (rojo)

**Archivos:**
- Crear: `tools/validate-diagrams.spec.ts`
- Crear (fixtures): `tools/__fixtures__/diagrams/`

> Artículo 4 de `rules.md` — TDD estricto, alcance *todo el repo*. El test se escribe y
> falla antes de que exista el script.

**Step 1: Escribir el test que falla**

En `tools/validate-diagrams.spec.ts`:

```typescript
import { collectSymbols, extractIdentifiers, validateFile } from './validate-diagrams';

describe('collectSymbols', () => {
  // Every declaration form must be covered: a missed modifier makes the gate report a
  // healthy reference as broken, and the natural reaction is to fix the diagram instead
  // of the script. `canonicalJson` (export async function) already hit this.
  it.each([
    ['export class Foo {}', 'Foo'],
    ['export abstract class Bar {}', 'Bar'],
    ['export async function canonicalJson() {}', 'canonicalJson'],
    ['export function sha256Hex() {}', 'sha256Hex'],
    ['export const REEVALUATION_TRIGGERS = [];', 'REEVALUATION_TRIGGERS'],
    ['export type StreamId = string;', 'StreamId'],
    ['export interface Envelope {}', 'Envelope'],
    ['export enum PostingOrigin {}', 'PostingOrigin'],
    ['export default class Baz {}', 'Baz'],
  ])('indexes %s', (source, expected) => {
    expect(collectSymbols([], { sources: [source] })).toContain(expected);
  });

  it('ignores non-exported declarations', () => {
    expect(collectSymbols([], { sources: ['class Internal {}'] })).not.toContain('Internal');
  });
});

describe('extractIdentifiers — sequenceDiagram', () => {
  it('takes the visible name after "as", not the alias', () => {
    const block = 'sequenceDiagram\n  participant CB as PolicyCommandBus';
    expect(extractIdentifiers(block)).toEqual([
      { name: 'PolicyCommandBus', line: 2 },
    ]);
  });

  it('takes the bare name when there is no alias', () => {
    const block = 'sequenceDiagram\n  participant EventStore';
    expect(extractIdentifiers(block)).toEqual([{ name: 'EventStore', line: 2 }]);
  });

  it('skips whitelisted external actors', () => {
    const block = 'sequenceDiagram\n  actor Client\n  participant U as User';
    expect(extractIdentifiers(block)).toEqual([]);
  });
});

describe('extractIdentifiers — flowchart', () => {
  it('takes the label of a symbol node', () => {
    const block = 'flowchart TB\n  LT("LedgerTransaction")';
    expect(extractIdentifiers(block)).toEqual([
      { name: 'LedgerTransaction', line: 2 },
    ]);
  });

  it('strips the <br/> suffix used for the stereotype', () => {
    const block = 'flowchart TB\n  ES("EventStore<br/>abstract class")';
    expect(extractIdentifiers(block)).toEqual([{ name: 'EventStore', line: 2 }]);
  });

  it('exempts cylinder nodes — they name a table, not a class', () => {
    const block = 'flowchart TB\n  TL[("transaction_list")]';
    expect(extractIdentifiers(block)).toEqual([]);
  });

  it('exempts subgraphs — they group, they do not name a symbol', () => {
    const block = 'flowchart TB\n  subgraph domain["Domain"]\n  end';
    expect(extractIdentifiers(block)).toEqual([]);
  });
});

describe('validateFile', () => {
  const symbols = new Set(['LedgerTransaction']);

  it('reports nothing when every identifier resolves', () => {
    const md = '```mermaid\nflowchart TB\n  LT("LedgerTransaction")\n```';
    expect(validateFile('a.md', md, symbols)).toEqual([]);
  });

  it('reports file, line and identifier when one does not resolve', () => {
    const md = '```mermaid\nflowchart TB\n  X("GhostHandler")\n```';
    expect(validateFile('a.md', md, symbols)).toEqual([
      { file: 'a.md', line: 3, name: 'GhostHandler' },
    ]);
  });

  it('reports every failure, it does not stop at the first', () => {
    const md = '```mermaid\nflowchart TB\n  A("GhostOne")\n  B("GhostTwo")\n```';
    expect(validateFile('a.md', md, symbols)).toHaveLength(2);
  });

  it('ignores fenced blocks that are not mermaid', () => {
    const md = '```typescript\nclass GhostHandler {}\n```';
    expect(validateFile('a.md', md, symbols)).toEqual([]);
  });
});
```

**Step 2: Ejecutar y confirmar que falla**

```bash
npx jest tools/validate-diagrams.spec.ts --no-coverage
```
Esperado: FAIL — `Cannot find module './validate-diagrams'`.

---

### Tarea 2: Implementación del validador (verde)

**Archivos:**
- Crear: `tools/validate-diagrams.ts`

**Step 1: Implementar**

En `tools/validate-diagrams.ts`:

```typescript
/**
 * Verifies that every identifier in a Mermaid block names a real symbol of the
 * documented code. Direction is doc -> code only: it never checks that all code is
 * documented. See docs/proposals/docs-as-code-mermaid.md.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Documentation unit -> its own code root. Explicit on purpose: implicit derivation is
 * what let apps/ledger/docs/shared-kernel/ survive pointing at relocated code. */
const UNITS: Record<string, string> = {
  'apps/ledger/docs/accounts': 'apps/ledger/src/accounts',
  'apps/ledger/docs/reconciliation': 'apps/ledger/src/reconciliation',
  'apps/ledger/docs/reference': 'apps/ledger/src/reference',
  'apps/ledger/docs/shared': 'apps/ledger/src/shared',
  'apps/ledger/docs/transactions': 'apps/ledger/src/transactions',
  'libs/cqrs/docs': 'libs/cqrs/src',
};

/** Always searched too: a ledger module may legitimately name the cross-cutting
 * policy that governs it (shared -> DryRunPolicy, which lives in libs/cqrs). */
const SHARED_ROOTS = ['libs/cqrs/src', 'libs/shared/src', 'apps/ledger/src/shared'];

/** The only by-name exemption. Everything else is exempted by its node shape. */
const EXTERNAL_ACTORS = new Set(['Client', 'User', 'Usuario', 'Postgres', 'Keycloak']);

const DECLARATION =
  /^\s*export\s+(?:default\s+)?(?:declare\s+)?(?:abstract\s+)?(?:async\s+)?(?:class|interface|type|enum|const|let|function\*?)\s+([A-Za-z_$][\w$]*)/;

export interface Finding {
  file: string;
  line: number;
  name: string;
}

function walk(dir: string, ext: string): string[] {
  let out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out = out.concat(walk(full, ext));
    else if (entry.endsWith(ext) && !entry.endsWith('.spec.ts')) out.push(full);
  }
  return out;
}

export function collectSymbols(
  roots: string[],
  opts: { sources?: string[] } = {},
): Set<string> {
  const symbols = new Set<string>();
  const contents =
    opts.sources ?? roots.flatMap((r) => walk(r, '.ts')).map((f) => readFileSync(f, 'utf8'));
  for (const content of contents) {
    for (const line of content.split('\n')) {
      const hit = DECLARATION.exec(line);
      if (hit) symbols.add(hit[1]);
    }
  }
  return symbols;
}

export function extractIdentifiers(block: string): Finding[] {
  const found: Finding[] = [];
  block.split('\n').forEach((raw, index) => {
    const line = index + 1;
    const text = raw.trim();

    if (text.startsWith('subgraph') || text.startsWith('actor ')) return;

    const participant = /^participant\s+(\S+)(?:\s+as\s+(.+))?$/.exec(text);
    if (participant) {
      const name = (participant[2] ?? participant[1]).trim();
      if (!EXTERNAL_ACTORS.has(name)) found.push({ file: '', line, name });
      return;
    }

    // Cylinder [( )] names a table, not a class -> exempt. Must be tested before
    // the generic node pattern, which would otherwise swallow it.
    if (/^\S+\[\(/.test(text)) return;

    const node = /^\S+[[(]{1,2}"?([^"\])]+)"?[\])]{1,2}/.exec(text);
    if (node) {
      const name = node[1].split('<br/>')[0].trim();
      if (!EXTERNAL_ACTORS.has(name)) found.push({ file: '', line, name });
    }
  });
  return found;
}

export function validateFile(file: string, content: string, symbols: Set<string>): Finding[] {
  const findings: Finding[] = [];
  const lines = content.split('\n');
  let start = -1;

  lines.forEach((line, index) => {
    if (line.trim().startsWith('```mermaid')) start = index;
    else if (line.trim() === '```' && start >= 0) {
      const block = lines.slice(start + 1, index).join('\n');
      for (const hit of extractIdentifiers(block)) {
        if (!symbols.has(hit.name)) {
          findings.push({ file, line: start + 1 + hit.line, name: hit.name });
        }
      }
      start = -1;
    }
  });
  return findings;
}

function main(): void {
  const all: Finding[] = [];
  for (const [docRoot, codeRoot] of Object.entries(UNITS)) {
    const symbols = collectSymbols([codeRoot, ...SHARED_ROOTS]);
    for (const file of walk(docRoot, '.md')) {
      all.push(...validateFile(relative(process.cwd(), file), readFileSync(file, 'utf8'), symbols));
    }
  }

  if (all.length === 0) {
    console.log('✓ Every Mermaid identifier resolves to a real symbol.');
    return;
  }
  // Walk everything and report all breaks before exiting -- same CLI convention the
  // repo already uses for its verification tooling.
  for (const f of all) console.error(`✗ ${f.file}:${f.line} — "${f.name}" does not resolve`);
  console.error(`\n${all.length} broken reference(s).`);
  process.exit(1);
}

if (require.main === module) main();
```

**Step 2: Ejecutar y confirmar que pasa**

```bash
npx jest tools/validate-diagrams.spec.ts --no-coverage
```
Esperado: PASS — todos los casos en verde.

**Step 3: Correr contra el repo (aún sin migrar)**

```bash
npx ts-node tools/validate-diagrams.ts
```
Esperado: `✓ Every Mermaid identifier resolves` — todavía no hay bloques Mermaid en las
unidades, así que no hay nada que resolver. Confirma que no explota con el árbol real.

---

### Tarea 3: Cablear el gate al script npm y al CI

**Archivos:**
- Modificar: `package.json:16-18`
- Modificar: `.github/workflows/ci.yml:26-27`

**Step 1: Reemplazar los scripts npm**

En `package.json`, borrar `docs:preview` y `docs:export`, y redefinir:

```json
"docs:validate": "ts-node tools/validate-diagrams.ts",
```

**Step 2: Cambiar el paso del job `docs`**

En `.github/workflows/ci.yml`, reemplazar el paso `Validate LikeC4 model`:

```yaml
      - name: Validate diagram references
        run: npm run docs:validate
```

**Step 3: Verificar**

```bash
npm run docs:validate
```
Esperado: PASS. El job `docs` conserva su estructura y su paso de `oasdiff`; solo cambia
el comando de validación.

---

### Tarea 4: Migrar el módulo `accounts` [P]

**Archivos:**
- Modificar: los 9 `apps/ledger/docs/accounts/flows/*.md`
- Crear: `apps/ledger/docs/accounts/flows/record-opening-balance.md`
- Modificar: `apps/ledger/docs/accounts/README.md`
- Eliminar: `apps/ledger/docs/accounts/accounts.c4`

**Step 1: Traducir las 10 `dynamic view`**

`accounts.c4` tiene 10 vistas para 9 flows. Por cada flow existente:

1. Insertar un bloque ` ```mermaid ` con `sequenceDiagram` traducido 1:1 de su vista
   (`origen -> destino 'msg'` → `origen->>destino: msg`), conservando orden y texto.
2. Incorporar el `title`/`description` de la vista como prosa — no se descartan.
3. Borrar la clave `view:` del frontmatter y la línea `**Diagrama:** dynamic view …`.

La vista huérfana `recordOpeningBalance` (línea 202) genera
`flows/record-opening-balance.md` nuevo, con frontmatter completo:
`use_case: record-opening-balance`, `module: accounts`, `trigger: rest`,
`entrypoint: POST /accounts/{id}/opening-balance`,
`command: RecordOpeningBalanceCommand`, `introduced_by: hu-0025`,
`last_modified_by: spec-0033`, `status: active`.

**Step 2: Diagrama de componentes en el README**

Convertir los 14 componentes de `accounts.c4` a un `flowchart TB` con subgraphs
`domain` / `application` / `infrastructure`, en la sección «Diagramas» del README.
Reclasificar según `docs/research.md` (Decisión 3):
`Account Events` y `AccountException` pasan a **subgraph**, no a nodo.

Reescribir la sección «Diagramas»: sin referencia al `.c4` y sin la afirmación de SVG
renderizados por CI.

**Step 3: Eliminar el `.c4` y validar**

```bash
rm apps/ledger/docs/accounts/accounts.c4
npm run docs:validate
```
Esperado: PASS.

```bash
grep -rc 'view:' apps/ledger/docs/accounts/flows/ | grep -v ':0' || echo "sin claves view: — OK"
ls apps/ledger/docs/accounts/flows/ | wc -l   # esperado: 10
```

---

### Tarea 5: Migrar el módulo `transactions` [P]

Mismo procedimiento que la Tarea 4.

**Archivos:**
- Modificar: los 10 `apps/ledger/docs/transactions/flows/*.md`
- Crear: `apps/ledger/docs/transactions/flows/merge-transfers.md`
- Modificar: `apps/ledger/docs/transactions/README.md`
- Eliminar: `apps/ledger/docs/transactions/transactions.c4`

**Particularidades:**

- 11 vistas / 10 flows. La huérfana `mergeTransfers` genera
  `flows/merge-transfers.md` (`command: MergePendingTransfersCommand`,
  `entrypoint: POST /transfers/merge`, `introduced_by: hu-0025`).
- `Transaction Events` y `TransactionException` → **subgraph**.
- **`reverse-transaction.md:32` enlaza `../../shared/flows/dry-run-preview.md`**, que la
  Tarea 8 crea. Dejar el link tal cual — queda sano al cerrar esa tarea.
- El README afirma «Renderizados a SVG en `assets/` por CI»: **borrar esa frase**, nunca
  fue cierta.

**Verificación:**

```bash
rm apps/ledger/docs/transactions/transactions.c4
npm run docs:validate
ls apps/ledger/docs/transactions/flows/ | wc -l   # esperado: 11
```
Esperado: PASS.

---

### Tarea 6: Migrar el módulo `reconciliation` [P]

**Archivos:**
- Modificar: los 9 `apps/ledger/docs/reconciliation/flows/*.md`
- Modificar: `apps/ledger/docs/reconciliation/README.md`
- Eliminar: `apps/ledger/docs/reconciliation/reconciliation.c4`

**Particularidades:** 9 vistas / 9 flows — correspondencia exacta, sin huérfanas.
`AssertionStatusStore` y `AdjustmentAuditStore` pasan a **cilindro** `[( )]`: nombran read
models, no clases.

```bash
rm apps/ledger/docs/reconciliation/reconciliation.c4
npm run docs:validate
```
Esperado: PASS.

---

### Tarea 7: Migrar el módulo `reference` [P]

**Archivos:**
- Modificar: los 2 `apps/ledger/docs/reference/flows/*.md`
- Modificar: `apps/ledger/docs/reference/README.md`
- Eliminar: `apps/ledger/docs/reference/reference.c4`

**Particularidades:** el módulo más chico — 2 vistas, 2 flows, 6 componentes. Sin
reclasificaciones.

```bash
rm apps/ledger/docs/reference/reference.c4
npm run docs:validate
```
Esperado: PASS.

---

### Tarea 8: Migrar el módulo `shared` (2 flows nuevos + absorciones)

> **No paralelizable.** Absorbe contenido de `shared-kernel/`, que la Tarea 9 elimina.
> Debe completarse antes.

**Archivos:**
- Modificar: los 5 `apps/ledger/docs/shared/flows/*.md`
- Crear: `apps/ledger/docs/shared/flows/dry-run-preview.md`
- Crear: `apps/ledger/docs/shared/flows/retry-transient-failure.md`
- Modificar: `apps/ledger/docs/shared/flows/command-dispatch.md` (dos absorciones)
- Modificar: `apps/ledger/docs/shared/README.md`
- Eliminar: `apps/ledger/docs/shared/shared.c4`

**Step 1: Los 5 flows existentes** — igual que la Tarea 4.

**Step 2: Los 2 flows nuevos**

- `dry-run-preview.md` ← vista `shared_http_dry_run` (`shared.c4:248`).
  **Cierra el link roto de `transactions/flows/reverse-transaction.md:32`.**
- `retry-transient-failure.md` ← vista `shared_http_retry_deadlock` (`shared.c4:262`).

Ambos: `module: shared`, `trigger: rest`, `introduced_by: hu-0025`,
`last_modified_by: spec-0033`.

**Step 3: Absorber en `command-dispatch.md`**

1. La vista `shared_kernel_auth_context_policy` (`shared-kernel.c4:279`) — la validación
   de `AuthenticatedContextPolicy` es un eslabón del dispatch, no un caso de uso propio.
2. El `sequenceDiagram` de `apps/ledger/docs/shared-kernel/diagram.md` — documenta esa
   misma cadena de políticas (hu-0005). Integrarlo aquí; la Tarea 9 borra el original.

**Step 4: Verificar**

```bash
rm apps/ledger/docs/shared/shared.c4
npm run docs:validate
ls apps/ledger/docs/shared/flows/ | wc -l   # esperado: 7
test -f apps/ledger/docs/shared/flows/dry-run-preview.md && echo "link de reverse-transaction sano"
```
Esperado: PASS.

---

### Tarea 9: Mudar la documentación de `shared-kernel` a `libs/cqrs`

> **Corrección de frontera (AC-2).** `shared-kernel` no es un módulo del ledger: su código
> se extrajo a `libs/cqrs` el 2026-07-27 y la carpeta de docs quedó huérfana. Ver
> `docs/research.md`, Decisión 5.

**Archivos:**
- Crear: `libs/cqrs/docs/flows/` con los 5 flows movidos
- Modificar: `libs/cqrs/README.md` (agregar el diagrama de componentes)
- Eliminar: `apps/ledger/docs/shared-kernel/` completa

**Step 1: Mover los 5 flows preservando la historia**

```bash
mkdir -p libs/cqrs/docs/flows
git mv apps/ledger/docs/shared-kernel/flows/event-store-append.md   libs/cqrs/docs/flows/
git mv apps/ledger/docs/shared-kernel/flows/rebuild-all.md          libs/cqrs/docs/flows/
git mv apps/ledger/docs/shared-kernel/flows/rebuild-projection.md   libs/cqrs/docs/flows/
git mv apps/ledger/docs/shared-kernel/flows/verify-balances.md      libs/cqrs/docs/flows/
git mv apps/ledger/docs/shared-kernel/flows/verify-chain.md         libs/cqrs/docs/flows/
```

**Step 2: Migrar el formato y corregir el frontmatter**

En los 5: insertar el `sequenceDiagram`, borrar `view:`, y cambiar
`module: shared-kernel` → `module: cqrs`.

**Step 3: Diagrama de componentes en el README de la lib**

`libs/cqrs/README.md` **ya existe** — no se crea, se le agrega la sección «Componentes».
Tomar el `graph TD` de `apps/ledger/docs/shared-kernel/component.md`, normalizarlo a
`flowchart TB` e incorporar las dos vistas absorbidas (AC-1):
`shared_kernel_read_model_upsert` y `shared_kernel_contract_test`.

Reclasificar: `ProjectionCheckpoints` → **cilindro**; `PostgresReadModelStoreSpec` →
**se elimina** (era un archivo de test); `canonicalJson + sha256Hex` → **dos nodos**
(ambos existen en `libs/shared/src/functions/canonical-hash.ts:24` y `:36`).

**Step 4: Eliminar la carpeta y validar**

```bash
git rm -r apps/ledger/docs/shared-kernel/
npm run docs:validate
ls libs/cqrs/docs/flows/ | wc -l                 # esperado: 5
test ! -d apps/ledger/docs/shared-kernel && echo "carpeta eliminada"
grep -rc 'module: cqrs' libs/cqrs/docs/flows/    # esperado: 1 por archivo
```
Esperado: PASS. Total de flows en el repo: **44**.

---

### Tarea 10: Reconciliar el nivel L1+L2

**Archivos:**
- Modificar: `docs/architecture/context.md`
- Modificar: `docs/architecture/containers.md`
- Eliminar: `docs/architecture/landscape.c4`

**Step 1: Reconciliar antes de borrar**

Comparar `landscape.c4` (88 líneas) con los bloques `graph TB` que ya existen en ambos
`.md`, e incorporar todo nodo o relación que esté solo en el `.c4`. Reparto elemento por
elemento según la tabla de AC-3 del `spec.md`:

| Elemento de `landscape.c4` | Destino |
|---|---|
| `user`, `admin`, `admin.ledger`, `user -> admin.ledger` | `context.md` (L1) y `containers.md` (L2) |
| `view ledgerContainers` | `containers.md` |
| `view index` | se descarta |
| `commandBus`, `queryBus`, `eventStore` | al diagrama de componentes de `libs/cqrs` (Tarea 9) — son L3 filtrados |
| Estilos de `specification{}` | se descartan |
| Tags de trigger | ya viven en el frontmatter `trigger:` — sobreviven sin acción |
| Tags `delta-new` / `delta-changed` | se descartan (AC-7) |

**Step 2: Normalizar la sintaxis legada**

Ambos bloques usan `graph TB`. Migrar a `flowchart TB`.

**Step 3: Eliminar y verificar**

```bash
rm docs/architecture/landscape.c4
npm run docs:validate
grep -c 'graph TB' docs/architecture/*.md   # esperado: 0 en ambos
```
Esperado: PASS. `docs/architecture/` no entra al gate (sus nodos son actores y
containers), pero la validación debe seguir en verde.

---

### Tarea 11: Purgar LikeC4 del repositorio

**Archivos:**
- Modificar: `package.json` (dependencia + lockfile)
- Eliminar: `likec4.config.json`

**Step 1: Desinstalar**

```bash
npm uninstall likec4
rm likec4.config.json
```

**Step 2: Verificar que no queden referencias vivas**

```bash
grep -rn -i "likec4" --include="*.md" --include="*.json" --include="*.yml" --include="*.ts" . \
  | grep -v node_modules | grep -v "work/done" | grep -v ".nx/workspace-data" \
  | grep -v "work/active/spec-0033" | grep -v "docs/proposals/docs-as-code-likec4.md"
```
Esperado: sin resultados.

```bash
find . -name "*.c4" -not -path "./node_modules/*" -not -path "./work/done/*"
```
Esperado: sin resultados — los 7 `.c4` vivos eliminados.

**Step 3: Confirmar los archivados intactos**

```bash
find ./work/done -name "*.c4" | wc -l
```
Esperado: **10**. Se congelan tal cual: son el registro de historias cerradas y
`likec4.config.json` ya los excluía.

---

### Tarea 12: Actualizar el profile del proyecto

**Archivos:**
- Modificar: `.agents/profile.md` (secciones 7, 8 y 10)

| Clave | Sección | Valor nuevo |
|---|---|---|
| `DIAGRAM_FORMAT` | 7 | `Mermaid — bloques inline en .md` |
| `DOCS_MODEL` | 8 | sin modelo único: un diagrama por artefacto, co-localizado |
| `DOCS_LANDSCAPE_MODEL` | 8 | **eliminar** la fila |
| `DOCS_MODULE_MODEL` | 8 | **eliminar** la fila |
| `DESIGN_OUTPUT_MODE` | 8 | `flows/*.md` completo + `api.delta.yaml` |
| `SYNC_MODE` | 8 | `replace` |
| `MODEL_VALIDATE_CMD` | 10 | `npm run docs:validate` |

`API_CONTRACT_MODE: delta` y `TRIGGER_TAXONOMY` **no cambian**. Redirigir la nota de la
sección 8 a la propuesta nueva (Tarea 14).

**Verificar:** `grep -i likec4 .agents/profile.md` → sin resultados.

---

### Tarea 13: Actualizar las skills SDD

> **Fuera del repositorio.** `~/.agents/` está expuesto por symlink en `~/.claude/skills/`.
> No entra en el commit y se versiona por separado.

**Archivos:**
- Modificar: `~/.agents/skills/design/SKILL.md`
- Modificar: `~/.agents/skills/design/references/flow-template.md`
- Modificar: `~/.agents/skills/sync/SKILL.md`
- Modificar: `~/.agents/sdd-profile.template.md`

**Step 1: Retirar la maquinaria de delta de `/design`**

Eliminar de `SKILL.md` la sección `PHASE 4 — DELTA MODE` en lo relativo a LikeC4: los tags
`#delta-new`/`#delta-changed`, los prefijos `[NEW]`/`[CHANGED]`, la convención de
`views '<Módulo>' { ... }`, y los ~30 renglones del gotcha de resolución de FQN dentro de
bloques `extend`. `/design` pasa a escribir el `flows/<use-case>.md` **completo** con su
`sequenceDiagram` inline.

**Step 2: Actualizar `flow-template.md`** — quitar la clave `view:` del frontmatter y
agregar el bloque Mermaid.

**Step 3: `/sync` pasa de `reconcile` a `replace`** para flows. La reconciliación sigue
viva **solo** para el `api.yaml` canónico del módulo.

**Step 4: Verificar**

```bash
/healthcheck
```
Esperado: sin inconsistencias entre las claves que las skills referencian y las que
declaran `.agents/profile.md` y `~/.agents/sdd-profile.template.md`.

---

### Tarea 14: Publicar la propuesta y registrar la decisión

**Archivos:**
- Crear: `docs/proposals/docs-as-code-mermaid.md`
- Modificar: `docs/proposals/docs-as-code-likec4.md` (marcar superada)
- Modificar: `docs/decisions.md`

**Step 1: Promover el borrador**

```bash
cp work/active/spec-0033/docs/docs-as-code-mermaid.md docs/proposals/
```
Quitar la nota de encabezado que lo marca como borrador de spec-0033.

**Step 2: Marcar la anterior como superada**

En `docs/proposals/docs-as-code-likec4.md`, encabezado:

```markdown
> **SUPERADA por [`docs-as-code-mermaid.md`](./docs-as-code-mermaid.md) (spec-0033,
> 2026-08-11).** Se conserva como registro del enfoque vigente entre 2026-07-24 y esa
> fecha. No refleja el estado actual del repositorio.
```

**Step 3: Registrar en `docs/decisions.md`**

Agregar la decisión y su fundamento: por qué se abandona LikeC4 (diagramas invisibles,
diagrama separado de su semántica, maquinaria de delta cara), qué se pierde
(repetición de nombres, sin vista global navegable) y qué lo compensa (el gate de
identificadores).

---

### Tarea 15: Gates finales

**Step 1: Suite completa**

```bash
npx jest tools/ --no-coverage
```
Esperado: PASS — el spec del validador en verde.

**Step 2: El gate sobre el repo migrado**

```bash
npm run docs:validate
```
Esperado: `✓ Every Mermaid identifier resolves to a real symbol.` — **es el criterio
literal de AC-5**: sobre el estado del repo ya migrado, el job pasa en verde.

**Step 3: Conteo de artefactos**

```bash
find apps/ledger/docs libs/cqrs/docs -name "*.md" -path "*/flows/*" | wc -l   # 44
find . -name "*.c4" -not -path "./node_modules/*" -not -path "./work/done/*" | wc -l  # 0
find ./work/done -name "*.c4" | wc -l                                        # 10
grep -rl '```mermaid' apps/ledger/docs libs/cqrs/docs docs/architecture | wc -l  # ≥ 52
```

**Step 4: CI completo**

```bash
npx nx run-many -t lint,test,build --projects=ledger,cqrs,shared
```
Esperado: PASS. Ningún cambio en `apps/ledger/src/` — si algún test de aplicación falla,
es señal de que la migración tocó código, lo que la regla de negocio prohíbe.

**Step 5: Verificación negativa del gate**

Comprobar que el gate **realmente falla** cuando debe (si no, pasa en verde por vacío):

```bash
sed -i 's/participant CB as PolicyCommandBus/participant CB as GhostCommandBus/' \
  libs/cqrs/docs/flows/event-store-append.md
npm run docs:validate    # esperado: FAIL con "GhostCommandBus does not resolve", exit 1
git checkout libs/cqrs/docs/flows/event-store-append.md
npm run docs:validate    # esperado: PASS
```
Esperado: FAIL y después PASS. Sin este paso no hay evidencia de que el gate esté vivo.
