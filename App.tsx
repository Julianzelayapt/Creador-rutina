
import React, { useState, useEffect } from 'react';
import { Routine, Exercise } from './types';
import { supabase } from './supabase';
import RoutineSetup from './components/RoutineSetup';
import RoutineBuilder from './components/RoutineBuilder';
import ClientView from './components/ClientView';
import { extractExerciseMeta, embedExerciseMeta } from './muscleGroups';

const LOCAL_STORAGE_KEY = 'coach_routines_data_v3';
const LIBRARY_STORAGE_KEY = 'coach_exercise_library_v3';
const THEME_KEY = 'hevy_theme_v3';

const compressBase64Image = (base64Str: string, maxWidth = 800, maxHeight = 600, quality = 0.6): Promise<string> => {
  return new Promise((resolve) => {
    if (!base64Str || !base64Str.startsWith('data:image/') || base64Str.length < 150000) {
      resolve(base64Str);
      return;
    }
    
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64Str);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      resolve(base64Str);
    };
    img.src = base64Str;
  });
};

const parseRoutineData = (rawRecord: any): Routine | null => {
  if (!rawRecord) return null;
  let payload = (rawRecord.data !== undefined && rawRecord.data !== null) ? rawRecord.data : rawRecord;
  while (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch (e) {
      console.error('Error parsing JSON from payload:', e);
      break;
    }
  }
  if (typeof payload === 'object' && payload !== null) {
    const rawWeeks = Array.isArray(payload.weeks) ? payload.weeks : [];
    const weeks = rawWeeks.map((w: any) => ({
      id: w.id || Math.random().toString(36).substr(2, 9),
      name: w.name || 'Semana',
      workouts: Array.isArray(w.workouts) ? w.workouts.map((wk: any) => ({
        id: wk.id || Math.random().toString(36).substr(2, 9),
        name: wk.name || 'Día',
        warmup: wk.warmup || '',
        exercises: Array.isArray(wk.exercises) ? wk.exercises.map((ex: any) => ({
          id: ex.id || Math.random().toString(36).substr(2, 9),
          libraryExerciseId: ex.libraryExerciseId || '',
          sets: Array.isArray(ex.sets) ? ex.sets.map((s: any) => ({
            id: s.id || Math.random().toString(36).substr(2, 9),
            reps: s.reps ?? '10',
            kg: s.kg ?? '0',
            rir: s.rir ?? '2',
            rmPercentage: s.rmPercentage ?? '-',
            rest: s.rest ?? '2:00',
            tempo: s.tempo,
            type: s.type || 'working',
            dropsets: Array.isArray(s.dropsets) ? s.dropsets : []
          })) : [],
          supersetGroupId: ex.supersetGroupId,
          supersetLabel: ex.supersetLabel,
          supersetOrder: ex.supersetOrder,
          supersetRest: ex.supersetRest,
          supersetFinalRest: ex.supersetFinalRest,
          customTip: ex.customTip
        })) : []
      })) : []
    }));

    // Soporte retrocompatible robusto para clientProgress y legacy clientState
    const rawProgress = payload.clientProgress || payload.clientState || null;
    let clientProgress = undefined;
    if (rawProgress && typeof rawProgress === 'object') {
      const completedSets = rawProgress.completedSets || (rawProgress.completedSets === undefined && Object.keys(rawProgress).length > 0 && typeof Object.values(rawProgress)[0] === 'boolean' ? rawProgress : {});
      clientProgress = {
        completedSets: completedSets || {},
        clientWeights: rawProgress.clientWeights || {},
        clientReps: rawProgress.clientReps || {},
        clientCardioMinutes: rawProgress.clientCardioMinutes || {},
        clientCardioIntensity: rawProgress.clientCardioIntensity || {},
        feelings: rawProgress.feelings || {},
        activeWeekId: rawProgress.activeWeekId || null,
        activeWorkoutId: rawProgress.activeWorkoutId || null,
        activeExerciseId: rawProgress.activeExerciseId || null,
        activeViewMode: rawProgress.activeViewMode || null,
        language: rawProgress.language || 'es',
        weeklySnapshots: rawProgress.weeklySnapshots || {},
        dayOverrides: rawProgress.dayOverrides || {},
        exerciseOverrides: rawProgress.exerciseOverrides || {},
        lastActiveDate: rawProgress.lastActiveDate || null,
        lastWorkoutFinished: rawProgress.lastWorkoutFinished ?? false,
        lastWorkoutDate: rawProgress.lastWorkoutDate || null
      };
    }

    return {
      ...payload,
      id: rawRecord.id || payload.id,
      name: payload.name || rawRecord.name || '',
      clientName: payload.clientName || rawRecord.client_name || '',
      objective: payload.objective || rawRecord.objective || '',
      split: payload.split || rawRecord.split || '',
      description: payload.description || rawRecord.description || '',
      image: payload.image || rawRecord.image || '',
      startDate: (payload.startDate && typeof payload.startDate === 'string' && payload.startDate.trim() !== '') 
        ? payload.startDate 
        : (rawRecord.created_at ? rawRecord.created_at.split('T')[0] : undefined),
      enabledMetrics: payload.enabledMetrics || { reps: true, kg: true, rir: true, rmPercentage: false, rest: true, tempo: false },
      weeks,
      clientProgress: clientProgress || payload.clientProgress
    };
  }
  return null;
};

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-black text-white">
          <div className="p-4 bg-red-500/20 text-red-400 rounded-2xl mb-4 font-mono text-sm max-w-lg border border-red-500/30">
            ⚠️ Ocurrió un error al cargar la vista: {this.state.error?.message}
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-yellow-400 text-black font-black uppercase text-xs rounded-xl"
          >
            Recargar página
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface RouteTarget {
  targetView: 'client' | 'builder';
  routineId: string;
}

const parseCurrentRoute = (): RouteTarget | null => {
  // 1. Extraer desde el Hash de la URL (soporta #routine/ID, #rutina/ID, #/routine/ID, #/rutina/ID, #routines/ID, #rutinas/ID)
  const rawHash = window.location.hash || '';
  const cleanHash = rawHash.replace(/^#+/, '#').trim();

  // Match para vistas de cliente (#routine/ID, #rutina/ID, etc.)
  const routineMatch = cleanHash.match(/^#\/?(?:routine|rutina|routines|rutinas)\/([^\/?&#]+)/i);
  if (routineMatch && routineMatch[1]) {
    const id = decodeURIComponent(routineMatch[1]).trim().replace(/[\/#]+$/, '');
    if (id) return { targetView: 'client', routineId: id };
  }

  // Match para constructor (#builder/ID, #creador/ID, etc.)
  const builderMatch = cleanHash.match(/^#\/?(?:builder|creador)\/([^\/?&#]+)/i);
  if (builderMatch && builderMatch[1]) {
    const id = decodeURIComponent(builderMatch[1]).trim().replace(/[\/#]+$/, '');
    if (id) return { targetView: 'builder', routineId: id };
  }

  // 2. Extraer desde Query Parameters (?routine=ID, ?rutina=ID, ?id=ID) por si WhatsApp Web / navegadores PC limpiaron el hash
  try {
    const searchParams = new URLSearchParams(window.location.search);
    const routineParam = searchParams.get('routine') || searchParams.get('rutina') || searchParams.get('id');
    if (routineParam) {
      const id = decodeURIComponent(routineParam).trim().replace(/[\/#]+$/, '');
      if (id) return { targetView: 'client', routineId: id };
    }

    const builderParam = searchParams.get('builder') || searchParams.get('creador');
    if (builderParam) {
      const id = decodeURIComponent(builderParam).trim().replace(/[\/#]+$/, '');
      if (id) return { targetView: 'builder', routineId: id };
    }
  } catch (e) {
    console.error('Error al analizar parámetros de búsqueda:', e);
  }

  // 3. Extraer desde Pathname (/routine/ID o /rutina/ID)
  try {
    const pathname = window.location.pathname || '';
    const pathMatch = pathname.match(/\/(?:routine|rutina|routines|rutinas)\/([^\/?&#]+)/i);
    if (pathMatch && pathMatch[1]) {
      const id = decodeURIComponent(pathMatch[1]).trim().replace(/[\/#]+$/, '');
      if (id) return { targetView: 'client', routineId: id };
    }

    const builderPathMatch = pathname.match(/\/(?:builder|creador)\/([^\/?&#]+)/i);
    if (builderPathMatch && builderPathMatch[1]) {
      const id = decodeURIComponent(builderPathMatch[1]).trim().replace(/[\/#]+$/, '');
      if (id) return { targetView: 'builder', routineId: id };
    }
  } catch (e) {
    console.error('Error al analizar pathname:', e);
  }

  return null;
};

const App: React.FC = () => {
  const [view, setView] = useState<'setup' | 'builder' | 'client'>('setup');
  const [currentRoutine, setCurrentRoutine] = useState<Routine | null>(null);
  const [exerciseLibrary, setExerciseLibrary] = useState<Exercise[]>([]);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem(THEME_KEY) === 'dark';
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Forzar modo oscuro siempre
  useEffect(() => {
    window.document.documentElement.classList.add('dark');
  }, []);

  // Cargar biblioteca y detectar ruta por hash inicial y cambios
  useEffect(() => {
    const fetchLibrary = async () => {
      const { data, error } = await supabase.from('exercises').select('*');
      if (error) console.error('Error loading library:', error);
      else if (data) {
        // Map snake_case database fields to camelCase app properties
        const mappedData: Exercise[] = data.map((ex: any) => {
          const { cleanTip, meta } = extractExerciseMeta(ex.tip);
          const muscleGroup = ex.muscle_group || meta.muscleGroup || '';
          const alternativeExerciseIds = ex.alternatives || meta.alternativeExerciseIds || [];
          const muscleImage = ex.muscle_image || '';
          const language = (ex.language || meta.language || 'es') as 'es' | 'en' | 'it';

          return {
            id: ex.id,
            name: ex.name,
            videoUrl: ex.video_url,
            muscleImage,
            muscleGroup,
            alternativeExerciseIds,
            language,
            tip: cleanTip
          };
        });
        setExerciseLibrary(mappedData);
      }
    };

    fetchLibrary();

    const handleHashChange = async () => {
      const route = parseCurrentRoute();
      if (route) {
        await loadRoutine(route.routineId, route.targetView);
      } else {
        // Si no hay hash ni query en la URL, verificar si hay una última rutina abierta
        const lastRoutineId = localStorage.getItem('last_active_routine_id');
        if (lastRoutineId) {
          // Ir directo a la rutina del cliente
          window.location.hash = `#routine/${lastRoutineId}`;
          await loadRoutine(lastRoutineId, 'client');
        } else if (!window.location.hash && !window.location.search) {
          setView('setup');
          setLoadError(null);
        }
      }
    };

    const loadRoutine = async (rawRoutineId: string, targetView: 'client' | 'builder') => {
      const routineId = decodeURIComponent(rawRoutineId)
        .trim()
        .split('?')[0]
        .split('&')[0]
        .split('#')[0]
        .replace(/[\/#]+$/, '')
        .trim();

      if (!routineId) return;

      // Guardar como última rutina activa para que al reabrir la app vuelva siempre a la rutina
      try {
        localStorage.setItem('last_active_routine_id', routineId);
      } catch (e) {}

      setLoadError(null);

      // 0. Si ya la tenemos cargada en memoria con ese ID, cambiar vista al instante
      setCurrentRoutine(prev => {
        if (prev && prev.id === routineId) {
          setView(targetView);
        }
        return prev;
      });

      // 1. Intentar carga inmediata desde caché local (para cliente y builder)
      const fullCacheKey = `full_routine_cache_${routineId}`;
      const fullCachedRoutine = localStorage.getItem(fullCacheKey);
      let cacheFound = false;
      let cachedData: Routine | null = null;
      
      if (fullCachedRoutine) {
        try {
          cachedData = parseRoutineData(JSON.parse(fullCachedRoutine));
          if (cachedData && cachedData.id === routineId) {
            setCurrentRoutine(cachedData);
            setView(targetView);
            cacheFound = true;
          }
        } catch (e) {
          console.error('Error parsing full routine cache:', e);
        }
      }

      if (!cacheFound) {
        setIsLoading(true);
      }

      // 2. Cargar/Actualizar desde Supabase
      try {
        const { data, error } = await supabase
          .from('routines')
          .select('*')
          .eq('id', routineId)
          .maybeSingle();

        if (error) {
          console.error('Error loading routine from Supabase:', error);
          if (!cacheFound) {
            setLoadError(`Error al conectar con la nube: ${error.message || 'No se pudo obtener la rutina'}. Verifique su conexión.`);
          }
        } else if (!data) {
          console.warn('Routine not found in Supabase:', routineId);
          if (!cacheFound) {
            setLoadError(`No se encontró ninguna rutina con el identificador "${routineId}". Verifique que el enlace sea correcto y que el coach haya guardado los cambios en la nube.`);
          }
        } else {
          const freshRoutine = parseRoutineData(data);
          
          if (freshRoutine) {
            const countContent = (r: Routine | null) => {
              if (!r || !Array.isArray(r.weeks)) return 0;
              return r.weeks.reduce((acc, w) => {
                const wks = Array.isArray(w.workouts) ? w.workouts : [];
                const exCount = wks.reduce((wAcc, wk) => wAcc + (Array.isArray(wk.exercises) ? wk.exercises.length : 0) + 1, 0);
                return acc + exCount;
              }, 0);
            };

            const remoteCount = countContent(freshRoutine);
            const localCount = countContent(cachedData);

            if (!cachedData || remoteCount >= localCount) {
              setCurrentRoutine(freshRoutine);
              setView(targetView);
              localStorage.setItem(fullCacheKey, JSON.stringify(freshRoutine));
            } else if (cachedData) {
              setCurrentRoutine(cachedData);
              setView(targetView);
              // Sincronizar hacia Supabase la versión con contenido local
              supabase.from('routines').upsert({
                id: cachedData.id,
                name: cachedData.name,
                client_name: cachedData.clientName,
                data: cachedData
              }).catch(e => console.error('Error auto-syncing local cache:', e));
            }
          } else if (!cacheFound) {
            setLoadError(`El formato de la rutina recibida no es válido o está incompleto.`);
          }
        }
      } catch (e: any) {
        console.error('Network or Supabase error during load:', e);
        if (!cacheFound) {
          setLoadError(`Error de red o conexión: ${e?.message || 'Verifique su conexión a Internet'}`);
        }
      } finally {
        setIsLoading(false);
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('popstate', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handleHashChange);
    };
  }, []);

  const handleRoutineCreated = (routine: Routine) => {
    setCurrentRoutine(routine);
    setView('builder');
  };

  const handleSaveRoutine = async (updatedRoutine: Routine) => {
    // Preservar siempre clientProgress si ya existía en currentRoutine o si el cliente lo actualizó en Supabase
    let latestClientProgress = updatedRoutine.clientProgress || currentRoutine?.clientProgress;
    try {
      const { data: remoteData } = await supabase
        .from('routines')
        .select('data')
        .eq('id', updatedRoutine.id)
        .single();

      if (remoteData?.data) {
        const remoteProgress = remoteData.data.clientProgress || remoteData.data.clientState;
        if (remoteProgress) {
          latestClientProgress = {
            completedSets: { ...(latestClientProgress?.completedSets || {}), ...(remoteProgress.completedSets || {}) },
            clientWeights: { ...(latestClientProgress?.clientWeights || {}), ...(remoteProgress.clientWeights || {}) },
            clientReps: { ...(latestClientProgress?.clientReps || {}), ...(remoteProgress.clientReps || {}) },
            feelings: { ...(latestClientProgress?.feelings || {}), ...(remoteProgress.feelings || {}) },
            snapshots: [
              ...(latestClientProgress?.snapshots || []),
              ...(remoteProgress.snapshots || []).filter(
                (rs: any) => !(latestClientProgress?.snapshots || []).some((ls: any) => ls.date === rs.date && ls.workoutId === rs.workoutId)
              )
            ]
          };
        }
      }
    } catch (err) {
      console.warn('No se pudo consultar progreso remoto previo al guardado:', err);
    }

    const routineToSave: Routine = {
      ...updatedRoutine,
      clientProgress: latestClientProgress
    };

    // Comprimir la imagen si es un base64 muy grande para evitar exceder límites de Supabase/red
    if (routineToSave.image && routineToSave.image.startsWith('data:image/')) {
      try {
        routineToSave.image = await compressBase64Image(routineToSave.image);
      } catch (e) {
        console.error('Error al comprimir la imagen al guardar:', e);
      }
    }

    // Actualizar estado local y caché de inmediato para que la vista del cliente siempre tenga los datos más recientes
    setCurrentRoutine(routineToSave);
    const fullCacheKey = `full_routine_cache_${routineToSave.id}`;
    localStorage.setItem(fullCacheKey, JSON.stringify(routineToSave));

    // Guardar en Supabase para la persistencia en la nube
    try {
      const { error } = await supabase
        .from('routines')
        .upsert({
          id: routineToSave.id,
          name: routineToSave.name,
          client_name: routineToSave.clientName,
          data: routineToSave
        });

      if (error) {
        console.error('Error saving routine to Supabase:', error);
        alert(`⚠️ Atención: No se pudo guardar en la nube (Supabase): ${error.message}\nVerifica que la conexión a Internet esté activa.`);
        throw error;
      }
    } catch (e: any) {
      console.error('Network or Supabase error:', e);
      alert(`⚠️ Error de red/conexión con Supabase: ${e?.message || e}`);
      throw e;
    }

    return updatedRoutine.id;
  };

  // Sincronización bidireccional recíproca para ejercicios sustitutos
  const syncReciprocalAlternatives = (
    library: Exercise[],
    savedExercise: Exercise
  ): { updatedLibrary: Exercise[]; affectedOthers: Exercise[] } => {
    const currentAlts = new Set(savedExercise.alternativeExerciseIds || []);
    const oldExercise = library.find(e => e.id === savedExercise.id);
    const oldAlts = new Set(oldExercise?.alternativeExerciseIds || []);

    // Grupo completo: el ejercicio guardado + todas sus alternativas actuales
    const fullGroup = new Set([savedExercise.id, ...currentAlts]);
    // Ejercicios que fueron quitados del grupo
    const removedIds = [...oldAlts].filter(id => !currentAlts.has(id));

    const affected: Exercise[] = [];

    const updatedLibrary = library.map(ex => {
      if (ex.id === savedExercise.id) return savedExercise;

      const exAlts = new Set(ex.alternativeExerciseIds || []);
      let changed = false;

      if (fullGroup.has(ex.id)) {
        // Este ejercicio es parte del grupo → agregar todos los demás miembros del grupo
        for (const memberId of fullGroup) {
          if (memberId !== ex.id && !exAlts.has(memberId)) {
            exAlts.add(memberId);
            changed = true;
          }
        }
      }

      // Si este ejercicio fue removido del grupo → quitarle el vínculo con savedExercise
      if (removedIds.includes(ex.id) && exAlts.has(savedExercise.id)) {
        exAlts.delete(savedExercise.id);
        changed = true;
      }

      if (changed) {
        const updatedEx = { ...ex, alternativeExerciseIds: Array.from(exAlts) };
        affected.push(updatedEx);
        return updatedEx;
      }
      return ex;
    });

    if (!updatedLibrary.some(e => e.id === savedExercise.id)) {
      updatedLibrary.push(savedExercise);
    }

    return { updatedLibrary, affectedOthers: affected };
  };

  const persistExerciseToSupabase = async (ex: Exercise, isNew: boolean) => {
    const preparedTip = embedExerciseMeta(ex.tip, {
      muscleGroup: ex.muscleGroup,
      alternativeExerciseIds: ex.alternativeExerciseIds,
      language: ex.language || 'es'
    });
    const muscleImage = ex.muscleImage || '';

    const payload = {
      id: ex.id,
      name: ex.name,
      video_url: ex.videoUrl,
      muscle_image: muscleImage,
      tip: preparedTip
    };

    if (isNew) {
      return await supabase.from('exercises').insert(payload);
    } else {
      return await supabase.from('exercises').update({
        name: payload.name,
        video_url: payload.video_url,
        muscle_image: payload.muscle_image,
        tip: payload.tip
      }).eq('id', ex.id);
    }
  };

  const addToLibrary = async (exercise: Exercise) => {
    // Resolver imagen de grupo si no tiene una
    const completeEx: Exercise = {
      ...exercise,
      language: exercise.language || 'es',
      muscleImage: exercise.muscleImage || ''
    };

    // Sincronización recíproca con otros ejercicios
    const { updatedLibrary, affectedOthers } = syncReciprocalAlternatives(exerciseLibrary, completeEx);
    setExerciseLibrary(updatedLibrary);

    // Persistir nuevo ejercicio
    const { error } = await persistExerciseToSupabase(completeEx, true);
    if (error) {
      console.error('Error adding to library:', error);
      alert('Error al guardar ejercicio en la nube');
      return;
    }

    // Persistir actualizaciones recíprocas en background
    affectedOthers.forEach(aff => {
      persistExerciseToSupabase(aff, false).catch(e => console.error('Error syncing alt:', e));
    });
  };

  const removeFromLibrary = async (id: string) => {
    if (confirm('¿Eliminar ejercicio de la biblioteca?')) {
      // Optimistic update removiendo también las referencias cruzadas
      const updated = exerciseLibrary
        .filter(ex => ex.id !== id)
        .map(ex => {
          if (ex.alternativeExerciseIds && ex.alternativeExerciseIds.includes(id)) {
            const cleanedAlts = ex.alternativeExerciseIds.filter(altId => altId !== id);
            const cleanedEx = { ...ex, alternativeExerciseIds: cleanedAlts };
            persistExerciseToSupabase(cleanedEx, false).catch(e => console.error('Error updating after delete:', e));
            return cleanedEx;
          }
          return ex;
        });

      setExerciseLibrary(updated);

      // Remove from Supabase
      const { error } = await supabase.from('exercises').delete().eq('id', id);
      if (error) {
        console.error('Error deleting from library:', error);
        alert('Error al eliminar de la nube');
      }
    }
  };

  const editInLibrary = async (exercise: Exercise) => {
    const completeEx: Exercise = {
      ...exercise,
      language: exercise.language || 'es',
      muscleImage: exercise.muscleImage || ''
    };

    // Sincronización recíproca bidireccional
    const { updatedLibrary, affectedOthers } = syncReciprocalAlternatives(exerciseLibrary, completeEx);
    setExerciseLibrary(updatedLibrary);

    // Persistir ejercicio editado
    const { error } = await persistExerciseToSupabase(completeEx, false);
    if (error) {
      console.error('Error updating library:', error);
      alert('Error al actualizar ejercicio en la nube');
      return;
    }

    // Persistir ejercicios afectados por el cambio de sustitutos
    affectedOthers.forEach(aff => {
      persistExerciseToSupabase(aff, false).catch(e => console.error('Error syncing alt:', e));
    });
  };

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  return (
    <div className="min-h-screen bg-black text-white">

      {isLoading ? (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 animate-in fade-in duration-500">
          <div className="w-20 h-20 border-8 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin mb-8 shadow-2xl shadow-yellow-500/20"></div>
          <h2 className="text-xl font-bold uppercase tracking-tight animate-pulse text-white">PREPARANDO RUTINA...</h2>
        </div>
      ) : loadError ? (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-black text-white animate-in fade-in duration-300">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-red-500/10">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-display font-black uppercase tracking-tight text-white mb-2">No se pudo cargar la rutina</h2>
          <p className="text-zinc-400 text-sm max-w-md mb-6">{loadError}</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => {
                const route = parseCurrentRoute();
                if (route) {
                  window.location.reload();
                } else {
                  window.location.reload();
                }
              }}
              className="px-5 py-2.5 bg-yellow-400 text-black font-black uppercase text-xs rounded-xl hover:bg-yellow-300 transition-colors shadow-lg shadow-yellow-400/20"
            >
              Reintentar
            </button>
            <button
              onClick={() => {
                window.location.hash = '';
                if (window.history && window.history.replaceState) {
                  window.history.replaceState(null, '', window.location.pathname);
                }
                setLoadError(null);
                setView('setup');
              }}
              className="px-5 py-2.5 bg-white/10 text-white font-bold uppercase text-xs rounded-xl hover:bg-white/20 transition-colors border border-white/10"
            >
              Ir al inicio
            </button>
          </div>
        </div>
      ) : (
        <ErrorBoundary>
          {view === 'setup' && <RoutineSetup onRoutineCreated={handleRoutineCreated} />}
          {view === 'builder' && currentRoutine && (
            <RoutineBuilder
              routine={currentRoutine}
              library={exerciseLibrary}
              onSave={handleSaveRoutine}
              onAddToLibrary={addToLibrary}
              onRemoveFromLibrary={removeFromLibrary}
              onEditLibrary={editInLibrary}
              onGoToClient={() => setView('client')}
            />
          )}
          {view === 'client' && currentRoutine && (
            <ClientView routine={currentRoutine} library={exerciseLibrary} />
          )}
        </ErrorBoundary>
      )}
    </div>
  );
};

export default App;
