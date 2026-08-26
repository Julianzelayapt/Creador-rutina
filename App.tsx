
import React, { useState, useEffect } from 'react';
import { Routine, Exercise } from './types';
import { supabase } from './supabase';
import RoutineSetup from './components/RoutineSetup';
import RoutineBuilder from './components/RoutineBuilder';
import ClientView from './components/ClientView';

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
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch (e) {
      console.error('Error parsing JSON from payload:', e);
      return null;
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

    return {
      ...payload,
      id: rawRecord.id || payload.id,
      name: payload.name || rawRecord.name || '',
      clientName: payload.clientName || rawRecord.client_name || '',
      objective: payload.objective || rawRecord.objective || '',
      split: payload.split || rawRecord.split || '',
      description: payload.description || rawRecord.description || '',
      image: payload.image || rawRecord.image || '',
      enabledMetrics: payload.enabledMetrics || { reps: true, kg: true, rir: true, rmPercentage: false, rest: true, tempo: false },
      weeks
    };
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

  // Aplicar modo oscuro al elemento raíz
  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      localStorage.setItem(THEME_KEY, 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem(THEME_KEY, 'light');
    }
  }, [isDarkMode]);

  // Cargar biblioteca y detectar ruta por hash inicial y cambios
  useEffect(() => {
    const fetchLibrary = async () => {
      const { data, error } = await supabase.from('exercises').select('*');
      if (error) console.error('Error loading library:', error);
      else if (data) {
        // Map snake_case database fields to camelCase app properties
        const mappedData: Exercise[] = data.map((ex: any) => ({
          id: ex.id,
          name: ex.name,
          videoUrl: ex.video_url, // Map video_url to videoUrl
          muscleImage: ex.muscle_image,
          tip: ex.tip
        }));
        setExerciseLibrary(mappedData);
      }
    };

    fetchLibrary();

    const handleHashChange = async () => {
      const hash = window.location.hash;

      if (hash && hash.startsWith('#routine/')) {
        const routineId = hash.replace('#routine/', '');
        await loadRoutine(routineId, 'client');
      } else if (hash && hash.startsWith('#builder/')) {
        const routineId = hash.replace('#builder/', '');
        await loadRoutine(routineId, 'builder');
      } else {
        if (window.location.hash === '') setView('setup');
      }
    };

    const loadRoutine = async (routineId: string, targetView: 'client' | 'builder') => {
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
          .single();

        if (error) {
          console.error('Error loading routine from Supabase:', error);
          if (!cacheFound) alert('No se pudo cargar la rutina desde la nube. Verifique el enlace.');
        } else if (data) {
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
          }
        }
      } catch (e) {
        console.error('Network or Supabase error during load:', e);
      } finally {
        setIsLoading(false);
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleRoutineCreated = (routine: Routine) => {
    setCurrentRoutine(routine);
    setView('builder');
  };

  const handleSaveRoutine = async (updatedRoutine: Routine) => {
    // Comprimir la imagen si es un base64 muy grande para evitar exceder límites de Supabase/red
    if (updatedRoutine.image && updatedRoutine.image.startsWith('data:image/')) {
      try {
        updatedRoutine.image = await compressBase64Image(updatedRoutine.image);
      } catch (e) {
        console.error('Error al comprimir la imagen al guardar:', e);
      }
    }

    // Actualizar estado local y caché de inmediato para que la vista del cliente siempre tenga los datos más recientes
    setCurrentRoutine(updatedRoutine);
    const fullCacheKey = `full_routine_cache_${updatedRoutine.id}`;
    localStorage.setItem(fullCacheKey, JSON.stringify(updatedRoutine));

    // Guardar en Supabase para la persistencia en la nube
    try {
      const { error } = await supabase
        .from('routines')
        .upsert({
          id: updatedRoutine.id,
          name: updatedRoutine.name,
          client_name: updatedRoutine.clientName,
          data: updatedRoutine
        });

      if (error) {
        console.error('Error saving routine to Supabase:', error);
        alert(`⚠️ Atención: No se pudo guardar en la nube (Supabase): ${error.message}`);
      }
    } catch (e: any) {
      console.error('Network or Supabase error:', e);
      alert(`⚠️ Error de red/conexión con Supabase: ${e?.message || e}`);
    }

    return updatedRoutine.id;
  };

  const addToLibrary = async (exercise: Exercise) => {
    // Optimistic update
    const updated = [...exerciseLibrary, exercise];
    setExerciseLibrary(updated);

    // Persist to Supabase
    const { error } = await supabase.from('exercises').insert({
      id: exercise.id,
      name: exercise.name,
      video_url: exercise.videoUrl,
      muscle_image: exercise.muscleImage,
      tip: exercise.tip
    });

    if (error) {
      console.error('Error adding to library:', error);
      alert('Error al guardar ejercicio en la nube');
    }
  };

  const removeFromLibrary = async (id: string) => {
    if (confirm('¿Eliminar ejercicio de la biblioteca?')) {
      // Optimistic update
      const updated = exerciseLibrary.filter(ex => ex.id !== id);
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
    // Optimistic update
    const updated = exerciseLibrary.map(ex => ex.id === exercise.id ? exercise : ex);
    setExerciseLibrary(updated);

    // Update in Supabase
    const { error } = await supabase.from('exercises').update({
      name: exercise.name,
      video_url: exercise.videoUrl,
      muscle_image: exercise.muscleImage,
      tip: exercise.tip
    }).eq('id', exercise.id);

    if (error) {
      console.error('Error updating library:', error);
      alert('Error al actualizar ejercicio en la nube');
    }
  };

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDarkMode ? 'dark bg-black text-white' : 'bg-slate-100 text-slate-900'}`}>
      <div className="fixed top-4 right-4 z-[100] flex gap-2">
        <button
          onClick={toggleTheme}
          className="p-3 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-full shadow-2xl border border-slate-200 dark:border-slate-700 active:scale-90 transition-all font-bold text-xs"
        >
          {isDarkMode ? '☀️ CLARO' : '🌙 OSCURO'}
        </button>
        {view !== 'setup' && (
          <button
            onClick={() => { window.location.hash = ''; window.location.reload(); }}
            className="p-3 bg-yellow-500 text-black shadow-lg shadow-yellow-500/20 font-bold text-xs active:scale-90"
          >
            SALIR
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 animate-in fade-in duration-500">
          <div className="w-20 h-20 border-8 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin mb-8 shadow-2xl shadow-yellow-500/20"></div>
          <h2 className="text-2xl font-['Oswald'] font-black uppercase tracking-tighter animate-pulse text-yellow-400">PREPARANDO RUTINA...</h2>
        </div>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
};

export default App;
