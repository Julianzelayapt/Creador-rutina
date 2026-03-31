
export interface Exercise {
  id: string;
  name: string;
  videoUrl: string;
  muscleImage?: string;
  tip: string;
}

export interface DropSet {
  id: string;
  reps: string;
  kg: string;
}

export interface TrainingSet {
  id: string;
  reps: string;
  kg: string;
  rir: string;
  rmPercentage: string;
  rest: string;
  dropsets?: DropSet[];
}

export interface ExerciseEntry {
  id: string;
  libraryExerciseId: string;
  sets: TrainingSet[];
  supersetGroupId?: string;
  supersetLabel?: string;
  supersetOrder?: number;
  supersetRest?: string;
  supersetFinalRest?: string;
}

export interface Workout {
  id: string;
  name: string;
  warmup?: string;
  exercises: ExerciseEntry[];
}

export interface Week {
  id: string;
  name: string;
  workouts: Workout[];
}

export interface ClientProgress {
  completedSets: Record<string, boolean>;
  clientWeights: Record<string, string>;
  clientReps: Record<string, string>;
  feelings: Record<string, string>;
  activeWeekId: string | null;
  activeWorkoutId: string | null;
  language: 'es' | 'en' | 'it';
  weeklySnapshots?: Record<string, Record<string, number>>; // { weekId: { exerciseId: avgKg } }
}

export interface Routine {
  id: string;
  name: string;
  description: string;
  clientName: string;
  image: string;
  clientProgress?: ClientProgress;
  weeks: Week[];
  enabledMetrics: {
    reps: boolean;
    kg: boolean;
    rir: boolean;
    rmPercentage: boolean;
    rest: boolean;
  };
}
