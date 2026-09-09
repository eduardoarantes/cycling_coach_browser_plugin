/**
 * Unit tests for row-tolerant list validation
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { tolerantList } from '@/schemas/tolerantList';

const RowSchema = z.object({
  id: z.number(),
  name: z.string(),
  scheduledOn: z.string().nullable(),
});

const ListSchema = tolerantList(RowSchema);

describe('tolerantList', () => {
  it('should keep every row when they all validate', () => {
    const rows = [
      { id: 1, name: 'One', scheduledOn: '2026-03-02' },
      { id: 2, name: 'Two', scheduledOn: null },
    ];

    const result = ListSchema.parse(rows);

    expect(result.items).toEqual(rows);
    expect(result.skipped).toEqual([]);
  });

  it('should keep the valid rows and report the invalid ones', () => {
    const result = ListSchema.parse([
      { id: 1, name: 'One', scheduledOn: null },
      { id: 2, name: 42, scheduledOn: null },
      { id: 3, name: 'Three', scheduledOn: null },
    ]);

    expect(result.items.map((item) => item.id)).toEqual([1, 3]);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]).toMatchObject({
      index: 1,
      path: '[1].name',
      input: 42,
    });
    expect(result.skipped[0]?.message).toBeTruthy();
  });

  it('should report a row that is not an object at all', () => {
    const result = ListSchema.parse([null]);

    expect(result.items).toEqual([]);
    expect(result.skipped[0]).toMatchObject({ index: 0, path: '[0]' });
  });

  it('should report a nested path so the failing field can be found', () => {
    const NestedListSchema = tolerantList(
      z.object({ meta: z.object({ count: z.number() }) })
    );

    const result = NestedListSchema.parse([{ meta: { count: 'many' } }]);

    expect(result.skipped[0]).toMatchObject({
      path: '[0].meta.count',
      input: 'many',
    });
  });

  it('should still reject a response that is not a list', () => {
    expect(() => ListSchema.parse({ rows: [] })).toThrow();
  });

  it('should accept an empty list', () => {
    const result = ListSchema.parse([]);

    expect(result.items).toEqual([]);
    expect(result.skipped).toEqual([]);
  });
});
