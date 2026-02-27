# PlanMyPeak Training Plan Export Flow (Issue #93)

Source of truth: `PlanMyPeak/workouts-openapi.yaml`

Scope for this flow:

- Include training plan creation and optional note creation.
- Do not schedule plan instances.

```mermaid
flowchart TD
    A[User exports one or more TP training plans to PlanMyPeak] --> B[Load TP plan workouts and notes]
    B --> C[Normalize TP workouts to PlanMyPeak workout payload shape]
    C --> D[Compute canonical structure hash SHA-256]
    D --> E[Assign source id using TP sha256 hash]
    E --> F[Deduplicate across all selected plans by source_id]

    F --> G[Resolve or create shared PlanMyPeak workout library]
    G --> G1[Use library source id TP:PLAN_WORKOUTS_V1]
    G1 --> H[Check existing workouts by source id]

    H --> I{Workout already exists?}
    I -- Yes --> J[Reuse existing workout id]
    I -- No --> K[Create missing workout in PlanMyPeak library]
    K --> L[Capture created workout id]
    J --> M[Build map from source id to PlanMyPeak workout id]
    L --> M

    M --> N[Build CreateTrainingPlanRequest]
    N --> O[Map TP day/order to week.workouts day arrays]
    O --> P[Set workoutKey from source_id->id map]
    P --> Q[Create training plan in PlanMyPeak]

    Q --> R{Export TP notes too?}
    R -- No --> U[Return success: plan created]
    R -- Yes --> S[Create notes for the new training plan]
    S --> T[Return success: plan + notes created]

    U --> V[Done]
    T --> V

    W[Out of scope in Issue #93: plan scheduling]:::outscope

    classDef outscope fill:#f5f5f5,stroke:#999,stroke-dasharray: 4 4,color:#666;
```

## Endpoint groups used

- Workouts/libraries: `/api/v1/workouts/*`
- Training plans/notes: `/api/training-plans*`

## Key implementation rule

- Dedup key is `source_id` with format `TP:{sha256_of_workout_structure}`.
- Shared import library key is `source_id = TP:PLAN_WORKOUTS_V1`.
