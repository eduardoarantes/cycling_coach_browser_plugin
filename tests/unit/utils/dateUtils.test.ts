/**
 * Date utilities tests - TDD approach
 *
 * Tests for calculating week numbers and organizing calendar data
 * for training plan display.
 */

import { describe, it, expect } from 'vitest';
import {
  getWeekNumber,
  getDayOfWeek,
  findEarliestDate,
  normalizeToMonday,
  organizeByWeek,
  type WeekMap,
} from '@/utils/dateUtils';

describe('dateUtils', () => {
  describe('normalizeToMonday', () => {
    it('should return same date when already Monday', () => {
      // Monday, Feb 24, 2025
      const monday = new Date('2025-02-24T00:00:00.000Z');
      const result = normalizeToMonday(monday);

      expect(result.getUTCDay()).toBe(1); // Monday
      expect(result.getUTCFullYear()).toBe(2025);
      expect(result.getUTCMonth()).toBe(1); // February (0-indexed)
      expect(result.getUTCDate()).toBe(24);
    });

    it('should return previous Monday when given Tuesday', () => {
      // Tuesday, Feb 25, 2025
      const tuesday = new Date('2025-02-25T00:00:00.000Z');
      const result = normalizeToMonday(tuesday);

      expect(result.getUTCDay()).toBe(1); // Monday
      expect(result.getUTCDate()).toBe(24); // Previous Monday
    });

    it('should return previous Monday when given Sunday', () => {
      // Sunday, Mar 2, 2025
      const sunday = new Date('2025-03-02T00:00:00.000Z');
      const result = normalizeToMonday(sunday);

      expect(result.getUTCDay()).toBe(1); // Monday
      expect(result.getUTCDate()).toBe(24); // Previous Monday (Feb 24)
    });

    it('should return previous Monday when given Saturday', () => {
      // Saturday, Mar 1, 2025
      const saturday = new Date('2025-03-01T00:00:00.000Z');
      const result = normalizeToMonday(saturday);

      expect(result.getUTCDay()).toBe(1); // Monday
      expect(result.getUTCDate()).toBe(24); // Previous Monday (Feb 24)
    });

    it('should normalize time to midnight UTC', () => {
      const date = new Date('2025-02-26T15:30:45.123Z');
      const result = normalizeToMonday(date);

      expect(result.getUTCHours()).toBe(0);
      expect(result.getUTCMinutes()).toBe(0);
      expect(result.getUTCSeconds()).toBe(0);
      expect(result.getUTCMilliseconds()).toBe(0);
    });

    it('should handle year boundary correctly', () => {
      // Sunday, Jan 5, 2025
      const sunday = new Date('2025-01-05T00:00:00.000Z');
      const result = normalizeToMonday(sunday);

      expect(result.getUTCDay()).toBe(1); // Monday
      expect(result.getUTCFullYear()).toBe(2024); // Previous year
      expect(result.getUTCMonth()).toBe(11); // December
      expect(result.getUTCDate()).toBe(30); // Dec 30, 2024
    });
  });

  describe('getDayOfWeek', () => {
    it('should return 0 for Monday', () => {
      const monday = new Date('2025-02-24T00:00:00.000Z');
      expect(getDayOfWeek(monday)).toBe(0);
    });

    it('should return 1 for Tuesday', () => {
      const tuesday = new Date('2025-02-25T00:00:00.000Z');
      expect(getDayOfWeek(tuesday)).toBe(1);
    });

    it('should return 2 for Wednesday', () => {
      const wednesday = new Date('2025-02-26T00:00:00.000Z');
      expect(getDayOfWeek(wednesday)).toBe(2);
    });

    it('should return 3 for Thursday', () => {
      const thursday = new Date('2025-02-27T00:00:00.000Z');
      expect(getDayOfWeek(thursday)).toBe(3);
    });

    it('should return 4 for Friday', () => {
      const friday = new Date('2025-02-28T00:00:00.000Z');
      expect(getDayOfWeek(friday)).toBe(4);
    });

    it('should return 5 for Saturday', () => {
      const saturday = new Date('2025-03-01T00:00:00.000Z');
      expect(getDayOfWeek(saturday)).toBe(5);
    });

    it('should return 6 for Sunday', () => {
      const sunday = new Date('2025-03-02T00:00:00.000Z');
      expect(getDayOfWeek(sunday)).toBe(6);
    });

    it('should ignore time of day', () => {
      const morningMonday = new Date('2025-02-24T08:30:00.000Z');
      const eveningMonday = new Date('2025-02-24T22:45:00.000Z');

      expect(getDayOfWeek(morningMonday)).toBe(0);
      expect(getDayOfWeek(eveningMonday)).toBe(0);
    });
  });

  describe('getWeekNumber', () => {
    it('should return 1 for date in same week as start date', () => {
      // Both dates in Week 1 (Mon Feb 24 - Sun Mar 2, 2025)
      const startDate = new Date('2025-02-24T00:00:00.000Z'); // Monday
      const itemDate = new Date('2025-02-26T00:00:00.000Z'); // Wednesday

      expect(getWeekNumber(itemDate, startDate)).toBe(1);
    });

    it('should return 1 when item date is start date', () => {
      const startDate = new Date('2025-02-24T00:00:00.000Z');
      const itemDate = new Date('2025-02-24T00:00:00.000Z');

      expect(getWeekNumber(itemDate, startDate)).toBe(1);
    });

    it('should return 2 for date in second week', () => {
      const startDate = new Date('2025-02-24T00:00:00.000Z'); // Monday, Week 1
      const itemDate = new Date('2025-03-03T00:00:00.000Z'); // Monday, Week 2

      expect(getWeekNumber(itemDate, startDate)).toBe(2);
    });

    it('should return 3 for date in third week', () => {
      const startDate = new Date('2025-02-24T00:00:00.000Z'); // Monday, Week 1
      const itemDate = new Date('2025-03-10T00:00:00.000Z'); // Monday, Week 3

      expect(getWeekNumber(itemDate, startDate)).toBe(3);
    });

    it('should handle start date on non-Monday correctly', () => {
      // Start date is Wednesday, Feb 26, 2025
      // Should normalize to previous Monday (Feb 24)
      const startDate = new Date('2025-02-26T00:00:00.000Z'); // Wednesday
      const itemDate = new Date('2025-03-03T00:00:00.000Z'); // Monday of next week

      expect(getWeekNumber(itemDate, startDate)).toBe(2);
    });

    it('should handle year boundary correctly', () => {
      // Plan starts Dec 30, 2024 (Monday)
      const startDate = new Date('2024-12-30T00:00:00.000Z'); // Monday
      const itemDate = new Date('2025-01-06T00:00:00.000Z'); // Monday, 1 week later

      expect(getWeekNumber(itemDate, startDate)).toBe(2);
    });

    it('should handle leap year correctly', () => {
      // 2024 is a leap year
      const startDate = new Date('2024-02-26T00:00:00.000Z'); // Monday
      const itemDate = new Date('2024-03-04T00:00:00.000Z'); // Monday, 1 week later

      expect(getWeekNumber(itemDate, startDate)).toBe(2);
    });

    it('should return correct week for Sunday in first week', () => {
      const startDate = new Date('2025-02-24T00:00:00.000Z'); // Monday
      const itemDate = new Date('2025-03-02T00:00:00.000Z'); // Sunday of same week

      expect(getWeekNumber(itemDate, startDate)).toBe(1);
    });

    it('should handle multiple weeks correctly', () => {
      const startDate = new Date('2025-02-24T00:00:00.000Z'); // Monday

      expect(
        getWeekNumber(new Date('2025-02-24T00:00:00.000Z'), startDate)
      ).toBe(1); // Week 1 Monday
      expect(
        getWeekNumber(new Date('2025-03-03T00:00:00.000Z'), startDate)
      ).toBe(2); // Week 2 Monday
      expect(
        getWeekNumber(new Date('2025-03-10T00:00:00.000Z'), startDate)
      ).toBe(3); // Week 3 Monday
      expect(
        getWeekNumber(new Date('2025-03-17T00:00:00.000Z'), startDate)
      ).toBe(4); // Week 4 Monday
    });

    it('should return 0 for dates before start date', () => {
      const startDate = new Date('2025-02-24T00:00:00.000Z'); // Monday
      const itemDate = new Date('2025-02-20T00:00:00.000Z'); // Thursday before

      expect(getWeekNumber(itemDate, startDate)).toBe(0);
    });
  });

  describe('findEarliestDate', () => {
    interface TestItem {
      date: Date | null;
      name: string;
    }

    it('should return null for empty array', () => {
      const items: TestItem[] = [];
      expect(findEarliestDate(items)).toBeNull();
    });

    it('should return null when all items have null dates', () => {
      const items: TestItem[] = [
        { date: null, name: 'Item 1' },
        { date: null, name: 'Item 2' },
      ];
      expect(findEarliestDate(items)).toBeNull();
    });

    it('should return the only date when array has one item', () => {
      const onlyDate = new Date('2025-02-24T00:00:00.000Z');
      const items: TestItem[] = [{ date: onlyDate, name: 'Item 1' }];

      const result = findEarliestDate(items);
      expect(result).toEqual(onlyDate);
    });

    it('should return earliest date from multiple items', () => {
      const items: TestItem[] = [
        { date: new Date('2025-03-01T00:00:00.000Z'), name: 'Item 1' },
        { date: new Date('2025-02-20T00:00:00.000Z'), name: 'Item 2' }, // Earliest
        { date: new Date('2025-02-28T00:00:00.000Z'), name: 'Item 3' },
      ];

      const result = findEarliestDate(items);
      expect(result).toEqual(new Date('2025-02-20T00:00:00.000Z'));
    });

    it('should skip null dates when finding earliest', () => {
      const items: TestItem[] = [
        { date: null, name: 'Item 1' },
        { date: new Date('2025-02-24T00:00:00.000Z'), name: 'Item 2' },
        { date: null, name: 'Item 3' },
        { date: new Date('2025-02-20T00:00:00.000Z'), name: 'Item 4' }, // Earliest
      ];

      const result = findEarliestDate(items);
      expect(result).toEqual(new Date('2025-02-20T00:00:00.000Z'));
    });

    it('should handle dates across year boundary', () => {
      const items: TestItem[] = [
        { date: new Date('2025-01-05T00:00:00.000Z'), name: 'Item 1' },
        { date: new Date('2024-12-28T00:00:00.000Z'), name: 'Item 2' }, // Earliest
        { date: new Date('2025-01-15T00:00:00.000Z'), name: 'Item 3' },
      ];

      const result = findEarliestDate(items);
      expect(result).toEqual(new Date('2024-12-28T00:00:00.000Z'));
    });

    it('should ignore time when comparing dates', () => {
      const items: TestItem[] = [
        { date: new Date('2025-02-24T23:59:59.999Z'), name: 'Item 1' },
        { date: new Date('2025-02-24T00:00:00.000Z'), name: 'Item 2' },
      ];

      // Both are same day, should return first occurrence
      const result = findEarliestDate(items);
      expect(result?.toISOString().split('T')[0]).toBe('2025-02-24');
    });
  });

  describe('organizeByWeek', () => {
    interface TestWorkout {
      id: number;
      date: Date | null;
      name: string;
    }

    it('should return empty Map for empty array', () => {
      const items: TestWorkout[] = [];
      const startDate = new Date('2025-02-24T00:00:00.000Z');

      const result = organizeByWeek(items, (item) => item.date, startDate);

      expect(result.size).toBe(0);
    });

    it('should skip items with null dates', () => {
      const items: TestWorkout[] = [
        { id: 1, date: null, name: 'Workout 1' },
        { id: 2, date: null, name: 'Workout 2' },
      ];
      const startDate = new Date('2025-02-24T00:00:00.000Z');

      const result = organizeByWeek(items, (item) => item.date, startDate);

      expect(result.size).toBe(0);
    });

    it('should organize single item into correct week and day', () => {
      const items: TestWorkout[] = [
        {
          id: 1,
          date: new Date('2025-02-24T00:00:00.000Z'),
          name: 'Workout 1',
        }, // Monday, Week 1
      ];
      const startDate = new Date('2025-02-24T00:00:00.000Z');

      const result = organizeByWeek(items, (item) => item.date, startDate);

      expect(result.size).toBe(1);
      expect(result.has(1)).toBe(true);

      const week1 = result.get(1);
      expect(week1?.size).toBe(1);
      expect(week1?.has(0)).toBe(true); // Monday

      const mondayItems = week1?.get(0);
      expect(mondayItems).toEqual([items[0]]);
    });

    it('should organize multiple items in same week different days', () => {
      const items: TestWorkout[] = [
        { id: 1, date: new Date('2025-02-24T00:00:00.000Z'), name: 'Monday' }, // Week 1, Monday
        {
          id: 2,
          date: new Date('2025-02-26T00:00:00.000Z'),
          name: 'Wednesday',
        }, // Week 1, Wednesday
        { id: 3, date: new Date('2025-02-28T00:00:00.000Z'), name: 'Friday' }, // Week 1, Friday
      ];
      const startDate = new Date('2025-02-24T00:00:00.000Z');

      const result = organizeByWeek(items, (item) => item.date, startDate);

      expect(result.size).toBe(1);
      const week1 = result.get(1);

      expect(week1?.size).toBe(3);
      expect(week1?.get(0)).toEqual([items[0]]); // Monday
      expect(week1?.get(2)).toEqual([items[1]]); // Wednesday
      expect(week1?.get(4)).toEqual([items[2]]); // Friday
    });

    it('should organize items across multiple weeks', () => {
      const items: TestWorkout[] = [
        { id: 1, date: new Date('2025-02-24T00:00:00.000Z'), name: 'Week 1' }, // Week 1
        { id: 2, date: new Date('2025-03-03T00:00:00.000Z'), name: 'Week 2' }, // Week 2
        { id: 3, date: new Date('2025-03-10T00:00:00.000Z'), name: 'Week 3' }, // Week 3
      ];
      const startDate = new Date('2025-02-24T00:00:00.000Z');

      const result = organizeByWeek(items, (item) => item.date, startDate);

      expect(result.size).toBe(3);
      expect(result.has(1)).toBe(true);
      expect(result.has(2)).toBe(true);
      expect(result.has(3)).toBe(true);
    });

    it('should handle multiple items on same day', () => {
      const items: TestWorkout[] = [
        {
          id: 1,
          date: new Date('2025-02-24T08:00:00.000Z'),
          name: 'Morning workout',
        },
        {
          id: 2,
          date: new Date('2025-02-24T18:00:00.000Z'),
          name: 'Evening workout',
        },
        {
          id: 3,
          date: new Date('2025-02-24T12:00:00.000Z'),
          name: 'Noon workout',
        },
      ];
      const startDate = new Date('2025-02-24T00:00:00.000Z');

      const result = organizeByWeek(items, (item) => item.date, startDate);

      const week1 = result.get(1);
      const mondayItems = week1?.get(0);

      expect(mondayItems?.length).toBe(3);
      expect(mondayItems).toEqual(items);
    });

    it('should organize complex multi-week plan correctly', () => {
      const items: TestWorkout[] = [
        // Week 1
        { id: 1, date: new Date('2025-02-24T00:00:00.000Z'), name: 'W1-Mon' },
        { id: 2, date: new Date('2025-02-26T00:00:00.000Z'), name: 'W1-Wed' },
        { id: 3, date: new Date('2025-03-02T00:00:00.000Z'), name: 'W1-Sun' },
        // Week 2
        { id: 4, date: new Date('2025-03-03T00:00:00.000Z'), name: 'W2-Mon' },
        { id: 5, date: new Date('2025-03-05T00:00:00.000Z'), name: 'W2-Wed' },
        // Week 3
        { id: 6, date: new Date('2025-03-10T00:00:00.000Z'), name: 'W3-Mon' },
        // Null date (should be skipped)
        { id: 7, date: null, name: 'No date' },
      ];
      const startDate = new Date('2025-02-24T00:00:00.000Z');

      const result = organizeByWeek(items, (item) => item.date, startDate);

      // Should have 3 weeks
      expect(result.size).toBe(3);

      // Week 1: 3 workouts
      const week1 = result.get(1);
      expect(week1?.size).toBe(3);
      expect(week1?.get(0)?.[0]).toEqual(items[0]); // Monday
      expect(week1?.get(2)?.[0]).toEqual(items[1]); // Wednesday
      expect(week1?.get(6)?.[0]).toEqual(items[2]); // Sunday

      // Week 2: 2 workouts
      const week2 = result.get(2);
      expect(week2?.size).toBe(2);
      expect(week2?.get(0)?.[0]).toEqual(items[3]); // Monday
      expect(week2?.get(2)?.[0]).toEqual(items[4]); // Wednesday

      // Week 3: 1 workout
      const week3 = result.get(3);
      expect(week3?.size).toBe(1);
      expect(week3?.get(0)?.[0]).toEqual(items[5]); // Monday
    });

    it('should handle items before start date (week 0)', () => {
      const items: TestWorkout[] = [
        {
          id: 1,
          date: new Date('2025-02-20T00:00:00.000Z'),
          name: 'Before start',
        }, // Before start
        { id: 2, date: new Date('2025-02-24T00:00:00.000Z'), name: 'On start' }, // Start date
      ];
      const startDate = new Date('2025-02-24T00:00:00.000Z');

      const result = organizeByWeek(items, (item) => item.date, startDate);

      expect(result.has(0)).toBe(true); // Week 0 for items before start
      expect(result.has(1)).toBe(true); // Week 1 for items on/after start
    });

    it('should use custom date extractor function', () => {
      interface CustomItem {
        id: number;
        scheduledDate: Date | null;
      }

      const items: CustomItem[] = [
        { id: 1, scheduledDate: new Date('2025-02-24T00:00:00.000Z') },
        { id: 2, scheduledDate: new Date('2025-03-03T00:00:00.000Z') },
      ];
      const startDate = new Date('2025-02-24T00:00:00.000Z');

      const result = organizeByWeek(
        items,
        (item) => item.scheduledDate,
        startDate
      );

      expect(result.size).toBe(2);
      expect(result.has(1)).toBe(true);
      expect(result.has(2)).toBe(true);
    });

    it('should handle year boundary correctly', () => {
      const items: TestWorkout[] = [
        { id: 1, date: new Date('2024-12-30T00:00:00.000Z'), name: 'Week 1' }, // Week 1
        { id: 2, date: new Date('2025-01-06T00:00:00.000Z'), name: 'Week 2' }, // Week 2
      ];
      const startDate = new Date('2024-12-30T00:00:00.000Z');

      const result = organizeByWeek(items, (item) => item.date, startDate);

      expect(result.size).toBe(2);
      expect(result.has(1)).toBe(true);
      expect(result.has(2)).toBe(true);
    });
  });

  describe('WeekMap type', () => {
    it('should allow typed access to week and day data', () => {
      interface Workout {
        id: number;
        name: string;
      }

      const weekMap: WeekMap<Workout> = new Map();
      const week1 = new Map<number, Workout[]>();
      week1.set(0, [{ id: 1, name: 'Monday workout' }]);
      weekMap.set(1, week1);

      const mondayWorkouts = weekMap.get(1)?.get(0);
      expect(mondayWorkouts?.[0].id).toBe(1);
      expect(mondayWorkouts?.[0].name).toBe('Monday workout');
    });
  });
});
