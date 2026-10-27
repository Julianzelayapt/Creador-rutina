
export interface Exercise {
  id: string;
  name: string;
  videoUrl: string;
  muscleImage?: string;
  muscleGroup?: string;
  alternativeExerciseIds?: string[];
  language?: 'es' | 'en' | 'it';
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
  tempo?: string;
  type?: 'warmup' | 'working';
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
  customTip?: string;
}

export interface Workout {
  id: string;
  name: string;
  warmup?: string;
  image?: string;
  dayOfWeek?: number; // 0 = Lunes, 1 = Martes, 2 = Miércoles, 3 = Jueves, 4 = Viernes, 5 = Sábado, 6 = Domingo
  isRestDay?: boolean;
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
  dayOverrides?: Record<string, string>; // e.g. { "weekId_dayIndex": workoutId | 'rest' }
}

export interface Routine {
  id: string;
  name: string;
  description: string;
  clientName: string;
  image: string;
  imagePosition?: string; // e.g. "50%" or "center 30%"
  objective?: string;
  split?: string;
  startDate?: string; // YYYY-MM-DD
  clientProgress?: ClientProgress;
  weeks: Week[];
  enabledMetrics: {
    reps: boolean;
    kg: boolean;
    rir: boolean;
    rmPercentage: boolean;
    rest: boolean;
    tempo?: boolean;
  };
}
