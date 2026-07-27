/** A single named behaviour a port implementation must honour. */
export interface ContractCase {
  readonly name: string;
  readonly verify: () => void | Promise<void>;
}

/**
 * Declares a reusable contract suite: the same cases run against every
 * implementation of a port — in-memory doubles and real adapters alike — so
 * all of them provably behave the same (RNF-11). Contract runners such as
 * {@link runClockContract} build on this; EP-1.4/EP-1.5 will declare the
 * EventStore contract with the same shape.
 */
export function defineContract(name: string, cases: readonly ContractCase[]): void {
  describe(name, () => {
    for (const { name: caseName, verify } of cases) {
      it(caseName, verify);
    }
  });
}
