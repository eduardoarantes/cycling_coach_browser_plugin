/**
 * Training plan schema validation tests
 */

import { describe, it, expect } from 'vitest';
import {
  PlanAccessSchema,
  TrainingPlanSchema,
  TrainingPlansApiResponseSchema,
  PlanWorkoutSchema,
  PlanWorkoutsApiResponseSchema,
  CalendarNoteSchema,
  CalendarNotesApiResponseSchema,
  CalendarEventSchema,
  CalendarEventsApiResponseSchema,
} from '@/schemas/trainingPlan.schema';

describe('PlanAccessSchema', () => {
  it('should validate a complete plan access object', () => {
    const validPlanAccess = {
      planAccessId: 0,
      personId: 6240623,
      planId: 624432,
      accessFromPayment: false,
      accessFromShare: false,
      grantedFromPersonId: 6240623,
      planAccessType: 2,
    };

    const result = PlanAccessSchema.parse(validPlanAccess);
    expect(result).toEqual(validPlanAccess);
  });

  it('should reject plan access missing required fields', () => {
    const invalidPlanAccess = {
      planAccessId: 0,
      personId: 6240623,
    };

    expect(() => PlanAccessSchema.parse(invalidPlanAccess)).toThrow();
  });

  it('should reject plan access with invalid field types', () => {
    const invalidPlanAccess = {
      planAccessId: '0',
      personId: 6240623,
      planId: 624432,
      accessFromPayment: false,
      accessFromShare: false,
      grantedFromPersonId: 6240623,
      planAccessType: 2,
    };

    expect(() => PlanAccessSchema.parse(invalidPlanAccess)).toThrow();
  });

  it('should accept plan access with null grantedFromPersonId', () => {
    const validPlanAccessWithNullGrantedFrom = {
      planAccessId: 0,
      personId: 6240623,
      planId: 624432,
      accessFromPayment: false,
      accessFromShare: false,
      grantedFromPersonId: null,
      planAccessType: 2,
    };

    const result = PlanAccessSchema.parse(validPlanAccessWithNullGrantedFrom);
    expect(result).toEqual(validPlanAccessWithNullGrantedFrom);
    expect(result.grantedFromPersonId).toBeNull();
  });
});

describe('TrainingPlanSchema', () => {
  it('should validate a complete training plan object', () => {
    const validPlan = {
      planAccess: {
        planAccessId: 0,
        personId: 6240623,
        planId: 624432,
        accessFromPayment: false,
        accessFromShare: false,
        grantedFromPersonId: 6240623,
        planAccessType: 2,
      },
      planId: 624432,
      planPersonId: 6240625,
      ownerPersonId: 6240623,
      createdOn: '2026-02-21T01:29:00',
      title: 'Cycling Custom Training Plan',
      author: 'Eduardo ',
      planEmail: 'eduardo@trgs.com.br',
      planLanguage: 'en',
      dayCount: 18,
      weekCount: 3,
      startDate: '2026-02-24T00:00:00',
      endDate: '2026-03-13T00:00:00',
      workoutCount: 8,
      eventCount: 0,
      description: '',
      planCategory: 4,
      subcategory: 6,
      additionalCriteria: [0, 2],
      eventPlan: false,
      eventName: null,
      eventDate: null,
      forceDate: false,
      isDynamic: false,
      isPublic: false,
      isSearchable: false,
      price: null,
      customUrl: 0,
      hasWeeklyGoals: false,
      sampleWeekOne: null,
      sampleWeekTwo: null,
    };

    const result = TrainingPlanSchema.parse(validPlan);
    expect(result).toEqual(validPlan);
  });

  it('should validate plan with null optional fields', () => {
    const planWithNulls = {
      planAccess: {
        planAccessId: 0,
        personId: 6240623,
        planId: 624434,
        accessFromPayment: false,
        accessFromShare: false,
        grantedFromPersonId: 6240623,
        planAccessType: 2,
      },
      planId: 624434,
      planPersonId: 6240629,
      ownerPersonId: 6240623,
      createdOn: '2026-02-21T01:34:00',
      title: 'Run',
      author: 'Eduardo ',
      planEmail: 'eduardo@trgs.com.br',
      planLanguage: null,
      dayCount: 15,
      weekCount: 3,
      startDate: '2026-02-18T00:00:00',
      endDate: '2026-03-04T00:00:00',
      workoutCount: 3,
      eventCount: 0,
      description: null,
      planCategory: 0,
      subcategory: null,
      additionalCriteria: null,
      eventPlan: false,
      eventName: null,
      eventDate: null,
      forceDate: false,
      isDynamic: false,
      isPublic: false,
      isSearchable: false,
      price: null,
      customUrl: 0,
      hasWeeklyGoals: false,
      sampleWeekOne: null,
      sampleWeekTwo: null,
    };

    const result = TrainingPlanSchema.parse(planWithNulls);
    expect(result).toEqual(planWithNulls);
  });

  it('should reject plan missing required fields', () => {
    const invalidPlan = {
      planId: 624432,
      title: 'Cycling Custom Training Plan',
    };

    expect(() => TrainingPlanSchema.parse(invalidPlan)).toThrow();
  });

  it('should reject plan with invalid field types', () => {
    const invalidPlan = {
      planAccess: {
        planAccessId: 0,
        personId: 6240623,
        planId: 624432,
        accessFromPayment: false,
        accessFromShare: false,
        grantedFromPersonId: 6240623,
        planAccessType: 2,
      },
      planId: '624432',
      planPersonId: 6240625,
      ownerPersonId: 6240623,
      createdOn: '2026-02-21T01:29:00',
      title: 'Cycling Custom Training Plan',
      author: 'Eduardo ',
      planEmail: 'eduardo@trgs.com.br',
      planLanguage: 'en',
      dayCount: 18,
      weekCount: 3,
      startDate: '2026-02-24T00:00:00',
      endDate: '2026-03-13T00:00:00',
      workoutCount: 8,
      eventCount: 0,
      description: '',
      planCategory: 4,
      subcategory: 6,
      additionalCriteria: [0, 2],
      eventPlan: false,
      eventName: null,
      eventDate: null,
      forceDate: false,
      isDynamic: false,
      isPublic: false,
      isSearchable: false,
      price: null,
      customUrl: 0,
      hasWeeklyGoals: false,
      sampleWeekOne: null,
      sampleWeekTwo: null,
    };

    expect(() => TrainingPlanSchema.parse(invalidPlan)).toThrow();
  });
});

describe('TrainingPlansApiResponseSchema', () => {
  it('should validate array of training plans', () => {
    const validResponse = [
      {
        planAccess: {
          planAccessId: 0,
          personId: 6240623,
          planId: 624432,
          accessFromPayment: false,
          accessFromShare: false,
          grantedFromPersonId: 6240623,
          planAccessType: 2,
        },
        planId: 624432,
        planPersonId: 6240625,
        ownerPersonId: 6240623,
        createdOn: '2026-02-21T01:29:00',
        title: 'Cycling Custom Training Plan',
        author: 'Eduardo ',
        planEmail: 'eduardo@trgs.com.br',
        planLanguage: 'en',
        dayCount: 18,
        weekCount: 3,
        startDate: '2026-02-24T00:00:00',
        endDate: '2026-03-13T00:00:00',
        workoutCount: 8,
        eventCount: 0,
        description: '',
        planCategory: 4,
        subcategory: 6,
        additionalCriteria: [0, 2],
        eventPlan: false,
        eventName: null,
        eventDate: null,
        forceDate: false,
        isDynamic: false,
        isPublic: false,
        isSearchable: false,
        price: null,
        customUrl: 0,
        hasWeeklyGoals: false,
        sampleWeekOne: null,
        sampleWeekTwo: null,
      },
    ];

    const result = TrainingPlansApiResponseSchema.parse(validResponse);
    expect(result).toEqual(validResponse);
    expect(result).toHaveLength(1);
  });

  it('should validate empty array', () => {
    const emptyResponse: unknown[] = [];

    const result = TrainingPlansApiResponseSchema.parse(emptyResponse);
    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });

  it('should reject non-array response', () => {
    const invalidResponse = {
      plans: [],
    };

    expect(() =>
      TrainingPlansApiResponseSchema.parse(invalidResponse)
    ).toThrow();
  });
});

describe('PlanWorkoutSchema', () => {
  it('should validate a complete plan workout object', () => {
    const validWorkout = {
      workoutId: 3590646085,
      athleteId: 6240625,
      title: 'Swim 1',
      workoutTypeValueId: 1,
      code: null,
      workoutDay: '2026-02-24T00:00:00',
      startTime: null,
      startTimePlanned: null,
      isItAnOr: false,
      isHidden: null,
      completed: null,
      description: null,
      userTags: null,
      coachComments: null,
      workoutComments: null,
      newComment: null,
      hasPrivateWorkoutNoteForCaller: false,
      publicSettingValue: 0,
      sharedWorkoutInformationKey: null,
      sharedWorkoutInformationExpireKey: null,
      distance: null,
      distancePlanned: 1000.0,
      distanceCustomized: null,
      distanceUnitsCustomized: null,
      totalTime: null,
      totalTimePlanned: null,
      heartRateMinimum: null,
      heartRateMaximum: null,
      heartRateAverage: null,
      calories: null,
      caloriesPlanned: null,
      tssActual: null,
      tssPlanned: null,
      tssSource: null,
      if: null,
      ifPlanned: null,
      velocityAverage: null,
      velocityPlanned: null,
      velocityMaximum: null,
      normalizedSpeedActual: null,
      normalizedPowerActual: null,
      powerAverage: null,
      powerMaximum: null,
      energy: null,
      energyPlanned: null,
      elevationGain: null,
      elevationGainPlanned: null,
      elevationLoss: null,
      elevationMinimum: null,
      elevationAverage: null,
      elevationMaximum: null,
      torqueAverage: null,
      torqueMaximum: null,
      tempMin: null,
      tempAvg: null,
      tempMax: null,
      cadenceAverage: null,
      cadenceMaximum: null,
      lastModifiedDate: '2026-02-21T01:30:07',
      equipmentBikeId: null,
      equipmentShoeId: null,
      isLocked: null,
      complianceDurationPercent: null,
      complianceDistancePercent: null,
      complianceTssPercent: null,
      rpe: null,
      feeling: null,
      structure: {
        structure: [],
        primaryLengthMetric: 'distance',
        primaryIntensityMetric: 'percentOfThresholdPace',
      },
      orderOnDay: 1,
      personalRecordCount: null,
      syncedTo: null,
      poolLengthOptionId: null,
      workoutSubTypeId: null,
      workoutDeviceSource: null,
    };

    const result = PlanWorkoutSchema.parse(validWorkout);
    expect(result).toEqual(validWorkout);
  });

  it('should handle workout with all null optional fields', () => {
    const minimalWorkout = {
      workoutId: 3590646085,
      athleteId: 6240625,
      title: 'Swim 1',
      workoutTypeValueId: 1,
      code: null,
      workoutDay: '2026-02-24T00:00:00',
      startTime: null,
      startTimePlanned: null,
      isItAnOr: false,
      isHidden: null,
      completed: null,
      description: null,
      userTags: null,
      coachComments: null,
      workoutComments: null,
      newComment: null,
      hasPrivateWorkoutNoteForCaller: false,
      publicSettingValue: 0,
      sharedWorkoutInformationKey: null,
      sharedWorkoutInformationExpireKey: null,
      distance: null,
      distancePlanned: null,
      distanceCustomized: null,
      distanceUnitsCustomized: null,
      totalTime: null,
      totalTimePlanned: null,
      heartRateMinimum: null,
      heartRateMaximum: null,
      heartRateAverage: null,
      calories: null,
      caloriesPlanned: null,
      tssActual: null,
      tssPlanned: null,
      tssSource: null,
      if: null,
      ifPlanned: null,
      velocityAverage: null,
      velocityPlanned: null,
      velocityMaximum: null,
      normalizedSpeedActual: null,
      normalizedPowerActual: null,
      powerAverage: null,
      powerMaximum: null,
      energy: null,
      energyPlanned: null,
      elevationGain: null,
      elevationGainPlanned: null,
      elevationLoss: null,
      elevationMinimum: null,
      elevationAverage: null,
      elevationMaximum: null,
      torqueAverage: null,
      torqueMaximum: null,
      tempMin: null,
      tempAvg: null,
      tempMax: null,
      cadenceAverage: null,
      cadenceMaximum: null,
      lastModifiedDate: '2026-02-21T01:30:07',
      equipmentBikeId: null,
      equipmentShoeId: null,
      isLocked: null,
      complianceDurationPercent: null,
      complianceDistancePercent: null,
      complianceTssPercent: null,
      rpe: null,
      feeling: null,
      structure: null,
      orderOnDay: 1,
      personalRecordCount: null,
      syncedTo: null,
      poolLengthOptionId: null,
      workoutSubTypeId: null,
      workoutDeviceSource: null,
    };

    const result = PlanWorkoutSchema.parse(minimalWorkout);
    expect(result).toEqual(minimalWorkout);
  });

  it('should reject workout missing required fields', () => {
    const invalidWorkout = {
      workoutId: 3590646085,
      title: 'Swim 1',
    };

    expect(() => PlanWorkoutSchema.parse(invalidWorkout)).toThrow();
  });

  it('should reject workout with invalid field types', () => {
    const invalidWorkout = {
      workoutId: '3590646085',
      athleteId: 6240625,
      title: 'Swim 1',
      workoutTypeValueId: 1,
      code: null,
      workoutDay: '2026-02-24T00:00:00',
      startTime: null,
      startTimePlanned: null,
      isItAnOr: false,
      isHidden: null,
      completed: null,
      description: null,
      userTags: null,
      coachComments: null,
      workoutComments: null,
      newComment: null,
      hasPrivateWorkoutNoteForCaller: false,
      publicSettingValue: 0,
      sharedWorkoutInformationKey: null,
      sharedWorkoutInformationExpireKey: null,
      distance: null,
      distancePlanned: null,
      distanceCustomized: null,
      distanceUnitsCustomized: null,
      totalTime: null,
      totalTimePlanned: null,
      heartRateMinimum: null,
      heartRateMaximum: null,
      heartRateAverage: null,
      calories: null,
      caloriesPlanned: null,
      tssActual: null,
      tssPlanned: null,
      tssSource: null,
      if: null,
      ifPlanned: null,
      velocityAverage: null,
      velocityPlanned: null,
      velocityMaximum: null,
      normalizedSpeedActual: null,
      normalizedPowerActual: null,
      powerAverage: null,
      powerMaximum: null,
      energy: null,
      energyPlanned: null,
      elevationGain: null,
      elevationGainPlanned: null,
      elevationLoss: null,
      elevationMinimum: null,
      elevationAverage: null,
      elevationMaximum: null,
      torqueAverage: null,
      torqueMaximum: null,
      tempMin: null,
      tempAvg: null,
      tempMax: null,
      cadenceAverage: null,
      cadenceMaximum: null,
      lastModifiedDate: '2026-02-21T01:30:07',
      equipmentBikeId: null,
      equipmentShoeId: null,
      isLocked: null,
      complianceDurationPercent: null,
      complianceDistancePercent: null,
      complianceTssPercent: null,
      rpe: null,
      feeling: null,
      structure: null,
      orderOnDay: 1,
      personalRecordCount: null,
      syncedTo: null,
      poolLengthOptionId: null,
      workoutSubTypeId: null,
      workoutDeviceSource: null,
    };

    expect(() => PlanWorkoutSchema.parse(invalidWorkout)).toThrow();
  });
});

describe('PlanWorkoutsApiResponseSchema', () => {
  it('should validate array of plan workouts', () => {
    const validResponse = [
      {
        workoutId: 3590646085,
        athleteId: 6240625,
        title: 'Swim 1',
        workoutTypeValueId: 1,
        code: null,
        workoutDay: '2026-02-24T00:00:00',
        startTime: null,
        startTimePlanned: null,
        isItAnOr: false,
        isHidden: null,
        completed: null,
        description: null,
        userTags: null,
        coachComments: null,
        workoutComments: null,
        newComment: null,
        hasPrivateWorkoutNoteForCaller: false,
        publicSettingValue: 0,
        sharedWorkoutInformationKey: null,
        sharedWorkoutInformationExpireKey: null,
        distance: null,
        distancePlanned: 1000.0,
        distanceCustomized: null,
        distanceUnitsCustomized: null,
        totalTime: null,
        totalTimePlanned: null,
        heartRateMinimum: null,
        heartRateMaximum: null,
        heartRateAverage: null,
        calories: null,
        caloriesPlanned: null,
        tssActual: null,
        tssPlanned: null,
        tssSource: null,
        if: null,
        ifPlanned: null,
        velocityAverage: null,
        velocityPlanned: null,
        velocityMaximum: null,
        normalizedSpeedActual: null,
        normalizedPowerActual: null,
        powerAverage: null,
        powerMaximum: null,
        energy: null,
        energyPlanned: null,
        elevationGain: null,
        elevationGainPlanned: null,
        elevationLoss: null,
        elevationMinimum: null,
        elevationAverage: null,
        elevationMaximum: null,
        torqueAverage: null,
        torqueMaximum: null,
        tempMin: null,
        tempAvg: null,
        tempMax: null,
        cadenceAverage: null,
        cadenceMaximum: null,
        lastModifiedDate: '2026-02-21T01:30:07',
        equipmentBikeId: null,
        equipmentShoeId: null,
        isLocked: null,
        complianceDurationPercent: null,
        complianceDistancePercent: null,
        complianceTssPercent: null,
        rpe: null,
        feeling: null,
        structure: null,
        orderOnDay: 1,
        personalRecordCount: null,
        syncedTo: null,
        poolLengthOptionId: null,
        workoutSubTypeId: null,
        workoutDeviceSource: null,
      },
    ];

    const result = PlanWorkoutsApiResponseSchema.parse(validResponse);
    expect(result).toEqual(validResponse);
    expect(result).toHaveLength(1);
  });

  it('should validate empty array of workouts', () => {
    const emptyResponse: unknown[] = [];

    const result = PlanWorkoutsApiResponseSchema.parse(emptyResponse);
    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });

  it('should reject non-array response', () => {
    const invalidResponse = {
      workouts: [],
    };

    expect(() =>
      PlanWorkoutsApiResponseSchema.parse(invalidResponse)
    ).toThrow();
  });
});

describe('CalendarNoteSchema', () => {
  it('should validate a complete calendar note object', () => {
    const validNote = {
      id: 2139935,
      title: 'Week 2 starting',
      description: '',
      noteDate: '2026-03-03T00:00:00',
      createdDate: '2026-02-21T08:30:52',
      modifiedDate: '2026-02-21T08:30:52',
      planId: 624432,
      attachments: [],
    };

    const result = CalendarNoteSchema.parse(validNote);
    expect(result).toEqual(validNote);
  });

  it('should validate note with non-empty description', () => {
    const noteWithDescription = {
      id: 2140470,
      title: 'This is the second Note',
      description: 'with description',
      noteDate: '2026-03-15T00:00:00',
      createdDate: '2026-02-21T22:03:54',
      modifiedDate: '2026-02-21T22:03:54',
      planId: 624432,
      attachments: [],
    };

    const result = CalendarNoteSchema.parse(noteWithDescription);
    expect(result).toEqual(noteWithDescription);
  });

  it('should reject note missing required fields', () => {
    const invalidNote = {
      id: 2139935,
      title: 'Week 2 starting',
    };

    expect(() => CalendarNoteSchema.parse(invalidNote)).toThrow();
  });

  it('should reject note with invalid field types', () => {
    const invalidNote = {
      id: '2139935',
      title: 'Week 2 starting',
      description: '',
      noteDate: '2026-03-03T00:00:00',
      createdDate: '2026-02-21T08:30:52',
      modifiedDate: '2026-02-21T08:30:52',
      planId: 624432,
      attachments: [],
    };

    expect(() => CalendarNoteSchema.parse(invalidNote)).toThrow();
  });
});

describe('CalendarNotesApiResponseSchema', () => {
  it('should validate array of calendar notes', () => {
    const validResponse = [
      {
        id: 2139935,
        title: 'Week 2 starting',
        description: '',
        noteDate: '2026-03-03T00:00:00',
        createdDate: '2026-02-21T08:30:52',
        modifiedDate: '2026-02-21T08:30:52',
        planId: 624432,
        attachments: [],
      },
      {
        id: 2140470,
        title: 'This is the second Note',
        description: 'with description',
        noteDate: '2026-03-15T00:00:00',
        createdDate: '2026-02-21T22:03:54',
        modifiedDate: '2026-02-21T22:03:54',
        planId: 624432,
        attachments: [],
      },
    ];

    const result = CalendarNotesApiResponseSchema.parse(validResponse);
    expect(result).toEqual(validResponse);
    expect(result).toHaveLength(2);
  });

  it('should validate empty array of notes', () => {
    const emptyResponse: unknown[] = [];

    const result = CalendarNotesApiResponseSchema.parse(emptyResponse);
    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });

  it('should reject non-array response', () => {
    const invalidResponse = {
      notes: [],
    };

    expect(() =>
      CalendarNotesApiResponseSchema.parse(invalidResponse)
    ).toThrow();
  });
});

describe('CalendarEventSchema', () => {
  it('should validate a complete calendar event object', () => {
    const validEvent = {
      id: 560805,
      planId: 624432,
      eventDate: '2026-03-14T00:00:00',
      name: 'Husky',
      eventType: 'MultisportTriathlon',
      description: 'with description',
      comment: null,
      distance: null,
      distanceUnits: null,
      legs: [],
    };

    const result = CalendarEventSchema.parse(validEvent);
    expect(result).toEqual(validEvent);
  });

  it('should validate event with null optional fields', () => {
    const eventWithNulls = {
      id: 560805,
      planId: 624432,
      eventDate: '2026-03-14T00:00:00',
      name: 'Husky',
      eventType: 'MultisportTriathlon',
      description: null,
      comment: null,
      distance: null,
      distanceUnits: null,
      legs: [],
    };

    const result = CalendarEventSchema.parse(eventWithNulls);
    expect(result).toEqual(eventWithNulls);
  });

  it('should reject event missing required fields', () => {
    const invalidEvent = {
      id: 560805,
      name: 'Husky',
    };

    expect(() => CalendarEventSchema.parse(invalidEvent)).toThrow();
  });

  it('should reject event with invalid field types', () => {
    const invalidEvent = {
      id: '560805',
      planId: 624432,
      eventDate: '2026-03-14T00:00:00',
      name: 'Husky',
      eventType: 'MultisportTriathlon',
      description: 'with description',
      comment: null,
      distance: null,
      distanceUnits: null,
      legs: [],
    };

    expect(() => CalendarEventSchema.parse(invalidEvent)).toThrow();
  });
});

describe('CalendarEventsApiResponseSchema', () => {
  it('should validate array of calendar events', () => {
    const validResponse = [
      {
        id: 560805,
        planId: 624432,
        eventDate: '2026-03-14T00:00:00',
        name: 'Husky',
        eventType: 'MultisportTriathlon',
        description: 'with description',
        comment: null,
        distance: null,
        distanceUnits: null,
        legs: [],
      },
    ];

    const result = CalendarEventsApiResponseSchema.parse(validResponse);
    expect(result).toEqual(validResponse);
    expect(result).toHaveLength(1);
  });

  it('should validate empty array of events', () => {
    const emptyResponse: unknown[] = [];

    const result = CalendarEventsApiResponseSchema.parse(emptyResponse);
    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });

  it('should reject non-array response', () => {
    const invalidResponse = {
      events: [],
    };

    expect(() =>
      CalendarEventsApiResponseSchema.parse(invalidResponse)
    ).toThrow();
  });
});
