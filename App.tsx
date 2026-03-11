
import React, { useState, useEffect } from 'react';
import { Routine, Exercise } from './types';
import { supabase } from './supabase';
import RoutineSetup from './components/RoutineSetup';
import RoutineBuilder from './components/RoutineBuilder';
import ClientView from './components/ClientView';

const LOCAL_STORAGE_KEY = 'coach_routines_data_v3';
const LIBRARY_STORAGE_KEY = 'coach_exercise_library_v3';
const THEME_KEY = 'hevy_theme_v3';

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
      setIsLoading(true);
      // Cargar rutina desde Supabase
      const { data, error } = await supabase
        .from('routines')
        .select('*')
        .eq('id', routineId)
        .single();

      if (error) {
        console.error('Error loading routine:', error);
        alert('No se pudo cargar la rutina. Verifique el enlace.');
      } else if (data) {
        // La columna 'data' contiene la estructura JSON de la rutina
        setCurrentRoutine({ ...data.data, id: data.id }); // Aseguramos que el ID coincida
        setView(targetView);
      }
      setIsLoading(false);
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
    // Para evitar sobreescribir el progreso del cliente si el coach guarda cambios 
    // mientras el cliente está entrenando, obtenemos el progreso más reciente primero.
    const { data: currentDbData } = await supabase
      .from('routines')
      .select('data')
      .eq('id', updatedRoutine.id)
      .single();

    if (currentDbData?.data?.clientProgress) {
      updatedRoutine.clientProgress = currentDbData.data.clientProgress;
    }

    setCurrentRoutine(updatedRoutine);

    // Guardar en Supabase
    const { error } = await supabase
      .from('routines')
      .upsert({
        id: updatedRoutine.id,
        name: updatedRoutine.name,
        client_name: updatedRoutine.clientName,
        data: updatedRoutine // Guardamos todo el objeto rutina en la columna JSONB
      });

    if (error) {
      console.error('Error saving routine:', error);
      alert('Error al guardar la rutina');
      return '';
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
    <div className={`min-h-screen transition-colors duration-300 ${isDarkMode ? 'dark bg-black text-white' : 'bg-slate-50 text-slate-900'}`}>
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
            className="p-3 bg-red-500 text-white rounded-full shadow-2xl font-bold text-xs active:scale-90"
          >
            SALIR
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 animate-in fade-in duration-500">
          <div className="w-20 h-20 border-8 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mb-8 shadow-2xl shadow-blue-500/20"></div>
          <h2 className="text-2xl font-black uppercase italic tracking-tighter animate-pulse text-blue-600">PREPARANDO RUTINA...</h2>
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
