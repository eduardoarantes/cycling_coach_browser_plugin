/**
 * Display helpers for captured-workout rows. Kept out of the component file
 * so the component module exports only components (fast refresh).
 */

/** Human label for a PlanMyPeak discipline value such as `cross_train`. */
export function formatDisciplineLabel(discipline: string): string {
  return discipline
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** TrainingPeaks stores planned time as decimal hours. */
export function formatPlannedDuration(hours: number | null): string | null {
  if (hours === null || !Number.isFinite(hours) || hours <= 0) {
    return null;
  }
  const totalMinutes = Math.round(hours * 60);
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (wholeHours === 0) {
    return `${minutes}m`;
  }
  return minutes === 0 ? `${wholeHours}h` : `${wholeHours}h ${minutes}m`;
}

/** `2026-09-20T00:00:00` → `Sep 20, 2026`; anything unparseable is echoed. */
export function formatWorkoutDay(workoutDay: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(workoutDay);
  if (!match) {
    return workoutDay;
  }
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  );
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
