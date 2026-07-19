import { DomainNotFoundException } from '@shared';

/**
 * AC-4 (sm-0003) — the categorization rule does not exist or belongs to another
 * user. Maps to 404.
 */
export class CategorizationRuleNotFoundException extends DomainNotFoundException {}
