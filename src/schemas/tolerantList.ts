/**
 * Row-tolerant list validation.
 *
 * `z.array(RowSchema)` is all-or-nothing: one row TrainingPeaks returns in a
 * shape we did not anticipate rejects the whole response. For a list the user
 * browses, that trades a cosmetic gap for a total outage — a single plan with a
 * null `startDate` hid a coach's entire plan library and read to them as "the
 * import is broken".
 *
 * So list responses are parsed row by row: valid rows are kept, invalid ones are
 * reported to the caller. Reported, not swallowed — the caller is expected to
 * log what it dropped, because a row that silently disappears from a list is the
 * one failure mode worse than the loud one this replaces.
 *
 * This is for *presentation* payloads. Anything whose correctness a user cannot
 * eyeball keeps failing closed.
 */

import { z } from 'zod';

/** A row that failed validation and was left out of the list. */
export interface SkippedRow {
  /** Position of the row in the response, for correlating with a raw payload. */
  index: number;
  /** Path of the first failing field, e.g. `[15].startDate`. */
  path: string;
  /** Zod's message for that field. */
  message: string;
  /** The offending value, unserialized — the caller decides how to render it. */
  input: unknown;
}

export interface TolerantListResult<Row> {
  items: Row[];
  skipped: SkippedRow[];
}

/** Zod does not always carry the offending value on the issue; read it back. */
function getValueAtPath(input: unknown, path: PropertyKey[]): unknown {
  let cursor: unknown = input;

  for (const segment of path) {
    if (cursor === null || cursor === undefined) {
      return undefined;
    }

    if (typeof segment === 'number') {
      if (!Array.isArray(cursor)) {
        return undefined;
      }

      cursor = cursor[segment];
      continue;
    }

    if (typeof cursor !== 'object') {
      return undefined;
    }

    cursor = (cursor as Record<PropertyKey, unknown>)[segment];
  }

  return cursor;
}

function formatRowPath(index: number, path: PropertyKey[]): string {
  const suffix = path
    .map((segment) => {
      if (typeof segment === 'number') {
        return `[${segment}]`;
      }

      const key = String(segment);
      return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)
        ? `.${key}`
        : `[${JSON.stringify(key)}]`;
    })
    .join('');

  return `[${index}]${suffix}`;
}

/**
 * Build a schema that validates each row of an array independently.
 *
 * The response must still be an array; only the rows are tolerated.
 */
export function tolerantList<Row extends z.ZodTypeAny>(
  rowSchema: Row
): z.ZodType<TolerantListResult<z.output<Row>>, unknown> {
  return z.array(z.unknown()).transform((rows) => {
    const items: z.output<Row>[] = [];
    const skipped: SkippedRow[] = [];

    rows.forEach((row, index) => {
      const parsed = rowSchema.safeParse(row);

      if (parsed.success) {
        items.push(parsed.data as z.output<Row>);
        return;
      }

      const issue = parsed.error.issues[0];

      skipped.push({
        index,
        path: issue ? formatRowPath(index, issue.path) : `[${index}]`,
        message: issue?.message ?? 'Unknown validation error',
        input: issue
          ? (issue.input ?? getValueAtPath(row, issue.path))
          : undefined,
      });
    });

    return { items, skipped };
  }) as z.ZodType<TolerantListResult<z.output<Row>>, unknown>;
}
