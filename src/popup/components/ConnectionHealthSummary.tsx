import type { ReactElement } from 'react';
import { CONNECTION_HEALTH_MESSAGES } from '@/utils/uiStrings';

export interface ConnectionHealthSummaryProps {
  /**
   * Opens the Settings view. Optional so the summary can still be rendered
   * somewhere with nowhere to navigate to; without it the Settings phrase is
   * shown as plain text rather than as a control that does nothing.
   */
  onOpenSettings?: () => void;
  isTrainingPeaksAuthenticated: boolean;
  isPlanMyPeakEnabled: boolean;
  isPlanMyPeakAuthenticated: boolean;
  isIntervalsEnabled: boolean;
  isIntervalsAuthenticated: boolean;
}

type SummaryStatus = 'green' | 'yellow' | 'red';

function evaluateSummaryStatus(props: ConnectionHealthSummaryProps): {
  status: SummaryStatus;
  authenticatedCount: number;
  enabledCount: number;
} {
  const enabledConnections = [
    {
      id: 'trainingpeaks',
      enabled: true,
      authenticated: props.isTrainingPeaksAuthenticated,
    },
    {
      id: 'planmypeak',
      enabled: props.isPlanMyPeakEnabled,
      authenticated: props.isPlanMyPeakAuthenticated,
    },
    {
      id: 'intervals',
      enabled: props.isIntervalsEnabled,
      authenticated: props.isIntervalsAuthenticated,
    },
  ].filter((connection) => connection.enabled);

  const enabledCount = enabledConnections.length;
  const authenticatedCount = enabledConnections.filter(
    (connection) => connection.authenticated
  ).length;

  if (authenticatedCount === 0) {
    return { status: 'red', authenticatedCount, enabledCount };
  }

  if (authenticatedCount === enabledCount) {
    return { status: 'green', authenticatedCount, enabledCount };
  }

  return { status: 'yellow', authenticatedCount, enabledCount };
}

export function ConnectionHealthSummary(
  props: ConnectionHealthSummaryProps
): ReactElement {
  const { onOpenSettings } = props;
  const { status, authenticatedCount, enabledCount } =
    evaluateSummaryStatus(props);

  const linkTone =
    status === 'green'
      ? 'text-green-900 hover:text-green-950'
      : status === 'yellow'
        ? 'text-yellow-900 hover:text-yellow-950'
        : 'text-red-900 hover:text-red-950';

  const tone =
    status === 'green'
      ? {
          container: 'bg-green-50 border-green-200',
          dot: 'bg-green-500',
          title: 'text-green-900',
          subtitle: 'text-green-800',
          label: CONNECTION_HEALTH_MESSAGES.ALL_AUTHENTICATED,
        }
      : status === 'yellow'
        ? {
            container: 'bg-yellow-50 border-yellow-200',
            dot: 'bg-yellow-500',
            title: 'text-yellow-900',
            subtitle: 'text-yellow-800',
            label: CONNECTION_HEALTH_MESSAGES.SOME_NOT_AUTHENTICATED,
          }
        : {
            container: 'bg-red-50 border-red-200',
            dot: 'bg-red-500',
            title: 'text-red-900',
            subtitle: 'text-red-800',
            label: CONNECTION_HEALTH_MESSAGES.NONE_AUTHENTICATED,
          };

  return (
    <div className={`mb-3 border rounded-lg p-3 ${tone.container}`}>
      <div className="flex items-start gap-2">
        <span
          className={`mt-1 inline-block h-2.5 w-2.5 rounded-full ${tone.dot}`}
          aria-hidden
        />
        <div>
          <p className={`text-sm font-semibold ${tone.title}`}>{tone.label}</p>
          <p className={`text-xs ${tone.subtitle}`}>
            <span>
              {CONNECTION_HEALTH_MESSAGES.authenticatedCount(
                authenticatedCount,
                enabledCount
              )}
            </span>{' '}
            {onOpenSettings ? (
              // A view switch inside the popup, not a destination with a URL,
              // so this is a button styled as a link rather than an anchor.
              <button
                type="button"
                onClick={onOpenSettings}
                className={`underline underline-offset-2 ${linkTone}`}
              >
                {CONNECTION_HEALTH_MESSAGES.MANAGE_SETTINGS_SUFFIX}
              </button>
            ) : (
              <span>{CONNECTION_HEALTH_MESSAGES.MANAGE_SETTINGS_SUFFIX}</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
