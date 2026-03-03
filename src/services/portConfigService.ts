/**
 * Port configuration service for local PlanMyPeak development
 *
 * Manages configurable ports for local development builds.
 * In production builds, this service returns fixed production URLs.
 */

import {
  STORAGE_KEYS,
  DEFAULT_PLANMYPEAK_APP_PORT,
  DEFAULT_PLANMYPEAK_SUPABASE_PORT,
  IS_LOCAL_PLANMYPEAK_TARGET,
} from '@/utils/constants';

export interface PortConfig {
  appPort: number;
  supabasePort: number;
}

/**
 * Get the configured PlanMyPeak app port
 * Returns default if not configured or in production mode
 */
export async function getAppPort(): Promise<number> {
  if (!IS_LOCAL_PLANMYPEAK_TARGET) {
    return DEFAULT_PLANMYPEAK_APP_PORT;
  }

  const data = await chrome.storage.local.get(STORAGE_KEYS.PLANMYPEAK_APP_PORT);
  const port = data[STORAGE_KEYS.PLANMYPEAK_APP_PORT];

  if (typeof port === 'number' && port > 0 && port < 65536) {
    return port;
  }

  return DEFAULT_PLANMYPEAK_APP_PORT;
}

/**
 * Get the configured Supabase port
 * Returns default if not configured or in production mode
 */
export async function getSupabasePort(): Promise<number> {
  if (!IS_LOCAL_PLANMYPEAK_TARGET) {
    return DEFAULT_PLANMYPEAK_SUPABASE_PORT;
  }

  const data = await chrome.storage.local.get(
    STORAGE_KEYS.PLANMYPEAK_SUPABASE_PORT
  );
  const port = data[STORAGE_KEYS.PLANMYPEAK_SUPABASE_PORT];

  if (typeof port === 'number' && port > 0 && port < 65536) {
    return port;
  }

  return DEFAULT_PLANMYPEAK_SUPABASE_PORT;
}

/**
 * Get both configured ports
 */
export async function getPortConfig(): Promise<PortConfig> {
  const [appPort, supabasePort] = await Promise.all([
    getAppPort(),
    getSupabasePort(),
  ]);

  return { appPort, supabasePort };
}

/**
 * Set the PlanMyPeak app port
 * Only effective in local development builds
 */
export async function setAppPort(port: number): Promise<void> {
  if (!IS_LOCAL_PLANMYPEAK_TARGET) {
    return;
  }

  if (typeof port !== 'number' || port <= 0 || port >= 65536) {
    throw new Error('Invalid port number');
  }

  await chrome.storage.local.set({
    [STORAGE_KEYS.PLANMYPEAK_APP_PORT]: port,
  });
}

/**
 * Set the Supabase port
 * Only effective in local development builds
 */
export async function setSupabasePort(port: number): Promise<void> {
  if (!IS_LOCAL_PLANMYPEAK_TARGET) {
    return;
  }

  if (typeof port !== 'number' || port <= 0 || port >= 65536) {
    throw new Error('Invalid port number');
  }

  await chrome.storage.local.set({
    [STORAGE_KEYS.PLANMYPEAK_SUPABASE_PORT]: port,
  });
}

/**
 * Set both ports at once
 * Only effective in local development builds
 */
export async function setPortConfig(config: PortConfig): Promise<void> {
  if (!IS_LOCAL_PLANMYPEAK_TARGET) {
    return;
  }

  await Promise.all([
    setAppPort(config.appPort),
    setSupabasePort(config.supabasePort),
  ]);
}

/**
 * Reset ports to defaults
 */
export async function resetPortConfig(): Promise<void> {
  await chrome.storage.local.remove([
    STORAGE_KEYS.PLANMYPEAK_APP_PORT,
    STORAGE_KEYS.PLANMYPEAK_SUPABASE_PORT,
  ]);
}

/**
 * Get the PlanMyPeak app base URL using configured port
 * In production, returns the production URL
 */
export async function getPlanMyPeakAppUrl(): Promise<string> {
  if (!IS_LOCAL_PLANMYPEAK_TARGET) {
    return 'https://planmypeak.com';
  }

  const port = await getAppPort();
  return `http://localhost:${port}`;
}

/**
 * Get the PlanMyPeak API base URL using configured port
 * In production, returns the production URL
 */
export async function getPlanMyPeakApiUrl(): Promise<string> {
  const appUrl = await getPlanMyPeakAppUrl();
  return `${appUrl}/api`;
}

/**
 * Get the Supabase base URL using configured port
 * In production, returns the cloud Supabase URL
 */
export async function getSupabaseUrl(): Promise<string> {
  if (!IS_LOCAL_PLANMYPEAK_TARGET) {
    return 'https://yqaskiwzyhhovthbvmqq.supabase.co';
  }

  const port = await getSupabasePort();
  return `http://127.0.0.1:${port}`;
}

/**
 * Get the host label for UI display
 */
export async function getHostLabel(): Promise<string> {
  if (!IS_LOCAL_PLANMYPEAK_TARGET) {
    return 'planmypeak.com';
  }

  const port = await getAppPort();
  return `localhost:${port}`;
}
