import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { PostgresEventStore } from '@ledger/shared-kernel/infrastructure/adapters/event-store/postgres/postgres-event-store';
import { PostgresReadModelStore } from '@ledger/shared-kernel/infrastructure/adapters/read-model-store/postgres/postgres-read-model-store';
import { InMemoryProjectionCheckpointRepository } from '@ledger/shared-kernel/infrastructure/adapters/projection/in-memory-projection-checkpoint.repository';
import { ProjectionRegistry } from '@ledger/shared-kernel/application/tooling/projection-registry';
import { ProjectionRebuilder } from '@ledger/shared-kernel/infrastructure/adapters/projection/projection-rebuilder';
import { ConsistencyVerifier } from '@ledger/shared-kernel/application/tooling/consistency-verifier';
import { AccountTreeProjector, PROJ_ACCOUNTS } from '@ledger/accounts/infrastructure/projections/account-tree.projector';
import {
  AccountBalancesProjector,
  PROJ_BALANCES,
} from '@ledger/transactions/infrastructure/projections/account-balances.projector';
import {
  PROJ_POSTINGS,
  PROJ_TRANSACTIONS,
  TransactionListProjector,
} from '@ledger/transactions/infrastructure/projections/transaction-list.projector';
import {
  LedgerSettingsProjector,
  PROJ_LEDGER_SETTINGS,
} from '@ledger/ledger/infrastructure/projections/ledger-settings.projector';
import { SeedCurrencyCatalog } from '@ledger/shared-kernel/infrastructure/adapters/currency/seed-currency-catalog';
import { createLedgerEventRegistry } from '@ledger/ledger/application/ledger-event-registry.factory';
import {
  AdjustmentAuditProjector,
  PROJ_ADJUSTMENT_AUDIT,
  PROJ_ADJUSTMENT_AUDIT_ENTRIES,
} from '@ledger/reconciliation/infrastructure/projections/adjustment-audit.projector';
import {
  AssertionStatusProjector,
  PROJ_ASSERTIONS,
} from '@ledger/reconciliation/infrastructure/projections/assertion-status.projector';
import { RECONCILIATION_PROJECTION } from '@ledger/reconciliation/infrastructure/adapters/events/reconciliation.pump';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    console.error(
      'Usage: ts-node rebuild.command.ts <rebuild|rebuildAll|verify-balances> [--projection <name>] [--userId <uuid>]',
    );
    process.exit(1);
  }

  const dbUri =
    process.env.DB_URI ??
    'postgresql://postgres:postgres@localhost:5433/ledger';
  const dataSource = new DataSource({
    type: 'postgres',
    url: dbUri,
  });
  await dataSource.initialize();

  const catalog = new SeedCurrencyCatalog();
  const eventStore = new PostgresEventStore(dataSource);
  const readModel = new PostgresReadModelStore(dataSource);

  const registry = new ProjectionRegistry();
  registry.register('account_tree', [new AccountTreeProjector()], [PROJ_ACCOUNTS]);
  registry.register(
    'transaction_list',
    [new TransactionListProjector()],
    [PROJ_TRANSACTIONS, PROJ_POSTINGS],
  );
  registry.register(
    'account_balances',
    [new AccountBalancesProjector(catalog)],
    [PROJ_BALANCES],
  );
  registry.register('ledger_settings', [new LedgerSettingsProjector()], [PROJ_LEDGER_SETTINGS]);
  // One entry, two projectors: AdjustmentAuditProjector reads proj_assertions, so
  // both must share a checkpoint and apply in order — rebuilding them apart would
  // audit against an arbitrary assertion state.
  registry.register(
    RECONCILIATION_PROJECTION,
    [new AssertionStatusProjector(), new AdjustmentAuditProjector(catalog)],
    [PROJ_ASSERTIONS, PROJ_ADJUSTMENT_AUDIT, PROJ_ADJUSTMENT_AUDIT_ENTRIES],
  );

  try {
    switch (command) {
      case 'rebuild': {
        const projectionName = parseArg(args, '--projection');
        if (!projectionName) {
          console.error('Missing --projection <name>');
          process.exit(1);
        }

        const checkpoints = new InMemoryProjectionCheckpointRepository();
        const rebuilder = new ProjectionRebuilder(
          eventStore,
          readModel,
          checkpoints,
          registry,
        );
        const applied = await rebuilder.rebuild(projectionName);
        const caughtUp = await rebuilder.isCaughtUp(projectionName);

        console.log(`Rebuild complete: "${projectionName}"`);
        console.log(`  Events applied: ${applied}`);
        console.log(`  Caught up: ${caughtUp}`);
        break;
      }
      case 'rebuildAll': {
        const checkpoints = new InMemoryProjectionCheckpointRepository();
        const rebuilder = new ProjectionRebuilder(
          eventStore,
          readModel,
          checkpoints,
          registry,
        );
        const reports = await rebuilder.rebuildAll();

        console.log('RebuildAll complete:');
        for (const report of reports) {
          const status = report.success ? 'OK' : 'FAIL';
          console.log(
            `  ${status}  ${report.projectionName}  (${report.eventsApplied} events)`,
          );
          if (report.error) console.log(`         Error: ${report.error}`);
        }
        break;
      }
      case 'verify-balances': {
        const userId = parseArg(args, '--userId');
        if (!userId) {
          console.error('Missing --userId <uuid>');
          process.exit(1);
        }

        const eventRegistry = createLedgerEventRegistry(catalog);
        const verifier = new ConsistencyVerifier(
          eventStore,
          readModel,
          eventRegistry,
        );
        const report = await verifier.verifyBalances(userId);

        if (report.ok) {
          console.log(
            `Consistency verified: proj_balances matches the stream for user "${userId}".`,
          );
        } else {
          console.log(`Drift detected for user "${userId}":`);
          for (const d of report.discrepancies) {
            console.log(
              `  Account: ${d.accountId}  Currency: ${d.currencyCode}`,
            );
            console.log(
              `    Stream:    confirmed=${d.streamConfirmed.toDecimalString()} pending=${d.streamPending.toDecimalString()}`,
            );
            console.log(
              `    Projected: confirmed=${d.projectedConfirmed.toDecimalString()} pending=${d.projectedPending.toDecimalString()}`,
            );
            console.log(
              `    Drift:     confirmed=${d.driftConfirmed.toDecimalString()} pending=${d.driftPending.toDecimalString()}`,
            );
          }
        }
        break;
      }
      default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }
  } finally {
    await dataSource.destroy();
  }
}

function parseArg(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
