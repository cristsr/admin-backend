/**
 * JSON-safe event payload. Every monetary amount is a decimal string (RNF-2)
 * and floats never appear (INV-8). The event store persists this verbatim as
 * `jsonb`; projectors and upcasters read it back without any numeric coercion.
 */
export type EventPayload = Readonly<Record<string, unknown>>;
