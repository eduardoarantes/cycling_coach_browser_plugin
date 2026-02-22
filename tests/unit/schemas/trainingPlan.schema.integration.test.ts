/**
 * Training plan schema integration tests
 * Tests schemas against actual API response data
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  TrainingPlansApiResponseSchema,
  PlanWorkoutsApiResponseSchema,
  CalendarNotesApiResponseSchema,
  CalendarEventsApiResponseSchema,
} from '@/schemas/trainingPlan.schema';

describe('TrainingPlan Schema Integration Tests', () => {
  describe('TrainingPlansApiResponseSchema', () => {
    it('should validate actual training_plans_list.json response', () => {
      const filePath = resolve(
        __dirname,
        '../../../TP_API_Responses/training_plans_list.json'
      );
      const fileContent = readFileSync(filePath, 'utf-8');
      const apiResponse = JSON.parse(fileContent);

      const result = TrainingPlansApiResponseSchema.parse(apiResponse);

      expect(result).toBeInstanceOf(Array);
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('planId', 624432);
      expect(result[0]).toHaveProperty('title', 'Cycling Custom Training Plan');
      expect(result[1]).toHaveProperty('planId', 624434);
      expect(result[1]).toHaveProperty('title', 'Run');
    });
  });

  describe('PlanWorkoutsApiResponseSchema', () => {
    it('should validate actual training_plans_workouts_624432.json response', () => {
      const filePath = resolve(
        __dirname,
        '../../../TP_API_Responses/training_plans_workouts_624432.json'
      );
      const fileContent = readFileSync(filePath, 'utf-8');
      const apiResponse = JSON.parse(fileContent);

      const result = PlanWorkoutsApiResponseSchema.parse(apiResponse);

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('workoutId');
      expect(result[0]).toHaveProperty('athleteId');
      expect(result[0]).toHaveProperty('title');
    });
  });

  describe('CalendarNotesApiResponseSchema', () => {
    it('should validate actual training_plans_calendar_notes_624432.json response', () => {
      const filePath = resolve(
        __dirname,
        '../../../TP_API_Responses/training_plans_calendar_notes_624432.json'
      );
      const fileContent = readFileSync(filePath, 'utf-8');
      const apiResponse = JSON.parse(fileContent);

      const result = CalendarNotesApiResponseSchema.parse(apiResponse);

      expect(result).toBeInstanceOf(Array);
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('id', 2139935);
      expect(result[0]).toHaveProperty('title', 'Week 2 starting');
      expect(result[1]).toHaveProperty('id', 2140470);
      expect(result[1]).toHaveProperty('title', 'This is the second Note');
    });
  });

  describe('CalendarEventsApiResponseSchema', () => {
    it('should validate actual training_plans_events_624432.json response', () => {
      const filePath = resolve(
        __dirname,
        '../../../TP_API_Responses/training_plans_events_624432.json'
      );
      const fileContent = readFileSync(filePath, 'utf-8');
      const apiResponse = JSON.parse(fileContent);

      const result = CalendarEventsApiResponseSchema.parse(apiResponse);

      expect(result).toBeInstanceOf(Array);
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('id', 560805);
      expect(result[0]).toHaveProperty('planId', 624432);
      expect(result[0]).toHaveProperty('name', 'Husky');
      expect(result[0]).toHaveProperty('eventType', 'MultisportTriathlon');
    });
  });
});
