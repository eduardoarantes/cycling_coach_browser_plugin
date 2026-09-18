/**
 * PlanMyPeak site-control protocol types
 *
 * Defines the wire contract that lets the PlanMyPeak web app drive the
 * extension: detect it, read TrainingPeaks data through it, and ask it to open
 * the import overlay.
 *
 * Two rules are load-bearing and enforced everywhere this protocol is handled:
 *   1. The page names *site-control* request types, never `RuntimeMessage`
 *      types, so the page-reachable surface is this closed union and nothing
 *      else.
 *   2. No credential material (TrainingPeaks token, PlanMyPeak token, Supabase
 *      key, Intervals.icu API key) may appear in any message sent to the page.
 */

import type { Library } from '@/types/api.types';
import type {
  TrainingPlan,
  PlanWorkout,
  CalendarNote,
  CalendarEvent,
} from '@/schemas/trainingPlan.schema';
import type { RxBuilderWorkout } from '@/schemas/rxBuilder.schema';
import type { LibraryItem } from '@/schemas/library.schema';
import type { AthleteGroup } from '@/schemas/athleteGroup.schema';

/**
 * Protocol version carried by every envelope in both directions.
 * The page uses the value reported by `PING` to feature-detect.
 */
export const PLANMYPEAK_SITE_CONTROL_VERSION = 1;

/** Marker on page -> extension messages. */
export const SITE_CONTROL_PAGE_SOURCE = 'planmypeak-site-control';

/** Marker on extension -> page messages. */
export const SITE_CONTROL_EXTENSION_SOURCE = 'planmypeak-extension';

/**
 * The closed set of request types the page may name.
 *
 * Adding an entry here widens what an allowlisted page can make the extension
 * do, so every addition is a deliberate security decision.
 */
export const SITE_CONTROL_REQUEST_TYPES = [
  'PING',
  'GET_LIBRARIES',
  'GET_LIBRARY_ITEMS',
  'GET_TRAINING_PLANS',
  'GET_TRAINING_PLAN_LIBRARIES',
  'GET_PLAN_CONTENTS',
  'GET_ATHLETE_GROUPS',
  'OPEN_IMPORTER',
  'GET_CAPTURED_WORKOUT_SUMMARY',
  'IMPORT_MISSING_WORKOUTS',
  'GET_CAPTURED_WORKOUT_IMPORT_STATUS',
] as const;

export type SiteControlRequestType =
  (typeof SITE_CONTROL_REQUEST_TYPES)[number];

export function isSiteControlRequestType(
  value: unknown
): value is SiteControlRequestType {
  return (
    typeof value === 'string' &&
    (SITE_CONTROL_REQUEST_TYPES as readonly string[]).includes(value)
  );
}

export type SiteControlPingPayload = Record<string, never>;

export type SiteControlGetLibrariesPayload = Record<string, never>;

export interface SiteControlGetLibraryItemsPayload {
  libraryId: number;
}

export type SiteControlGetTrainingPlansPayload = Record<string, never>;

/**
 * `GET_TRAINING_PLAN_LIBRARIES` takes no arguments: the libraries returned are
 * the signed-in coach's, resolved from the captured session.
 */
export type SiteControlGetTrainingPlanLibrariesPayload = Record<string, never>;

/**
 * A TrainingPeaks plan library, as TrainingPeaks models it.
 *
 * Membership lives here as `planIds` rather than on the plan, so a plan's
 * library is found by looking its id up across libraries. This mirrors the API
 * rather than synthesising a per-plan field, which keeps `TrainingPlan` the
 * verbatim TrainingPeaks shape.
 *
 * Group with the same rule the extension uses, or the two surfaces will
 * disagree: take libraries in order, skip a plan already claimed by an earlier
 * one so it appears exactly once, and put plans in no library into an
 * "Ungrouped" bucket rather than hiding them.
 */
export interface SiteControlTrainingPlanLibrary {
  id: string;
  name: string;
  /** Plan ids in this library; may be empty for a library a coach made but never filled */
  planIds: number[];
}

export interface SiteControlGetPlanContentsPayload {
  planId: number;
}

/**
 * `GET_ATHLETE_GROUPS` takes no arguments on purpose.
 *
 * The coach whose groups are returned is resolved in the background from the
 * captured TrainingPeaks session, never from a page-supplied id, so an
 * allowlisted page cannot read another coach's groups by guessing one.
 */
export type SiteControlGetAthleteGroupsPayload = Record<string, never>;

/** The overlay's tabs, as the page may name them. */
export const SITE_CONTROL_IMPORTER_TABS = [
  'libraries',
  'plans',
  'groups',
] as const;

export type SiteControlImporterTab =
  (typeof SITE_CONTROL_IMPORTER_TABS)[number];

export interface SiteControlOpenImporterPayload {
  /** Pre-select this TrainingPeaks library when the overlay opens */
  libraryId?: number;
  /** Pre-select this TrainingPeaks training plan when the overlay opens */
  planId?: number;
  /** Open the overlay on its athlete-groups tab */
  groups?: boolean;
  /**
   * Which tab to open on when nothing is pre-selected.
   *
   * A hint, not an instruction: a pre-selected library, plan or group already
   * says which tab the coach needs, and that always wins. It exists for the
   * case where the page knows the context — a button on the plans page — but
   * has nothing specific to pre-select, so the coach would otherwise land on
   * a tab they did not ask for.
   */
  tab?: SiteControlImporterTab;
}

// ---------------------------------------------------------------------------
// Captured-workout imports (TrainingPeaks calendar captures → PlanMyPeak)
// ---------------------------------------------------------------------------
//
// These three requests are the *only* page-facing surface for captured
// workouts. The raw capture channel (`WORKOUT_CAPTURED`, `GET_CAPTURED_WORKOUTS`,
// `UPDATE_CAPTURED_WORKOUT`, `REMOVE_CAPTURED_WORKOUTS`) stays a runtime-message
// concern: a page can learn how many captures are missing from the coach's
// library and ask for them to be imported, but it can never read a capture,
// submit one, patch its status or delete it.

/**
 * `GET_CAPTURED_WORKOUT_SUMMARY` takes no arguments: the account whose captures
 * are counted is resolved from the stored PlanMyPeak session, never from the
 * page.
 */
export type SiteControlGetCapturedWorkoutSummaryPayload = Record<string, never>;

/**
 * `IMPORT_MISSING_WORKOUTS`.
 *
 * `contextId` is the opaque handle the summary returned for the verified account
 * and configured destination. It is correlation, not authorization: the
 * background re-resolves its own account and refuses a handle that no longer
 * matches. `operationId` is minted by the page so a retry after a lost
 * acknowledgement resolves to the same operation instead of starting a second.
 */
export interface SiteControlImportMissingWorkoutsPayload {
  contextId: string;
  operationId: string;
}

export interface SiteControlGetCapturedWorkoutImportStatusPayload {
  contextId: string;
  operationId: string;
}

/**
 * Why a summary or an import is refused. Every value names something the coach
 * can act on; none of them carries a credential or an account detail.
 */
export const CAPTURED_IMPORT_BLOCKED_REASONS = [
  /** The PlanMyPeak connection is switched off in the extension's settings. */
  'lookup_failed',
  'connection_disabled',
  /** No PlanMyPeak credential is stored. */
  'signed_out',
  /** A credential is stored but the coach it belongs to could not be resolved. */
  'account_unknown',
  /**
   * The signed-in TrainingPeaks account is not the one linked to the PlanMyPeak
   * coach (production only, as everywhere else in the extension).
   */
  'account_mismatch',
  /** The page's origin is not the destination the extension is configured for. */
  'destination_mismatch',
  /** The `contextId` no longer names the extension's current account/destination. */
  'stale_context',
  /** The account or destination changed while an import was running. */
  'account_changed',
] as const;

export type CapturedImportBlockedReason =
  (typeof CAPTURED_IMPORT_BLOCKED_REASONS)[number];

/** Lifecycle of one import operation, as reported to the page. */
export const CAPTURED_IMPORT_STATES = [
  'running',
  'completed',
  'interrupted',
  'blocked',
] as const;

export type CapturedImportState = (typeof CAPTURED_IMPORT_STATES)[number];

/** An operation the page may poll, without its counts. */
export interface SiteControlCapturedImportRef {
  operationId: string;
  state: CapturedImportState;
}

/**
 * `GET_CAPTURED_WORKOUT_SUMMARY` result.
 *
 * `state` is `checking` while the candidate set is still being reconciled
 * against the destination, `ready` once every candidate has a verified answer,
 * and `blocked` when nothing can be counted for the reason given. A
 * `missingCount` is present only when `ready`: an unknown answer is `null`,
 * never a zero.
 *
 * `coachId` is the same opaque id `PING` reports, repeated here so the page
 * can verify every reply against its own signed-in coach without a race
 * between two requests. `contextId` is opaque and only meaningful when handed
 * back to `IMPORT_MISSING_WORKOUTS` / `GET_CAPTURED_WORKOUT_IMPORT_STATUS`.
 *
 * `revision` increases whenever stored captures or import operations change,
 * so a page can tell that something happened between two polls — a popup send,
 * a recovered run — without being told what.
 *
 * `pendingCount` reports local availability even when destination checks are
 * blocked. `unlinkedCount` is deprecated informational metadata; unowned
 * captures need no claim or enrichment before they can be imported.
 */
export interface SiteControlCapturedWorkoutSummaryResult {
  /** All local pending captures; independent of owner and authentication. */
  pendingCount: number;
  contextId: string | null;
  coachId: string | null;
  revision: number;
  state: 'checking' | 'ready' | 'blocked';
  missingCount: number | null;
  unlinkedCount: number;
  blockedReason?: CapturedImportBlockedReason;
  activeOperation: SiteControlCapturedImportRef | null;
  latestOperation: SiteControlCapturedImportRef | null;
}

/**
 * `IMPORT_MISSING_WORKOUTS` acknowledgement.
 *
 * Answered as soon as the operation exists, never after the batch has finished:
 * the page polls `GET_CAPTURED_WORKOUT_IMPORT_STATUS` for progress. `completed`
 * on the acknowledgement means the operation id named a run that had already
 * finished, or that there was nothing to import.
 */
export interface SiteControlImportMissingWorkoutsResult {
  operationId: string;
  state: 'running' | 'completed' | 'blocked';
  blockedReason?: CapturedImportBlockedReason;
}

/** One workout that could not be imported. Title and a safe reason only. */
export interface SiteControlCapturedImportError {
  title: string;
  message: string;
}

/**
 * `GET_CAPTURED_WORKOUT_IMPORT_STATUS` result.
 *
 * Every count is in workouts. `processedCount` equals `importedCount +
 * alreadyPresentCount + failedCount` and never exceeds `totalCount`; the page
 * rejects a reply where that does not hold.
 */
export interface SiteControlCapturedWorkoutImportStatusResult {
  operationId: string;
  contextId: string;
  state: CapturedImportState;
  totalCount: number;
  processedCount: number;
  importedCount: number;
  alreadyPresentCount: number;
  failedCount: number;
  blockedReason?: CapturedImportBlockedReason;
  errors: SiteControlCapturedImportError[];
  startedAt: number;
  updatedAt: number;
}

/** Maps each request type to its payload shape. */
export interface SiteControlPayloadMap {
  PING: SiteControlPingPayload;
  GET_LIBRARIES: SiteControlGetLibrariesPayload;
  GET_LIBRARY_ITEMS: SiteControlGetLibraryItemsPayload;
  GET_TRAINING_PLANS: SiteControlGetTrainingPlansPayload;
  GET_TRAINING_PLAN_LIBRARIES: SiteControlGetTrainingPlanLibrariesPayload;
  GET_PLAN_CONTENTS: SiteControlGetPlanContentsPayload;
  GET_ATHLETE_GROUPS: SiteControlGetAthleteGroupsPayload;
  OPEN_IMPORTER: SiteControlOpenImporterPayload;
  GET_CAPTURED_WORKOUT_SUMMARY: SiteControlGetCapturedWorkoutSummaryPayload;
  IMPORT_MISSING_WORKOUTS: SiteControlImportMissingWorkoutsPayload;
  GET_CAPTURED_WORKOUT_IMPORT_STATUS: SiteControlGetCapturedWorkoutImportStatusPayload;
}

/**
 * A request envelope posted by the page.
 *
 * `requestId` is generated by the page and echoed verbatim so concurrent
 * requests can be correlated. The extension treats it as an opaque string.
 */
export interface SiteControlRequestEnvelope<T extends SiteControlRequestType> {
  source: typeof SITE_CONTROL_PAGE_SOURCE;
  version: number;
  requestId: string;
  type: T;
  payload: SiteControlPayloadMap[T];
}

/**
 * Discriminated union over `type`, so narrowing a request in a `switch` also
 * narrows its payload.
 */
export type SiteControlRequest = {
  [T in SiteControlRequestType]: SiteControlRequestEnvelope<T>;
}[SiteControlRequestType];

/**
 * Error codes returned to the page.
 *
 * `FORBIDDEN_ORIGIN` exists for completeness of the internal contract only:
 * a non-allowlisted origin is answered with silence, never with this code, so
 * an arbitrary site cannot use the channel to detect the extension.
 */
export type SiteControlErrorCode =
  | 'INVALID_REQUEST'
  | 'UNSUPPORTED_REQUEST_TYPE'
  | 'UNSUPPORTED_VERSION'
  | 'FORBIDDEN_ORIGIN'
  | 'AUTH_REQUIRED'
  | 'API_ERROR'
  | 'INTERNAL_ERROR';

export interface SiteControlError {
  code: SiteControlErrorCode;
  message: string;
}

export interface SiteControlSuccessResponse<TData = unknown> {
  source: typeof SITE_CONTROL_EXTENSION_SOURCE;
  version: number;
  requestId: string;
  ok: true;
  data: TData;
}

export interface SiteControlErrorResponse {
  source: typeof SITE_CONTROL_EXTENSION_SOURCE;
  version: number;
  requestId: string;
  ok: false;
  error: SiteControlError;
}

export type SiteControlResponse<TData = unknown> =
  | SiteControlSuccessResponse<TData>
  | SiteControlErrorResponse;

/**
 * `PING` result.
 *
 * Reports readiness only. Adding any field derived from a token or key to this
 * interface would violate the credential rule above.
 */
export interface SiteControlPingResult {
  protocolVersion: number;
  extensionVersion: string;
  /**
   * Request types this build actually serves.
   *
   * Additive within a protocol version, so the page feature-detects with
   * `supports?.includes(...)` rather than comparing versions. Older builds omit
   * the field entirely, which reads as "does not support it" — the correct
   * answer for every type added after them.
   */
  supports: SiteControlRequestType[];
  trainingPeaks: { authenticated: boolean };
  planMyPeak: {
    /**
     * Whether a PlanMyPeak credential is stored.
     *
     * Asymmetric on purpose: `false` is reliable (nothing can be written),
     * `true` only means a token exists — it may be expired, revoked, or issued
     * to a different coach. Never read it as a guarantee that a write will
     * land, or that it will land in the expected account.
     */
    authenticated: boolean;
    /**
     * Opaque id of the PlanMyPeak coach the extension is acting as, or `null`
     * when it could not be resolved.
     *
     * The extension's PlanMyPeak session and the page's are independent and can
     * belong to different coaches — a real case on shared or agency machines.
     * The page compares this against its own signed-in
     * coach and refuses the import when they differ, which is the only way to
     * catch a wrong-account write: everything downstream is scoped to the
     * token's coach, so the write would otherwise succeed silently into the
     * wrong account.
     *
     * `null` means unknown, not "matches" — a page gating on this must
     * fail closed.
     *
     * An account id is not a credential: it identifies whose data is in play
     * and cannot be used to authenticate. No token or key is exposed here.
     */
    coachId: string | null;
  };
}

/**
 * `GET_PLAN_CONTENTS` result — the four plan legs the page always needs
 * together, fetched in one round trip.
 */
export interface SiteControlPlanContentsResult {
  planId: number;
  workouts: PlanWorkout[];
  notes: CalendarNote[];
  events: CalendarEvent[];
  rxWorkouts: RxBuilderWorkout[];
}

export interface SiteControlOpenImporterResult {
  /** True when the overlay was mounted or an existing one was focused */
  opened: boolean;
  /** True when an already-open overlay was focused instead of remounted */
  focused: boolean;
}

/** Maps each request type to its success payload. */
export interface SiteControlResultMap {
  PING: SiteControlPingResult;
  GET_LIBRARIES: Library[];
  GET_LIBRARY_ITEMS: LibraryItem[];
  GET_TRAINING_PLANS: TrainingPlan[];
  GET_TRAINING_PLAN_LIBRARIES: SiteControlTrainingPlanLibrary[];
  GET_PLAN_CONTENTS: SiteControlPlanContentsResult;
  GET_ATHLETE_GROUPS: AthleteGroup[];
  OPEN_IMPORTER: SiteControlOpenImporterResult;
  GET_CAPTURED_WORKOUT_SUMMARY: SiteControlCapturedWorkoutSummaryResult;
  IMPORT_MISSING_WORKOUTS: SiteControlImportMissingWorkoutsResult;
  GET_CAPTURED_WORKOUT_IMPORT_STATUS: SiteControlCapturedWorkoutImportStatusResult;
}

/**
 * Extension -> page notification emitted when an import the page requested
 * finishes. Carries counts only, never credential material.
 */
export const SITE_CONTROL_IMPORT_COMPLETED = 'IMPORT_COMPLETED';

/**
 * Imported and failed counts for one kind of thing.
 *
 * `imported` is in that kind's own natural unit — workouts for libraries and
 * plans, groups for groups. `failed` counts failed *containers*: a library of
 * fifty workouts that fails entirely is one failure, not fifty.
 */
export interface SiteControlImportKindCounts {
  imported: number;
  failed: number;
}

/**
 * Per-kind breakdown of an import.
 *
 * `importedCount` alone cannot be rendered honestly when a coach selected more
 * than one kind: it sums workouts and groups into a total in no unit at all.
 * A mixed selection is two clicks from any single-kind `OPEN_IMPORTER`, since
 * the overlay's tabs stay switchable and the selection accumulates across them,
 * so this is a reachable state rather than a theoretical one.
 */
export interface SiteControlImportByKind {
  libraries: SiteControlImportKindCounts;
  plans: SiteControlImportKindCounts;
  groups: SiteControlImportKindCounts;
}

export interface SiteControlImportCompletedPayload {
  ok: boolean;
  /**
   * Total across every kind. Kept unchanged for compatibility, but note it is
   * only meaningful when a single kind was imported — prefer `byKind` when the
   * selection could have spanned more than one.
   */
  importedCount: number;
  /** Failed containers across every kind — libraries, plans, and the groups batch. */
  failedCount: number;
  /** Additive: absent on builds older than this field. */
  byKind: SiteControlImportByKind;
}

export interface SiteControlImportCompletedEvent {
  source: typeof SITE_CONTROL_EXTENSION_SOURCE;
  version: number;
  type: typeof SITE_CONTROL_IMPORT_COMPLETED;
  /** The `OPEN_IMPORTER` request that started this import */
  requestId: string;
  payload: SiteControlImportCompletedPayload;
}
