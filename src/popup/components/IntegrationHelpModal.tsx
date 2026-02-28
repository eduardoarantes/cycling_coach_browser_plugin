import type { ReactElement } from 'react';

export type IntegrationHelpTopic = 'planmypeak' | 'intervalsicu';

interface HelpSection {
  heading: string;
  items: string[];
}

interface HelpContent {
  title: string;
  intro: string;
  sections: HelpSection[];
}

const HELP_CONTENT: Record<IntegrationHelpTopic, HelpContent> = {
  planmypeak: {
    title: 'PlanMyPeak Import Guide',
    intro:
      'TrainingPeaks data is uploaded directly to PlanMyPeak through the authenticated API. The extension can export both workout libraries and full training plans.',
    sections: [
      {
        heading: 'Workout Libraries',
        items: [
          'The extension exports TrainingPeaks workouts into the PlanMyPeak. It creates a matching library. If the matching library already exists, you can:',
          'Choose "Append", PlanMyPeak keeps the current library and upload new workouts. It has an algorithm that tries to avoid duplication',
          'Choose "Replace", the extension archives the existing library before recreating it.',
        ],
      },
      {
        heading: 'Training Plans',
        items: [
          'All Workouts in PlanMyPeak must live in a Workout Library. Training Plans only have references to the workout.',
          'TrainingPeaks Plans workouts are converted into a shared PlanMyPeak workout library first, then the training plan is created from those workout references.',
          'Training plan exports deduplicate by source ID. Existing matching workouts are reused, and an existing training plan with the same source ID is updated instead of duplicated.',
          'Plan notes are also created when TrainingPeaks notes are available.',
        ],
      },
    ],
  },
  intervalsicu: {
    title: 'Intervals.icu Import Guide',
    intro:
      'TrainingPeaks data is uploaded directly to Intervals.icu with your API key. The extension supports library exports and reusable PLAN exports.',
    sections: [
      {
        heading: 'Workout Libraries',
        items: [
          'Library exports create workout templates, not scheduled calendar workouts.',
          'If "Create folder" is enabled, workouts are grouped into a matching Intervals folder. Otherwise they are added directly to your workout library.',
          'Appending to an existing folder may create duplicates because each export posts a new workout template.',
        ],
      },
      {
        heading: 'Training Plans',
        items: [
          'Training plan exports create a reusable PLAN folder and preserve the TrainingPeaks day offsets for workouts.',
          'When available, the export also sends supported strength workouts, plan notes, and event markers.',
          'Choosing "Replace" deletes the matching Intervals folder first. Choosing "Append" reuses the existing folder and may duplicate workouts.',
        ],
      },
    ],
  },
};

interface IntegrationHelpModalProps {
  topic: IntegrationHelpTopic | null;
  onClose: () => void;
}

export function IntegrationHelpModal({
  topic,
  onClose,
}: IntegrationHelpModalProps): ReactElement | null {
  if (!topic) {
    return null;
  }

  const content = HELP_CONTENT[topic];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 px-3 py-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              {content.title}
            </h3>
            <p className="mt-1 text-xs text-slate-600">{content.intro}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
            aria-label="Close integration guide"
            title="Close"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
            >
              <path
                d="M5 5l10 10M15 5L5 15"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div
          className="min-h-0 flex-1 space-y-4 overflow-y-scroll px-4 py-4"
          style={{ scrollbarGutter: 'stable' }}
        >
          {content.sections.map((section) => (
            <section key={section.heading}>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                {section.heading}
              </h4>
              <ul className="mt-2 space-y-2 text-xs leading-5 text-slate-600">
                {section.items.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span
                      className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500"
                      aria-hidden="true"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
