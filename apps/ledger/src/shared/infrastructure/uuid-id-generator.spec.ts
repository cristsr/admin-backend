import { runIdGeneratorContract } from '@ledger/shared/testing/contract/id-generator.contract';
import { UuidIdGenerator } from './uuid-id-generator';

runIdGeneratorContract(() => new UuidIdGenerator());
