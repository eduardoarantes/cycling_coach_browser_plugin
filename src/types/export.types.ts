/**
 * Export destination types
 */

export type ExportDestination = 'planmypeak' | 'intervalsicu';

export interface ExportDestinationInfo {
  id: ExportDestination;
  name: string;
  description: string;
  icon?: string;
  available: boolean;
}

export const EXPORT_DESTINATIONS: ExportDestinationInfo[] = [
  {
    id: 'planmypeak',
    name: 'PlanMyPeak',
    description: 'Direct upload to PlanMyPeak workout library via API',
    icon: '🚴',
    available: true,
  },
  {
    id: 'intervalsicu',
    name: 'Intervals.icu',
    description: 'Direct upload to Intervals.icu workout library via API',
    icon: '🚴‍♂️',
    available: true,
  },
];

/**
 * Phase-by-phase progress state rendered by the shared export UI.
 *
 * Lives here rather than alongside the dialog so the export hooks (and the
 * PlanMyPeak import overlay, which runs in a content script) can consume it
 * without depending on popup components.
 */
export interface TrainingPlanExportProgressDialogState {
  overallCurrent: number;
  overallTotal: number;
  currentPhaseLabel: string;
  currentPhaseCurrent: number;
  currentPhaseTotal: number;
  currentItemName?: string;
  message?: string;
  phases: Array<{
    id: string;
    label: string;
    status: 'pending' | 'started' | 'progress' | 'completed' | 'failed';
    current: number;
    total: number;
    itemName?: string;
    message?: string;
  }>;
}
