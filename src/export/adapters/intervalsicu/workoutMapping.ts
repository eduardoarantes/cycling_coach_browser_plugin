import type { LibraryItem } from '@/schemas/library.schema';
import {
  IntervalsWorkoutBuilderDocumentSchema,
  type IntervalsWorkoutBuilderDocument,
  type IntervalsWorkoutSection,
  type IntervalsWorkoutSectionItem,
  type IntervalsWorkoutStep,
  type IntervalsWorkoutStepTarget,
} from '@/schemas/intervalsicuDsl.schema';

/**
 * TrainingPeaks workoutTypeId -> Intervals.icu sport type (provider-specific).
 *
 * Keep this mapping scoped to the Intervals.icu integration. Other providers
 * should define their own TP mapping tables.
 */
export const TP_TO_INTERVALS_WORKOUT_TYPE_MAP: Record<number, string> = {
  1: 'Swim',
  2: 'Ride',
  3: 'Run',
  4: 'Other', // Brick
  5: 'Other', // Crosstrain
  6: 'Other', // Race (sport-specific race type unknown)
  7: 'Other', // Day Off / Note-like
  8: 'Ride', // Mountain bike (generic cycling default)
  9: 'WeightTraining',
  10: 'Other', // Custom
  11: 'NordicSki',
  12: 'Rowing',
  13: 'Walk',
  29: 'WeightTraining', // TP duplicate strength type
  100: 'Other',
} as const;

const INTENSITY_UNIT_SUFFIX: Record<string, string> = {
  percentOfFtp: '%',
  percentOfThresholdPace: '% Pace',
  percentOfThresholdHr: '% LTHR',
  percentOfThresholdHeartRate: '% LTHR',
} as const;

type UnknownRecord = Record<string, unknown>;

export function mapTpWorkoutTypeToIntervalsType(workoutTypeId: number): string {
  return TP_TO_INTERVALS_WORKOUT_TYPE_MAP[workoutTypeId] ?? 'Other';
}

export function buildIntervalsIcuDescription(workout: LibraryItem): string {
  const structuredText = renderIntervalsTextFromTpStructure(workout.structure);
  const narrativeParts: string[] = [];

  if (workout.description) {
    narrativeParts.push(escapeNonScriptText(workout.description));
  }

  if (workout.coachComments) {
    narrativeParts.push(
      `Coach Notes:\n${escapeNonScriptText(workout.coachComments)}`
    );
  }

  if (structuredText) {
    if (narrativeParts.length === 0) {
      return structuredText;
    }

    // Keep Intervals workout script first, then append non-script notes under a
    // neutral separator so the description stays editable in Intervals.
    return `${structuredText}\n\n- - - -\n${narrativeParts.join('\n\n')}`;
  }

  return narrativeParts.length > 0
    ? narrativeParts.join('\n\n')
    : 'Workout from TrainingPeaks';
}

export function buildIntervalsWorkoutBuilderDocumentFromTpStructure(
  structure: unknown,
  sportHint?: string
): IntervalsWorkoutBuilderDocument | null {
  if (!structure || typeof structure !== 'object') {
    return null;
  }

  const root = structure as UnknownRecord;
  if (!Array.isArray(root.structure)) {
    return null;
  }

  const intensityMetric =
    typeof root.primaryIntensityMetric === 'string'
      ? root.primaryIntensityMetric
      : undefined;

  const sections = root.structure.flatMap((node) =>
    buildIntervalsAstSectionsFromTpNode(node, intensityMetric)
  );

  if (sections.length === 0) {
    return null;
  }

  try {
    return IntervalsWorkoutBuilderDocumentSchema.parse({
      ...(sportHint ? { sportHint } : {}),
      sections,
    });
  } catch {
    return null;
  }
}

export function renderIntervalsWorkoutBuilderDocument(
  document: IntervalsWorkoutBuilderDocument
): string {
  const sections = document.sections
    .map((section) =>
      normalizeRenderedLines(renderIntervalsAstSection(section).split('\n'))
    )
    .filter(Boolean);

  const normalized = sections.join('\n\n').trim();
  return normalized;
}

export function renderIntervalsTextFromTpStructure(
  structure: unknown
): string | null {
  const ast = buildIntervalsWorkoutBuilderDocumentFromTpStructure(structure);
  if (ast) {
    const rendered = renderIntervalsWorkoutBuilderDocument(ast);
    return rendered.length > 0 ? rendered : null;
  }

  return renderIntervalsTextFromTpStructureLegacy(structure);
}

function renderIntervalsTextFromTpStructureLegacy(
  structure: unknown
): string | null {
  if (!structure || typeof structure !== 'object') {
    return null;
  }

  const root = structure as UnknownRecord;
  if (!Array.isArray(root.structure)) {
    return null;
  }

  const intensityMetric =
    typeof root.primaryIntensityMetric === 'string'
      ? root.primaryIntensityMetric
      : undefined;

  // Preserve top-level block boundaries (e.g. warmup / main set / cooldown)
  // with a blank line between sections for better readability in Intervals.
  const sections = root.structure
    .map((node) =>
      normalizeRenderedLines(renderStructureNode(node, intensityMetric))
    )
    .filter(Boolean);

  const normalized = sections.join('\n\n').trim();

  return normalized.length > 0 ? normalized : null;
}

function buildIntervalsAstSectionsFromTpNode(
  node: unknown,
  intensityMetric?: string
): IntervalsWorkoutSection[] {
  if (!node || typeof node !== 'object') {
    return [];
  }

  const record = node as UnknownRecord;

  if (Array.isArray(record.steps)) {
    return buildIntervalsAstSectionsFromTpBlock(record, intensityMetric);
  }

  const step = buildIntervalsAstStepFromTpStep(record, intensityMetric);
  if (!step) {
    return [];
  }

  return [
    {
      kind: 'section',
      items: [step],
    },
  ];
}

function buildIntervalsAstSectionsFromTpBlock(
  block: UnknownRecord,
  intensityMetric?: string
): IntervalsWorkoutSection[] {
  const type = typeof block.type === 'string' ? block.type : '';
  const steps = Array.isArray(block.steps) ? block.steps : [];

  if (steps.length === 0) {
    return [];
  }

  if (type === 'repetition') {
    const repeatCount = getRepetitionCount(block.length) ?? undefined;
    const items = steps.flatMap((child) =>
      buildIntervalsAstSectionsFromTpNode(child, intensityMetric).flatMap(
        (section) => section.items
      )
    );

    if (items.length === 0) {
      return [];
    }

    return [
      {
        kind: 'section',
        ...(repeatCount ? { repeatCount } : {}),
        items,
      },
    ];
  }

  // TP often wraps a single step in a container block, but can also nest
  // warmup / repetition / cooldown groups. Merge adjacent non-repeat groups
  // so rendering preserves current spacing behavior.
  const output: IntervalsWorkoutSection[] = [];
  let bufferItems: IntervalsWorkoutSectionItem[] = [];

  const flushBuffer = (): void => {
    if (bufferItems.length === 0) {
      return;
    }
    output.push({
      kind: 'section',
      items: bufferItems,
    });
    bufferItems = [];
  };

  for (const child of steps) {
    const childSections = buildIntervalsAstSectionsFromTpNode(
      child,
      intensityMetric
    );
    if (childSections.length === 0) {
      continue;
    }

    const hasRepeatSection = childSections.some(
      (section) => section.repeatCount !== undefined
    );

    if (hasRepeatSection) {
      flushBuffer();
      output.push(...childSections);
      continue;
    }

    bufferItems.push(...childSections.flatMap((section) => section.items));
  }

  flushBuffer();
  return output;
}

function buildIntervalsAstStepFromTpStep(
  step: UnknownRecord,
  intensityMetric?: string
): IntervalsWorkoutStep | null {
  const duration = mapTpLengthToIntervalsAstDuration(step.length);
  if (!duration) {
    return null;
  }

  const intensityClass = normalizeIntensityClass(step.intensityClass);
  const astIntensityTag = toIntervalsAstIntensityTag(intensityClass);
  const name =
    typeof step.name === 'string' && step.name.trim().length > 0
      ? step.name.trim()
      : null;

  const targets: IntervalsWorkoutStepTarget[] = [];
  const primaryTarget = buildIntervalsAstPrimaryTarget(
    step.targets,
    intensityMetric
  );
  if (primaryTarget) {
    targets.push(primaryTarget);
  }

  const cadenceTarget = extractCadenceRpmTargetFromTpStep(step);
  if (cadenceTarget) {
    targets.push(cadenceTarget);
  }

  return {
    kind: 'step',
    ...(name && !isRedundantName(name, intensityClass) ? { label: name } : {}),
    duration,
    targetMode: 'steady',
    targets,
    ...(astIntensityTag ? { intensityTag: astIntensityTag } : {}),
    prompts: [],
  };
}

function toIntervalsAstIntensityTag(
  intensityClass: string | null
): IntervalsWorkoutStep['intensityTag'] {
  switch (intensityClass) {
    case 'warmup':
    case 'active':
    case 'rest':
    case 'cooldown':
      return intensityClass;
    default:
      return undefined;
  }
}

function mapTpLengthToIntervalsAstDuration(
  length: unknown
): IntervalsWorkoutStep['duration'] | null {
  if (!length || typeof length !== 'object') {
    return null;
  }

  const record = length as UnknownRecord;
  const unit = typeof record.unit === 'string' ? record.unit : null;
  const value =
    typeof record.value === 'number' && Number.isFinite(record.value)
      ? record.value
      : null;

  if (!unit) {
    return null;
  }

  if (unit === 'lapButton') {
    return { kind: 'press_lap' };
  }

  if (value === null || value <= 0) {
    return null;
  }

  switch (unit) {
    case 'second':
    case 'seconds':
      return { kind: 'time', value, unit: 'seconds' };
    case 'minute':
    case 'minutes':
      return { kind: 'time', value, unit: 'minutes' };
    case 'hour':
    case 'hours':
      return { kind: 'time', value, unit: 'hours' };
    case 'meter':
    case 'meters':
      return { kind: 'distance', value, unit: 'meters' };
    case 'kilometer':
    case 'kilometers':
      return { kind: 'distance', value, unit: 'kilometers' };
    case 'yard':
    case 'yards':
      return { kind: 'distance', value, unit: 'yards' };
    case 'mile':
    case 'miles':
      return { kind: 'distance', value, unit: 'miles' };
    default:
      return null;
  }
}

function buildIntervalsAstPrimaryTarget(
  targets: unknown,
  intensityMetric?: string
): IntervalsWorkoutStepTarget | null {
  const range = getFirstNumericTargetRange(targets);
  if (!range) {
    return null;
  }

  const value =
    range.min === range.max ? range.min : { min: range.min, max: range.max };

  switch (intensityMetric) {
    case 'percentOfFtp':
      return { kind: 'power_percent_ftp', value };
    case 'percentOfThresholdPace':
      return { kind: 'pace_percent_threshold', value };
    case 'percentOfThresholdHr':
    case 'percentOfThresholdHeartRate':
      return { kind: 'hr_percent_lthr', value };
    default:
      if (intensityMetric?.startsWith('percent')) {
        return {
          kind: 'free_text',
          text: formatRangeText(range.min, range.max, '%'),
        };
      }
      return { kind: 'free_text', text: formatRangeText(range.min, range.max) };
  }
}

function getFirstNumericTargetRange(
  targets: unknown
): { min: number; max: number } | null {
  if (!Array.isArray(targets) || targets.length === 0) {
    return null;
  }

  const first = targets.find(
    (target): target is UnknownRecord =>
      !!target && typeof target === 'object' && !Array.isArray(target)
  );
  if (!first) {
    return null;
  }

  const min = getNumeric(first.minValue) ?? getNumeric(first.value);
  const max = getNumeric(first.maxValue) ?? min;
  if (min === null && max === null) {
    return null;
  }
  const lower = min ?? max;
  const upper = max ?? min;
  if (lower === null || upper === null) {
    return null;
  }

  return { min: Math.min(lower, upper), max: Math.max(lower, upper) };
}

function extractCadenceRpmTargetFromTpStep(
  step: UnknownRecord
): IntervalsWorkoutStepTarget | null {
  const directCadence = extractCadenceRangeLike(step.cadence);
  if (directCadence) {
    return directCadence;
  }

  const directKeys = [
    step.cadenceRpm,
    step.cadenceTargetRpm,
    step.targetCadenceRpm,
  ];

  for (const candidate of directKeys) {
    const numeric = getNumeric(candidate);
    if (numeric !== null) {
      return { kind: 'cadence_rpm', value: Math.round(numeric) };
    }
  }

  const secondaryTargets = [
    ...(Array.isArray(step.secondaryTargets) ? step.secondaryTargets : []),
    ...(Array.isArray(step.secondary_targets) ? step.secondary_targets : []),
  ];

  for (const target of secondaryTargets) {
    const cadence = extractCadenceRangeLike(target);
    if (cadence) {
      return cadence;
    }
  }

  return null;
}

function extractCadenceRangeLike(
  value: unknown
): IntervalsWorkoutStepTarget | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as UnknownRecord;
  const typeText = [
    typeof record.type === 'string' ? record.type : '',
    typeof record.metric === 'string' ? record.metric : '',
    typeof record.unit === 'string' ? record.unit : '',
    typeof record.name === 'string' ? record.name : '',
  ]
    .join(' ')
    .toLowerCase();

  const looksLikeCadence =
    typeText.includes('cadence') ||
    typeText.includes('rpm') ||
    'cadenceRpm' in record ||
    'minRpm' in record ||
    'maxRpm' in record ||
    'rpm' in record;

  if (!looksLikeCadence) {
    return null;
  }

  const exact =
    getNumeric(record.rpm) ??
    getNumeric(record.cadenceRpm) ??
    getNumeric(record.value);
  const min =
    getNumeric(record.minRpm) ??
    getNumeric(record.min) ??
    getNumeric(record.minValue);
  const max =
    getNumeric(record.maxRpm) ??
    getNumeric(record.max) ??
    getNumeric(record.maxValue);

  if (min !== null || max !== null) {
    const lower = min ?? max;
    const upper = max ?? min;
    if (lower !== null && upper !== null) {
      return {
        kind: 'cadence_rpm',
        value: {
          min: Math.round(Math.min(lower, upper)),
          max: Math.round(Math.max(lower, upper)),
        },
      };
    }
  }

  if (exact !== null) {
    return { kind: 'cadence_rpm', value: Math.round(exact) };
  }

  return null;
}

function renderIntervalsAstSection(section: IntervalsWorkoutSection): string {
  const lines: string[] = [];

  if (section.heading) {
    lines.push(section.heading);
  }

  if (section.repeatCount) {
    lines.push(`${section.repeatCount}x`);
  }

  for (const item of section.items) {
    lines.push(renderIntervalsAstItem(item));
  }

  return lines.join('\n');
}

function renderIntervalsAstItem(item: IntervalsWorkoutSectionItem): string {
  if (item.kind === 'text') {
    return item.text;
  }

  return renderIntervalsAstStep(item);
}

function renderIntervalsAstStep(step: IntervalsWorkoutStep): string {
  const tokens = ['-'];

  if (step.label) {
    tokens.push(step.label);
  }

  const duration = formatIntervalsAstDuration(step.duration);
  if (duration) {
    tokens.push(duration);
  }

  if (step.targetMode === 'ramp') {
    tokens.push('ramp');
  }

  const targetText = step.targets
    .map(renderIntervalsAstTarget)
    .filter((value): value is string => Boolean(value));
  if (targetText.length > 0) {
    tokens.push(...targetText);
  }

  if (step.intensityTag && step.intensityTag !== 'active') {
    tokens.push(`intensity=${step.intensityTag}`);
  }

  return tokens.join(' ');
}

function formatIntervalsAstDuration(
  stepDuration: IntervalsWorkoutStep['duration']
): string | null {
  switch (stepDuration.kind) {
    case 'press_lap':
      return 'lap';
    case 'time':
      switch (stepDuration.unit) {
        case 'seconds':
          return formatSeconds(stepDuration.value);
        case 'minutes':
          return `${trimDecimal(stepDuration.value)}m`;
        case 'hours':
          return `${trimDecimal(stepDuration.value)}h`;
      }
      break;
    case 'distance':
      switch (stepDuration.unit) {
        case 'meters':
          return `${trimDecimal(stepDuration.value)}m`;
        case 'kilometers':
          return `${trimDecimal(stepDuration.value)}km`;
        case 'yards':
          return `${trimDecimal(stepDuration.value)}yd`;
        case 'miles':
          return `${trimDecimal(stepDuration.value)}mi`;
      }
      break;
  }

  return null;
}

function renderIntervalsAstTarget(
  target: IntervalsWorkoutStepTarget
): string | null {
  switch (target.kind) {
    case 'power_percent_ftp':
      return formatIntervalsTargetValue(target.value, '%');
    case 'power_watts':
      return formatIntervalsTargetValue(target.value, 'w');
    case 'pace_percent_threshold':
      return formatIntervalsTargetValue(target.value, '% Pace');
    case 'pace_absolute':
      return `${formatIntervalsTargetValue(target.value)} Pace /${target.denominatorUnit}`;
    case 'hr_percent_max':
      return formatIntervalsTargetValue(target.value, '% HR');
    case 'hr_percent_lthr':
      return formatIntervalsTargetValue(target.value, '% LTHR');
    case 'zone':
      if (target.metric === 'power') {
        return target.zone.toUpperCase();
      }
      if (target.metric === 'heart_rate') {
        return `${target.zone.toUpperCase()} HR`;
      }
      return `${target.zone.toUpperCase()} Pace`;
    case 'cadence_rpm':
      return `${formatIntervalsTargetValue(target.value)} rpm`;
    case 'free_text':
      return target.text;
    default:
      return null;
  }
}

function formatIntervalsTargetValue(
  value: number | { min: number; max: number },
  suffix = ''
): string {
  if (typeof value === 'number') {
    return `${trimDecimal(value)}${suffix}`;
  }

  if (value.min === value.max) {
    return `${trimDecimal(value.min)}${suffix}`;
  }

  return `${trimDecimal(value.min)}-${trimDecimal(value.max)}${suffix}`;
}

function formatRangeText(min: number, max: number, suffix = ''): string {
  if (min === max) {
    return `${trimDecimal(min)}${suffix}`;
  }
  return `${trimDecimal(min)}-${trimDecimal(max)}${suffix}`;
}

function renderStructureNode(
  node: unknown,
  intensityMetric?: string
): string[] {
  if (!node || typeof node !== 'object') {
    return [];
  }

  const record = node as UnknownRecord;

  if (Array.isArray(record.steps)) {
    return renderStructureBlock(record, intensityMetric);
  }

  return renderSimpleStep(record, intensityMetric);
}

function renderStructureBlock(
  block: UnknownRecord,
  intensityMetric?: string
): string[] {
  const type = typeof block.type === 'string' ? block.type : '';
  const steps = Array.isArray(block.steps) ? block.steps : [];

  if (steps.length === 0) {
    return [];
  }

  if (type === 'repetition') {
    const repetitions = getRepetitionCount(block.length);
    const lines: string[] = [];
    if (repetitions !== null) {
      lines.push(`${repetitions}x`);
    }

    for (const child of steps) {
      lines.push(...renderStructureNode(child, intensityMetric));
    }

    return lines;
  }

  // TP often wraps a single step inside a "step" block, but some container
  // blocks nest warmup / repetitions / cooldown. Preserve child-group
  // boundaries (especially around repetition blocks) with blank lines.
  const childGroups = steps
    .map((child) => renderStructureNode(child, intensityMetric))
    .filter((group) => group.some((line) => line.trim() !== ''));

  if (childGroups.length <= 1) {
    return childGroups[0] ?? [];
  }

  const lines: string[] = [];
  for (let index = 0; index < childGroups.length; index += 1) {
    const group = childGroups[index];
    if (index > 0) {
      const previousGroup = childGroups[index - 1];
      if (shouldSeparateChildGroups(previousGroup, group)) {
        lines.push('');
      }
    }
    lines.push(...group);
  }

  return lines;
}

function renderSimpleStep(
  step: UnknownRecord,
  intensityMetric?: string
): string[] {
  const name =
    typeof step.name === 'string' && step.name.trim().length > 0
      ? step.name.trim()
      : null;
  const intensityClass = normalizeIntensityClass(step.intensityClass);
  const duration = formatLength(step.length);
  const target = formatTarget(step.targets, intensityMetric);

  const stepTokens = ['-'];
  if (name && !isRedundantName(name, intensityClass)) {
    stepTokens.push(name);
  }
  if (duration) {
    stepTokens.push(duration);
  }
  if (target) {
    stepTokens.push(target);
  }
  if (intensityClass && intensityClass !== 'active') {
    stepTokens.push(`intensity=${intensityClass}`);
  }

  if (stepTokens.length === 1) {
    return [];
  }

  return [stepTokens.join(' ')];
}

function normalizeIntensityClass(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }

  switch (value) {
    case 'warmUp':
      return 'warmup';
    case 'coolDown':
      return 'cooldown';
    default:
      return value.trim().toLowerCase();
  }
}

function isRedundantName(name: string, intensityClass: string | null): boolean {
  if (!intensityClass) {
    return false;
  }

  const normalize = (value: string) =>
    value.toLowerCase().replace(/[^a-z]/g, '');
  return normalize(name) === normalize(intensityClass);
}

function getRepetitionCount(length: unknown): number | null {
  if (!length || typeof length !== 'object') {
    return null;
  }

  const record = length as UnknownRecord;
  if (record.unit !== 'repetition') {
    return null;
  }

  if (typeof record.value === 'number' && Number.isFinite(record.value)) {
    return Math.max(1, Math.round(record.value));
  }

  return null;
}

function formatLength(length: unknown): string | null {
  if (!length || typeof length !== 'object') {
    return null;
  }

  const record = length as UnknownRecord;
  const unit = typeof record.unit === 'string' ? record.unit : null;
  const value =
    typeof record.value === 'number' && Number.isFinite(record.value)
      ? record.value
      : null;

  if (!unit || value === null || value <= 0) {
    return null;
  }

  switch (unit) {
    case 'second':
    case 'seconds':
      return formatSeconds(value);
    case 'minute':
    case 'minutes':
      return `${trimDecimal(value)}m`;
    case 'hour':
    case 'hours':
      return `${trimDecimal(value)}h`;
    case 'meter':
    case 'meters':
      return `${trimDecimal(value)}m`;
    case 'kilometer':
    case 'kilometers':
      return `${trimDecimal(value)}km`;
    default:
      return `${trimDecimal(value)} ${unit}`;
  }
}

function formatSeconds(seconds: number): string {
  const total = Math.round(seconds);
  if (total % 3600 === 0) {
    return `${total / 3600}h`;
  }
  if (total % 60 === 0) {
    return `${total / 60}m`;
  }
  return `${total}s`;
}

function formatTarget(
  targets: unknown,
  intensityMetric?: string
): string | null {
  if (!Array.isArray(targets) || targets.length === 0) {
    return null;
  }

  const first = targets.find(
    (target): target is UnknownRecord =>
      !!target && typeof target === 'object' && !Array.isArray(target)
  );

  if (!first) {
    return null;
  }

  const min = getNumeric(first.minValue) ?? getNumeric(first.value);
  const max = getNumeric(first.maxValue) ?? min;

  if (min === null && max === null) {
    return null;
  }

  const lower = min ?? max;
  const upper = max ?? min;

  if (lower === null || upper === null) {
    return null;
  }

  const suffix = getTargetUnitSuffix(intensityMetric);
  if (lower === upper) {
    return `${trimDecimal(lower)}${suffix}`;
  }

  return `${trimDecimal(lower)}-${trimDecimal(upper)}${suffix}`;
}

function normalizeRenderedLines(lines: string[]): string {
  const trimmed = lines.map((line) => line.trimEnd());
  const compact: string[] = [];

  for (const line of trimmed) {
    const isBlank = line.trim() === '';
    if (isBlank) {
      if (compact.length === 0 || compact[compact.length - 1] === '') {
        continue;
      }
      compact.push('');
      continue;
    }

    compact.push(line);
  }

  while (compact[0] === '') {
    compact.shift();
  }
  while (compact[compact.length - 1] === '') {
    compact.pop();
  }

  return compact.join('\n');
}

function shouldSeparateChildGroups(
  previousGroup: string[],
  nextGroup: string[]
): boolean {
  return isRepeatHeaderGroup(previousGroup) || isRepeatHeaderGroup(nextGroup);
}

function isRepeatHeaderGroup(group: string[]): boolean {
  const firstNonBlank = group.find((line) => line.trim() !== '');
  return firstNonBlank !== undefined && /^\d+x$/.test(firstNonBlank.trim());
}

function getTargetUnitSuffix(intensityMetric?: string): string {
  if (!intensityMetric) {
    return '';
  }

  if (intensityMetric in INTENSITY_UNIT_SUFFIX) {
    return INTENSITY_UNIT_SUFFIX[intensityMetric];
  }

  return intensityMetric.startsWith('percent') ? '%' : '';
}

function getNumeric(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function trimDecimal(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}

function escapeNonScriptText(text: string): string {
  return text.replace(/^[-*]/gm, '`$&');
}
