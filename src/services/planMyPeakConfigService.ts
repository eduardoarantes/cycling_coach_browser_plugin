/**
 * PlanMyPeak environment configuration service
 *
 * Resolves the active PlanMyPeak environment (production / staging / local)
 * from chrome.storage and exposes the corresponding app URLs. The environment
 * is switchable at runtime via the Settings panel, so a single bundle can be
 * pointed at the portal or at staging without a rebuild.
 *
 * Local is only reachable from local-target builds — see
 * {@link AVAILABLE_PLANMYPEAK_ENVIRONMENTS} — and resolves its port from the
 * Local Dev Ports panel.
 */

import {
  DEFAULT_PLANMYPEAK_ENVIRONMENT,
  PLANMYPEAK_ENVIRONMENTS,
  STORAGE_KEYS,
  isAvailablePlanMyPeakEnvironment,
  type PlanMyPeakEnvironment,
} from '@/utils/constants';
import { getAppPort } from '@/services/portConfigService';

/**
 * Get the configured PlanMyPeak environment.
 *
 * Falls back to the build default when nothing is stored, or when the stored
 * value is not reachable from this build (e.g. a `local` selection left behind
 * by a local build that was later replaced by a production bundle).
 */
export async function getPlanMyPeakEnvironment(): Promise<PlanMyPeakEnvironment> {
  const data = await chrome.storage.local.get(
    STORAGE_KEYS.PLANMYPEAK_ENVIRONMENT
  );
  const value = data[STORAGE_KEYS.PLANMYPEAK_ENVIRONMENT];

  if (typeof value === 'string' && isAvailablePlanMyPeakEnvironment(value)) {
    return value;
  }

  return DEFAULT_PLANMYPEAK_ENVIRONMENT;
}

/**
 * Persist the PlanMyPeak environment selection.
 *
 * @throws Error when the environment is not reachable from this build.
 */
export async function setPlanMyPeakEnvironment(
  environment: PlanMyPeakEnvironment
): Promise<void> {
  if (!isAvailablePlanMyPeakEnvironment(environment)) {
    throw new Error(
      `PlanMyPeak environment "${environment}" is not available in this build`
    );
  }

  await chrome.storage.local.set({
    [STORAGE_KEYS.PLANMYPEAK_ENVIRONMENT]: environment,
  });
}

/**
 * Get the PlanMyPeak app base URL for the active environment.
 * The local environment uses the configured dev app port.
 */
export async function getPlanMyPeakAppUrl(): Promise<string> {
  const environment = await getPlanMyPeakEnvironment();

  if (environment === 'local') {
    const port = await getAppPort();
    return `https://localhost:${port}`;
  }

  return PLANMYPEAK_ENVIRONMENTS[environment].appUrl;
}

/**
 * Get the PlanMyPeak API base URL for the active environment.
 */
export async function getPlanMyPeakApiUrl(): Promise<string> {
  const appUrl = await getPlanMyPeakAppUrl();
  return `${appUrl}/api`;
}

/**
 * Get the host label for UI display (e.g. `staging.app.planmypeak.com`).
 */
export async function getPlanMyPeakHostLabel(): Promise<string> {
  const environment = await getPlanMyPeakEnvironment();

  if (environment === 'local') {
    const port = await getAppPort();
    return `localhost:${port}`;
  }

  return PLANMYPEAK_ENVIRONMENTS[environment].hostLabel;
}
