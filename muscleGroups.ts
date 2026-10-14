// Catálogo centralizado de grupos musculares con fotos anatómicas predeterminadas

export interface MuscleGroupInfo {
  id: string;
  name: string;
  category: 'tren_superior' | 'tren_inferior' | 'core' | 'otro';
  defaultImage: string;
}

// SVGs anatómicos estilizados en modo oscuro de alta fidelidad como Data-URI para que nunca fallen (offline, sin 404)
const createMuscleSvg = (label: string, iconType: string, accentColor: string = '#EAB308') => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
    <rect width="160" height="160" rx="28" fill="#18181b"/>
    <circle cx="80" cy="72" r="50" fill="${accentColor}" fill-opacity="0.12"/>
    <circle cx="80" cy="72" r="38" stroke="${accentColor}" stroke-opacity="0.3" stroke-width="2" stroke-dasharray="4 4" fill="none"/>
    <g fill="${accentColor}" transform="translate(48, 40) scale(1.6)">
      ${iconType}
    </g>
    <rect x="20" y="122" width="120" height="24" rx="12" fill="#27272a"/>
    <text x="80" y="138" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="800" text-anchor="middle" fill="#f4f4f5" letter-spacing="1">${label.toUpperCase()}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

// Iconos anatómicos representativos
const ICONS = {
  pecho: `<path d="M4 8 C10 4, 18 4, 20 12 C22 20, 16 26, 4 28 C2 22, 2 14, 4 8 Z M36 8 C30 4, 22 4, 20 12 C18 20, 24 26, 36 28 C38 22, 38 14, 36 8 Z" fill="currentColor"/>`,
  espalda: `<path d="M6 6 C14 8, 20 14, 20 28 C16 26, 10 20, 6 12 Z M34 6 C26 8, 20 14, 20 28 C24 26, 30 20, 34 12 Z M20 4 L20 28" stroke="currentColor" stroke-width="3" fill="none"/>`,
  hombros: `<path d="M6 14 C10 8, 16 8, 20 12 C14 18, 10 24, 6 20 Z M34 14 C30 8, 24 8, 20 12 C26 18, 30 24, 34 20 Z" fill="currentColor"/>`,
  biceps: `<path d="M10 24 C10 14, 18 8, 24 10 C30 12, 32 20, 26 26 C20 28, 12 28, 10 24 Z" fill="currentColor"/>`,
  triceps: `<path d="M26 10 C20 12, 12 18, 14 26 C16 30, 24 28, 28 22 C30 16, 28 12, 26 10 Z" fill="currentColor"/>`,
  cuadriceps: `<path d="M12 6 C18 6, 20 16, 18 32 C14 30, 10 24, 10 14 Z M28 6 C22 6, 20 16, 22 32 C26 30, 30 24, 30 14 Z" fill="currentColor"/>`,
  isquios: `<path d="M14 8 C18 10, 18 20, 16 32 C12 28, 12 18, 14 8 Z M26 8 C22 10, 22 20, 24 32 C28 28, 28 18, 26 8 Z" fill="currentColor"/>`,
  gluteos: `<path d="M8 16 C12 8, 18 10, 20 20 C18 26, 12 28, 8 22 Z M32 16 C28 8, 22 10, 20 20 C22 26, 28 28, 32 22 Z" fill="currentColor"/>`,
  gemelos: `<path d="M14 10 C18 12, 18 24, 16 32 C12 28, 12 20, 14 10 Z M26 10 C22 12, 22 24, 24 32 C28 28, 28 20, 26 10 Z" fill="currentColor"/>`,
  abdomen: `<path d="M14 6 H26 V12 H14 Z M14 14 H26 V20 H14 Z M14 22 H26 V28 H14 Z" fill="currentColor"/>`,
  general: `<path d="M20 4 C14 12, 14 28, 20 36 C26 28, 26 12, 20 4 Z" fill="currentColor"/>`
};

export const DEFAULT_MUSCLE_GROUPS: MuscleGroupInfo[] = [
  { id: 'pecho', name: 'Pecho', category: 'tren_superior', defaultImage: createMuscleSvg('Pecho', ICONS.pecho, '#F59E0B') },
  { id: 'espalda', name: 'Espalda', category: 'tren_superior', defaultImage: createMuscleSvg('Espalda', ICONS.espalda, '#3B82F6') },
  { id: 'hombros', name: 'Hombros', category: 'tren_superior', defaultImage: createMuscleSvg('Hombros', ICONS.hombros, '#EC4899') },
  { id: 'biceps', name: 'Bíceps', category: 'tren_superior', defaultImage: createMuscleSvg('Bíceps', ICONS.biceps, '#10B981') },
  { id: 'triceps', name: 'Tríceps', category: 'tren_superior', defaultImage: createMuscleSvg('Tríceps', ICONS.triceps, '#8B5CF6') },
  { id: 'cuadriceps', name: 'Cuádriceps', category: 'tren_inferior', defaultImage: createMuscleSvg('Cuádriceps', ICONS.cuadriceps, '#EF4444') },
  { id: 'isquios', name: 'Isquios / Femorales', category: 'tren_inferior', defaultImage: createMuscleSvg('Femorales', ICONS.isquios, '#F97316') },
  { id: 'gluteos', name: 'Glúteos', category: 'tren_inferior', defaultImage: createMuscleSvg('Glúteos', ICONS.gluteos, '#D946EF') },
  { id: 'gemelos', name: 'Gemelos / Pantorrillas', category: 'tren_inferior', defaultImage: createMuscleSvg('Gemelos', ICONS.gemelos, '#06B6D4') },
  { id: 'abdomen', name: 'Abdomen / Core', category: 'core', defaultImage: createMuscleSvg('Abdomen', ICONS.abdomen, '#EAB308') },
  { id: 'general', name: 'Cuerpo Completo / Otro', category: 'otro', defaultImage: createMuscleSvg('General', ICONS.general, '#9CA3AF') }
];

// Almacenamiento local para permitir al coach personalizar la foto de un grupo muscular si quiere
const STORAGE_KEY_CUSTOM_IMAGES = 'gym_custom_muscle_images';

export const getCustomMuscleImages = (): Record<string, string> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_IMAGES);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export const setCustomMuscleImage = (groupId: string, imageUrl: string) => {
  try {
    const current = getCustomMuscleImages();
    if (!imageUrl) {
      delete current[groupId];
    } else {
      current[groupId] = imageUrl;
    }
    localStorage.setItem(STORAGE_KEY_CUSTOM_IMAGES, JSON.stringify(current));
  } catch (err) {
    console.error('Error saving custom muscle image:', err);
  }
};

export const getMuscleGroupImage = (groupId?: string): string => {
  if (!groupId) return DEFAULT_MUSCLE_GROUPS[0].defaultImage;
  const custom = getCustomMuscleImages();
  if (custom[groupId]) return custom[groupId];
  const found = DEFAULT_MUSCLE_GROUPS.find(g => g.id === groupId || g.name.toLowerCase() === groupId.toLowerCase());
  return found ? found.defaultImage : DEFAULT_MUSCLE_GROUPS[0].defaultImage;
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
  const hasMeta = meta.muscleGroup || (meta.alternativeExerciseIds && meta.alternativeExerciseIds.length > 0);
  if (!hasMeta) return cleanTip;
  const metaString = `<!-- meta:${JSON.stringify(meta)} -->`;
  return cleanTip ? `${cleanTip}\n\n${metaString}` : metaString;
};
