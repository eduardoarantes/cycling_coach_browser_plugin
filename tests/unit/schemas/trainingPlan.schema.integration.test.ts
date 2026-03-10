/**
 * Training plan schema integration tests
 * Tests schemas against representative API response shapes
 */

import { describe, it, expect } from 'vitest';
import {
  TrainingPlansApiResponseSchema,
  PlanWorkoutsApiResponseSchema,
  CalendarNotesApiResponseSchema,
  CalendarEventsApiResponseSchema,
} from '@/schemas/trainingPlan.schema';

const trainingPlansFixture = [
  {
    planAccess: {
      planAccessId: 0,
      personId: 1001,
      planId: 7001,
      accessFromPayment: false,
      accessFromShare: false,
      grantedFromPersonId: 1001,
      planAccessType: 2,
    },
    planId: 7001,
    planPersonId: 2001,
    ownerPersonId: 1001,
    createdOn: '2026-03-10T09:00:00',
    title: 'Base Bike Plan',
    author: 'Coach Example',
    planEmail: 'coach@example.com',
    planLanguage: 'en',
    dayCount: 21,
    weekCount: 3,
    startDate: '2026-03-16T00:00:00',
    endDate: '2026-04-05T00:00:00',
    workoutCount: 6,
    eventCount: 1,
    description: 'Build endurance',
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
  {
    planAccess: {
      planAccessId: 0,
      personId: 1001,
      planId: 7002,
      accessFromPayment: false,
      accessFromShare: false,
      grantedFromPersonId: 1001,
      planAccessType: 2,
    },
    planId: 7002,
    planPersonId: 2002,
    ownerPersonId: 1001,
    createdOn: '2026-03-10T10:00:00',
    title: 'Run Build',
    author: 'Coach Example',
    planEmail: 'coach@example.com',
    planLanguage: null,
    dayCount: 14,
    weekCount: 2,
    startDate: '2026-03-18T00:00:00',
    endDate: '2026-03-31T00:00:00',
    workoutCount: 4,
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
  },
];

const planWorkoutsFixture = [
  {
    workoutId: 9001,
    athleteId: 1001,
    title: 'Aerobic Ride',
    workoutTypeValueId: 2,
    code: null,
    workoutDay: '2026-03-16T00:00:00',
    startTime: null,
    startTimePlanned: null,
    isItAnOr: false,
    isHidden: false,
    completed: null,
    description: 'Steady endurance ride',
    userTags: null,
    coachComments: 'Keep it conversational',
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
    totalTimePlanned: 5400,
    heartRateMinimum: null,
    heartRateMaximum: null,
    heartRateAverage: null,
    calories: null,
    caloriesPlanned: null,
    tssActual: null,
    tssPlanned: 65,
    tssSource: null,
    if: null,
    ifPlanned: 0.72,
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
    lastModifiedDate: '2026-03-10T09:30:00',
    equipmentBikeId: null,
    equipmentShoeId: null,
    isLocked: false,
    complianceDurationPercent: null,
    complianceDistancePercent: null,
    complianceTssPercent: null,
    rpe: null,
    feeling: null,
    structure: {
      structure: [],
      primaryLengthMetric: 'duration',
      primaryIntensityMetric: 'percentOfFtp',
    },
    orderOnDay: 1,
    personalRecordCount: 0,
    syncedTo: null,
    poolLengthOptionId: null,
    workoutSubTypeId: null,
    workoutDeviceSource: null,
  },
];

const calendarNotesFixture = [
  {
    id: 3001,
    title: 'Week 1 focus',
    description: 'Dial in consistency and avoid chasing intensity.',
    noteDate: '2026-03-16T00:00:00',
    createdDate: '2026-03-10T09:00:00',
    modifiedDate: '2026-03-10T09:15:00',
    planId: 7001,
    attachments: [],
  },
  {
    id: 3002,
    title: 'Recovery reminder',
    description: 'Keep the easy days easy.',
    noteDate: '2026-03-23T00:00:00',
    createdDate: '2026-03-10T09:20:00',
    modifiedDate: '2026-03-10T09:25:00',
    planId: 7001,
    attachments: [],
  },
];

const calendarEventsFixture = [
  {
    id: 4001,
    planId: 7001,
    eventDate: '2026-04-05T00:00:00',
    name: 'Autumn Fondo',
    eventType: 'CyclingRoadRace',
    description: 'Target endurance event',
    comment: null,
    distance: 120,
    distanceUnits: 'kilometer',
    legs: [],
  },
];

describe('TrainingPlan Schema Integration Tests', () => {
  describe('TrainingPlansApiResponseSchema', () => {
    it('should validate representative training plan list responses', () => {
      const result = TrainingPlansApiResponseSchema.parse(trainingPlansFixture);

      expect(result).toBeInstanceOf(Array);
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('planId', 7001);
      expect(result[0]).toHaveProperty('title', 'Base Bike Plan');
      expect(result[1]).toHaveProperty('planId', 7002);
      expect(result[1]).toHaveProperty('title', 'Run Build');
    });
  });

  describe('PlanWorkoutsApiResponseSchema', () => {
    it('should validate representative plan workout responses', () => {
      const result = PlanWorkoutsApiResponseSchema.parse(planWorkoutsFixture);

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('workoutId');
      expect(result[0]).toHaveProperty('athleteId');
      expect(result[0]).toHaveProperty('title');
    });
  });

  describe('CalendarNotesApiResponseSchema', () => {
    it('should validate representative calendar note responses', () => {
      const result = CalendarNotesApiResponseSchema.parse(calendarNotesFixture);

      expect(result).toBeInstanceOf(Array);
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('id', 3001);
      expect(result[0]).toHaveProperty('title', 'Week 1 focus');
      expect(result[1]).toHaveProperty('id', 3002);
      expect(result[1]).toHaveProperty('title', 'Recovery reminder');
    });
  });

  describe('CalendarEventsApiResponseSchema', () => {
    it('should validate representative calendar event responses', () => {
      const result = CalendarEventsApiResponseSchema.parse(
        calendarEventsFixture
      );

      expect(result).toBeInstanceOf(Array);
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('id', 4001);
      expect(result[0]).toHaveProperty('planId', 7001);
      expect(result[0]).toHaveProperty('name', 'Autumn Fondo');
      expect(result[0]).toHaveProperty('eventType', 'CyclingRoadRace');
    });
  });
});
