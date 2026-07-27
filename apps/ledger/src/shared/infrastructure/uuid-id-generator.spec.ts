import { runIdGeneratorContract } from '@cqrs/testing';
import { UuidIdGenerator } from './uuid-id-generator';

runIdGeneratorContract(() => new UuidIdGenerator());
