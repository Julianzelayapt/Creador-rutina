// Catálogo centralizado de grupos musculares

export interface MuscleGroupInfo {
  id: string;
  name: string;
  category: 'tren_superior' | 'tren_inferior' | 'core' | 'cardio' | 'otro';
  defaultImage?: string;
}

export const DEFAULT_MUSCLE_GROUPS: MuscleGroupInfo[] = [
  { id: 'pecho', name: 'Pecho', category: 'tren_superior' },
  { id: 'espalda', name: 'Espalda', category: 'tren_superior' },
  { id: 'hombros', name: 'Hombros', category: 'tren_superior' },
  { id: 'biceps', name: 'Bíceps', category: 'tren_superior' },
  { id: 'triceps', name: 'Tríceps', category: 'tren_superior' },
  { id: 'cuadriceps', name: 'Cuádriceps', category: 'tren_inferior' },
  { id: 'isquios', name: 'Isquios / Femorales', category: 'tren_inferior' },
  { id: 'gluteos', name: 'Glúteos', category: 'tren_inferior' },
  { id: 'aductores', name: 'Aductores', category: 'tren_inferior' },
  { id: 'gemelos', name: 'Gemelos / Pantorrillas', category: 'tren_inferior' },
  { id: 'abdomen', name: 'Abdomen / Core', category: 'core' },
  { id: 'cardio', name: 'Cardio', category: 'cardio' },
  { id: 'general', name: 'Cuerpo Completo / Otro', category: 'otro' }
];

export const getCustomMuscleImages = (): Record<string, string> => {
  return {};
};

export const setCustomMuscleImage = (_groupId: string, _imageUrl: string) => {
};

export const getMuscleGroupImage = (_groupId?: string): string => {
  return '';
};

export const findMuscleGroupById = (idOrName?: string): MuscleGroupInfo | undefined => {
  if (!idOrName) return undefined;
  const target = idOrName.toLowerCase();
  return DEFAULT_MUSCLE_GROUPS.find(g => g.id.toLowerCase() === target || g.name.toLowerCase() === target);
};

// Serializador seguro de metadatos en el campo tip para compatibilidad 100% con Supabase
const META_TAG_REGEX = /<!--\s*meta:({.*?})\s*-->/s;

export interface ExerciseMeta {
  muscleGroup?: string;
  alternativeExerciseIds?: string[];
  language?: 'es' | 'en' | 'it';
}

export const extractExerciseMeta = (rawTip?: string): { cleanTip: string; meta: ExerciseMeta } => {
  if (!rawTip) return { cleanTip: '', meta: {} };
  const match = rawTip.match(META_TAG_REGEX);
  if (!match) return { cleanTip: rawTip, meta: {} };

  try {
    const meta = JSON.parse(match[1]) as ExerciseMeta;
    const cleanTip = rawTip.replace(META_TAG_REGEX, '').trim();
    return { cleanTip, meta };
  } catch {
    return { cleanTip: rawTip, meta: {} };
  }
};

export const embedExerciseMeta = (tip: string, meta: ExerciseMeta): string => {
  const cleanTip = tip.replace(META_TAG_REGEX, '').trim();
  const hasMeta = meta.muscleGroup || meta.language || (meta.alternativeExerciseIds && meta.alternativeExerciseIds.length > 0);
  if (!hasMeta) return cleanTip;
  const metaString = `<!-- meta:${JSON.stringify(meta)} -->`;
  return cleanTip ? `${cleanTip}\n\n${metaString}` : metaString;
};

export interface LanguageOption {
  code: 'es' | 'en' | 'it';
  name: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' }
];

export const normalizeSearchText = (str?: string): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
};

export const matchesSearchQuery = (text: string, query: string): boolean => {
  if (!query || !query.trim()) return true;
  const normText = normalizeSearchText(text);
  const tokens = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  return tokens.every(token => normText.includes(token));
};
