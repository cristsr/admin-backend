/**
 * One-time verification script: compares the original LikeC4 dynamic views
 * (recovered from git) against the current Mermaid sequenceDiagrams to detect
 * translation errors introduced during the spec-0033 migration.
 *
 * Usage: npx ts-node -P tools/tsconfig.tools.json tools/verify-c4-translations.ts
 *
 * The .c4 files were deleted in commits 8c550bc, ebb2b1e, 9e7fd3a and 7172c28
 * of the docs/SPEC-0033-mermaid-diagrams branch. Recover them with:
 *   git show <commit>:<path>.c4 > temp-c4-recovery/<view>.c4
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export interface C4Message {
  from: string;
  to: string;
  text: string;
}

export interface ViewComparison {
  view: string;
  match: boolean;
  discrepancies: string[];
}

/**
 * Maps a LikeC4 view id to its corresponding flows/*.md file.
 * Built from the 47 views that were translated in spec-0033.
 */
const C4_VIEW_MAP: Record<string, string> = {
  openAccount: 'apps/ledger/docs/accounts/flows/open-account.md',
  renameAccount: 'apps/ledger/docs/accounts/flows/rename-account.md',
  closeAccount: 'apps/ledger/docs/accounts/flows/close-account.md',
  getAccountById: 'apps/ledger/docs/accounts/flows/get-account-by-id.md',
  listAccounts: 'apps/ledger/docs/accounts/flows/list-accounts.md',
  getAccountBalances: 'apps/ledger/docs/accounts/flows/get-account-balances.md',
  recordOpeningBalance: 'apps/ledger/docs/accounts/flows/record-opening-balance.md',
  initializeLedger: 'apps/ledger/docs/ledger/flows/initialize-ledger.md',
  getLedgerSettings: 'apps/ledger/docs/ledger/flows/get-ledger-settings.md',
  replaceLedgerSettings: 'apps/ledger/docs/ledger/flows/replace-ledger-settings.md',
  recordTransaction: 'apps/ledger/docs/transactions/flows/record-transaction.md',
  confirmTransaction: 'apps/ledger/docs/transactions/flows/confirm-transaction.md',
  reverseTransaction: 'apps/ledger/docs/transactions/flows/reverse-transaction.md',
  voidTransaction: 'apps/ledger/docs/transactions/flows/void-transaction.md',
  amendTransaction: 'apps/ledger/docs/transactions/flows/amend-transaction.md',
  annotateTransaction: 'apps/ledger/docs/transactions/flows/annotate-transaction.md',
  getTransaction: 'apps/ledger/docs/transactions/flows/get-transaction.md',
  listTransactions: 'apps/ledger/docs/transactions/flows/list-transactions.md',
  mergeTransfers: 'apps/ledger/docs/transactions/flows/merge-transfers.md',
  registerCurrency: 'apps/ledger/docs/reference/flows/register-currency.md',
  listCurrencies: 'apps/ledger/docs/reference/flows/list-currencies.md',
  assertBalance: 'apps/ledger/docs/reconciliation/flows/assert-balance.md',
  resolveDiscrepancy: 'apps/ledger/docs/reconciliation/flows/resolve-discrepancy.md',
  revokeAssertion: 'apps/ledger/docs/reconciliation/flows/revoke-assertion.md',
  evaluateAssertion: 'apps/ledger/docs/reconciliation/flows/evaluate-assertion.md',
  listAssertions: 'apps/ledger/docs/reconciliation/flows/list-assertions.md',
  getAssertionStatus: 'apps/ledger/docs/reconciliation/flows/get-assertion-status.md',
  reevaluateAssertions: 'apps/ledger/docs/reconciliation/flows/reevaluate-assertions.md',
  runReconciliationPump: 'apps/ledger/docs/reconciliation/flows/run-reconciliation-pump.md',
  commandDispatch: 'apps/ledger/docs/shared/flows/command-dispatch.md',
  queryDispatch: 'apps/ledger/docs/shared/flows/query-dispatch.md',
  dryRunPreview: 'apps/ledger/docs/shared/flows/dry-run-preview.md',
  idempotentWrite: 'apps/ledger/docs/shared/flows/idempotent-write.md',
  mapDomainError: 'apps/ledger/docs/shared/flows/map-domain-error.md',
  retryTransientFailure: 'apps/ledger/docs/shared/flows/retry-transient-failure.md',
  getSwaggerDocs: 'apps/ledger/docs/shared/flows/get-swagger-docs.md',
  verifyChain: 'apps/ledger/docs/shared/flows/verify-chain.md',
  verifyBalances: 'apps/ledger/docs/shared/flows/verify-balances.md',
  projectTransactionList: 'apps/ledger/docs/transactions/flows/project-transaction-list.md',
  projectAccountBalances: 'apps/ledger/docs/transactions/flows/project-account-balances.md',
  projectAssertionStatus: 'apps/ledger/docs/reconciliation/flows/project-assertion-status.md',
  projectAdjustmentAudit: 'apps/ledger/docs/reconciliation/flows/project-adjustment-audit.md',
  eventStoreAppend: 'libs/cqrs/docs/flows/event-store-append.md',
  rebuildAll: 'libs/cqrs/docs/flows/rebuild-all.md',
  rebuildProjection: 'libs/cqrs/docs/flows/rebuild-projection.md',
};

/**
 * Extracts message sequences from a LikeC4 dynamic view block.
 * Each message is a line matching: <from> -> <to> '<text>'
 */
export function extractC4Messages(content: string, viewId: string): C4Message[] {
  const messages: C4Message[] = [];
  const lines = content.split('\n');
  let inside = false;
  let depth = -1;

  for (const raw of lines) {
    const line = raw.trim();

    if (line.indexOf(`dynamic view ${viewId}`) === 0) {
      inside = true;
      depth = raw.match(/^\s*/)?.[0].length ?? 0;
      continue;
    }

    if (!inside) continue;

    const currentDepth = raw.match(/^\s*/)?.[0].length ?? 0;

    if (currentDepth <= depth && line === '}') {
      inside = false;
      continue;
    }

    const arrow = /^(\S+)\s*->\s*(\S+)\s+'(.+)'$/.exec(line);
    if (arrow) {
      messages.push({ from: arrow[1], to: arrow[2], text: arrow[3] });
    }
  }

  return messages;
}

/**
 * Extracts message sequences from a Mermaid sequenceDiagram block.
 * Resolves participant aliases (via `as`) to their visible names.
 */
export function extractMermaidMessages(content: string): C4Message[] {
  const messages: C4Message[] = [];
  const lines = content.split('\n');

  let inside = false;
  const aliases = new Map<string, string>();

  for (const raw of lines) {
    const line = raw.trim();

    if (line === 'sequenceDiagram') {
      inside = true;
      continue;
    }

    if (!inside) continue;

    if (line.indexOf('```') === 0) {
      inside = false;
      continue;
    }

    if (
      line.indexOf('Note ') === 0 ||
      line.indexOf('activate ') === 0 ||
      line.indexOf('deactivate ') === 0 ||
      line.indexOf('actor ') === 0 ||
      line === ''
    ) {
      continue;
    }

    const participant = /^participant\s+(\S+)(?:\s+as\s+(.+))?$/.exec(line);
    if (participant) {
      const alias = participant[1];
      const name = (participant[2] || participant[1]).trim();
      aliases.set(alias, name);
      continue;
    }

    const arrow = /^(\S+)(?:->>|->|-->|-->>)(\S+):\s*(.+)$/.exec(line);
    if (arrow) {
      const from = aliases.get(arrow[1]) || arrow[1];
      const to = aliases.get(arrow[2]) || arrow[2];
      messages.push({ from, to, text: arrow[3].trim() });
    }
  }

  return messages;
}

export function compareView(
  viewId: string,
  c4Messages: C4Message[],
  mermaidMessages: C4Message[],
): ViewComparison {
  const discrepancies: string[] = [];

  if (c4Messages.length !== mermaidMessages.length) {
    discrepancies.push(
      `message count: .c4 has ${c4Messages.length}, Mermaid has ${mermaidMessages.length}`,
    );
  }

  const maxLen = Math.max(c4Messages.length, mermaidMessages.length);
  for (let i = 0; i < maxLen; i++) {
    const c4 = c4Messages[i];
    const m = mermaidMessages[i];

    if (!c4 || !m) {
      discrepancies.push(`position ${i + 1}: missing in ${!c4 ? '.c4' : 'Mermaid'}`);
      continue;
    }

    if (c4.text !== m.text) {
      discrepancies.push(
        `position ${i + 1} text: .c4 "${c4.text}" vs Mermaid "${m.text}"`,
      );
    }
  }

  return {
    view: viewId,
    match: discrepancies.length === 0,
    discrepancies,
  };
}

function main(): void {
  // .c4 files are recovered to temp-c4-recovery/<view>.c4 with `git show`.
  const comparisons: ViewComparison[] = [];

  for (const [viewId, flowPath] of Object.entries(C4_VIEW_MAP)) {
    const c4Path = join('temp-c4-recovery', `${viewId}.c4`);
    let c4Content: string;

    try {
      c4Content = readFileSync(c4Path, 'utf8');
    } catch {
      console.error(`⚠ Cannot read ${c4Path} — recover it with git show first`);
      continue;
    }

    let mermaidContent: string;
    try {
      mermaidContent = readFileSync(flowPath, 'utf8');
    } catch {
      console.error(`⚠ Cannot read ${flowPath}`);
      continue;
    }

    const c4Messages = extractC4Messages(c4Content, viewId);
    const mermaidMessages = extractMermaidMessages(mermaidContent);
    const comparison = compareView(viewId, c4Messages, mermaidMessages);

    comparisons.push(comparison);
  }

  const failures = comparisons.filter((c) => !c.match);

  if (failures.length === 0) {
    console.log(`✓ Las ${comparisons.length} traducciones coinciden con el original.`);
    return;
  }

  for (const f of failures) {
    console.error(`✗ ${f.view}:`);
    for (const d of f.discrepancies) {
      console.error(`  - ${d}`);
    }
  }

  console.error(`\n${failures.length} view(s) with discrepancies.`);
  process.exit(1);
}

if (require.main === module) main();
