import Big from 'big.js';

/**
 * Single configuration point for big.js in the ledger. Money arithmetic must
 * always use this module's `Big` — never `import ... from 'big.js'` directly —
 * so the settings below apply to every operation.
 *
 * - `strict`: the constructor and arithmetic methods reject primitive numbers,
 *   enforcing INV-8 (no float-derived values) at runtime, not just at types.
 * - `DP`: division precision; core posting arithmetic (+ − ×) is exact
 *   regardless, this only matters for read-side valuation (EP-4.5).
 * - `RM = 2`: round-half-even (banker's rounding) for that valuation.
 * - `PE`/`NE` at their extremes: `toString` never falls back to exponential
 *   notation, so serialized amounts are always plain decimal strings (RNF-2).
 */
Big.strict = true;
Big.DP = 40;
Big.RM = 2;
Big.PE = 1_000_000;
Big.NE = -1_000_000;

export { Big };
