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
    description: 'Export to PlanMyPeak JSON format',
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
