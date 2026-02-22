/**
 * Date utility functions for training plan calendar calculations
 *
 * These utilities help organize training plan data into a week-based calendar
 * format, where all plans start on Monday and are displayed as Week 1, Week 2, etc.
 */

/**
 * Type for organizing items by week and day
 * - Outer Map: week number (1-indexed) -> inner Map
 * - Inner Map: day of week (0=Monday, 6=Sunday) -> array of items
 */
export type WeekMap<T> = Map<number, Map<number, T[]>>;

/**
 * Normalize a date to the previous or same Monday at midnight UTC
 *
 * @param date - The date to normalize
 * @returns Date object representing the Monday of the week containing the input date
 *
 * @example
 * normalizeToMonday(new Date('2025-02-26')) // Wednesday
 * // Returns: Mon Feb 24, 2025 00:00:00 UTC
 */
export function normalizeToMonday(date: Date): Date {
  const normalized = new Date(date);

  // Get day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  const dayOfWeek = normalized.getUTCDay();

  // Calculate days to subtract to get to Monday
  // Sunday (0) -> subtract 6 days
  // Monday (1) -> subtract 0 days
  // Tuesday (2) -> subtract 1 day
  // etc.
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  // Move to Monday
  normalized.setUTCDate(normalized.getUTCDate() - daysToSubtract);

  // Normalize to midnight UTC
  normalized.setUTCHours(0, 0, 0, 0);

  return normalized;
}

/**
 * Get day of week where Monday = 0 and Sunday = 6
 *
 * @param date - The date to check
 * @returns Day of week (0=Monday, 1=Tuesday, ..., 6=Sunday)
 *
 * @example
 * getDayOfWeek(new Date('2025-02-24')) // Monday
 * // Returns: 0
 *
 * getDayOfWeek(new Date('2025-03-02')) // Sunday
 * // Returns: 6
 */
export function getDayOfWeek(date: Date): number {
  // JavaScript Date.getUTCDay() returns 0=Sunday, 1=Monday, ..., 6=Saturday
  // We need 0=Monday, 1=Tuesday, ..., 6=Sunday
  const jsDay = date.getUTCDay();

  // Convert: Sunday (0) becomes 6, Monday (1) becomes 0, etc.
  return jsDay === 0 ? 6 : jsDay - 1;
}

/**
 * Calculate week number from a date relative to a start date
 *
 * Week numbers are 1-indexed (Week 1, Week 2, etc.)
 * All dates are normalized to Monday to determine which week they belong to
 * Dates before the start date return week 0
 *
 * @param itemDate - The date to calculate week number for
 * @param startDate - The plan start date (reference point)
 * @returns Week number (1-indexed), or 0 for dates before start
 *
 * @example
 * const start = new Date('2025-02-24'); // Monday
 * getWeekNumber(new Date('2025-02-26'), start); // Wednesday, same week
 * // Returns: 1
 *
 * getWeekNumber(new Date('2025-03-03'), start); // Monday, next week
 * // Returns: 2
 */
export function getWeekNumber(itemDate: Date, startDate: Date): number {
  // Normalize both dates to their respective Mondays
  const itemMonday = normalizeToMonday(itemDate);
  const startMonday = normalizeToMonday(startDate);

  // Calculate milliseconds difference
  const diffMs = itemMonday.getTime() - startMonday.getTime();

  // Convert to weeks
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const diffWeeks = Math.floor(diffMs / msPerWeek);

  // Return 1-indexed week number (or 0 for dates before start)
  return diffWeeks + 1;
}

/**
 * Find the earliest date from an array of items
 *
 * @param items - Array of items with dates
 * @returns Earliest date, or null if no valid dates found
 *
 * @example
 * const items = [
 *   { date: new Date('2025-03-01'), name: 'Item 1' },
 *   { date: new Date('2025-02-20'), name: 'Item 2' },
 *   { date: null, name: 'Item 3' }
 * ];
 * findEarliestDate(items);
 * // Returns: Date('2025-02-20')
 */
export function findEarliestDate<T extends { date: Date | null }>(
  items: T[]
): Date | null {
  if (items.length === 0) {
    return null;
  }

  // Filter out null dates and find the minimum
  const validDates = items
    .map((item) => item.date)
    .filter((date): date is Date => date !== null);

  if (validDates.length === 0) {
    return null;
  }

  // Find earliest by comparing timestamps
  return validDates.reduce((earliest, current) =>
    current.getTime() < earliest.getTime() ? current : earliest
  );
}

/**
 * Organize items by week and day for calendar display
 *
 * Creates a nested Map structure:
 * - Outer Map: week number -> inner Map
 * - Inner Map: day of week -> array of items
 *
 * Items with null dates are skipped
 *
 * @param items - Array of items to organize
 * @param dateExtractor - Function to extract date from each item
 * @param startDate - Plan start date (reference for week calculation)
 * @returns Nested Map organized by week and day
 *
 * @example
 * const workouts = [
 *   { id: 1, date: new Date('2025-02-24'), name: 'Workout 1' }, // Week 1, Monday
 *   { id: 2, date: new Date('2025-03-03'), name: 'Workout 2' }  // Week 2, Monday
 * ];
 * const organized = organizeByWeek(
 *   workouts,
 *   (w) => w.date,
 *   new Date('2025-02-24')
 * );
 * // organized.get(1)?.get(0) -> [{ id: 1, ... }]
 * // organized.get(2)?.get(0) -> [{ id: 2, ... }]
 */
export function organizeByWeek<T>(
  items: T[],
  dateExtractor: (item: T) => Date | null,
  startDate: Date
): WeekMap<T> {
  const weekMap: WeekMap<T> = new Map();

  for (const item of items) {
    const date = dateExtractor(item);

    // Skip items without dates
    if (!date) {
      continue;
    }

    // Calculate week and day
    const weekNumber = getWeekNumber(date, startDate);
    const dayOfWeek = getDayOfWeek(date);

    // Get or create week map
    let weekData = weekMap.get(weekNumber);
    if (!weekData) {
      weekData = new Map();
      weekMap.set(weekNumber, weekData);
    }

    // Get or create day array
    let dayItems = weekData.get(dayOfWeek);
    if (!dayItems) {
      dayItems = [];
      weekData.set(dayOfWeek, dayItems);
    }

    // Add item to day
    dayItems.push(item);
  }

  return weekMap;
}
