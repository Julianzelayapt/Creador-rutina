
import React, { useState, useEffect } from 'react';
import { Routine, Exercise, Week, Workout, ExerciseEntry, TrainingSet } from '../types';

interface RoutineBuilderProps {
  routine: Routine;
  library: Exercise[];
  onSave: (routine: Routine) => Promise<string>;
  onAddToLibrary: (exercise: Exercise) => void;
  onRemoveFromLibrary: (id: string) => void;
  onEditLibrary: (exercise: Exercise) => void;
  onGoToClient: () => void;
}

const RoutineBuilder: React.FC<RoutineBuilderProps> = ({ routine, library, onSave, onAddToLibrary, onRemoveFromLibrary, onEditLibrary, onGoToClient }) => {
  const [currentRoutine, setCurrentRoutine] = useState<Routine>(routine);
  const [showLibraryForm, setShowLibraryForm] = useState(false);
  const [newExercise, setNewExercise] = useState<{ id?: string, name: string, videoUrl: string, muscleImage: string, tip: string }>({ name: '', videoUrl: '', muscleImage: '', tip: '' });
  const [shareLinks, setShareLinks] = useState<{ client: string, builder: string } | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [libraryQuery, setLibraryQuery] = useState('');

  // Navegación por ID
  const [activeWeekId, setActiveWeekId] = useState<string | null>(routine.weeks[0]?.id || null);
  const [activeWorkoutId, setActiveWorkoutId] = useState<string | null>(null);

  // Asegurar selección al cambiar semana o cargar
  useEffect(() => {
    if (activeWeekId) {
      const week = currentRoutine.weeks.find(w => w.id === activeWeekId);
      if (week && week.workouts.length > 0) {
        // Si no hay workout seleccionado o el seleccionado no pertenece a esta semana
        if (!activeWorkoutId || !week.workouts.find(wk => wk.id === activeWorkoutId)) {
          setActiveWorkoutId(week.workouts[0].id);
        }
      } else {
        setActiveWorkoutId(null);
      }
    }
  }, [activeWeekId, currentRoutine.weeks]);

  const handleSave = async () => {
    const routineId = await onSave(currentRoutine);
    const origin = window.location.origin + window.location.pathname;
    setShareLinks({
      client: `${origin}#routine/${routineId}`,
      builder: `${origin}#builder/${routineId}`
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const addWeek = () => {
    const newId = Math.random().toString(36).substr(2, 9);
    const newWeek: Week = {
      id: newId,
      name: `Week ${currentRoutine.weeks.length + 1}`,
      workouts: []
    };
    setCurrentRoutine({ ...currentRoutine, weeks: [...currentRoutine.weeks, newWeek] });
    setActiveWeekId(newId);
  };

  const deleteWeek = (weekId: string) => {
    if (confirm('¿Estás seguro de borrar toda la semana y sus entrenamientos?')) {
      const newWeeks = currentRoutine.weeks.filter(w => w.id !== weekId);
      setCurrentRoutine({ ...currentRoutine, weeks: newWeeks });
      if (activeWeekId === weekId) {
        setActiveWeekId(newWeeks[0]?.id || null);
      }
    }
  };

  const duplicateWeek = (weekId: string) => {
    const weekToDuplicate = currentRoutine.weeks.find(w => w.id === weekId);
    if (!weekToDuplicate) return;

    const newWeek: Week = {
      ...weekToDuplicate,
      id: Math.random().toString(36).substr(2, 9),
      name: `Week ${currentRoutine.weeks.length + 1}`,
      workouts: weekToDuplicate.workouts.map(workout => ({
        ...workout,
        id: Math.random().toString(36).substr(2, 9),
        exercises: workout.exercises.map(exercise => ({
          ...exercise,
          id: Math.random().toString(36).substr(2, 9),
          sets: exercise.sets.map(set => ({
            ...set,
            id: Math.random().toString(36).substr(2, 9)
          }))
        }))
      }))
    };

    setCurrentRoutine({
      ...currentRoutine,
      weeks: [...currentRoutine.weeks, newWeek]
    });
    setActiveWeekId(newWeek.id);
  };

  const addWorkout = (weekId: string) => {
    const newWorkoutId = Math.random().toString(36).substr(2, 9);
    setCurrentRoutine({
      ...currentRoutine,
      weeks: currentRoutine.weeks.map(w => {
        if (w.id === weekId) {
          const newWorkout: Workout = {
            id: newWorkoutId,
            name: `Día ${w.workouts.length + 1}`,
            warmup: '',
            exercises: []
          };
          return { ...w, workouts: [...w.workouts, newWorkout] };
        }
        return w;
      })
    });
    setActiveWorkoutId(newWorkoutId);
  };

  const deleteWorkout = (weekId: string, workoutId: string) => {
    if (confirm('¿Borrar este día de entrenamiento?')) {
      setCurrentRoutine({
        ...currentRoutine,
        weeks: currentRoutine.weeks.map(w => {
          if (w.id === weekId) {
            return { ...w, workouts: w.workouts.filter(wk => wk.id !== workoutId) };
          }
          return w;
        })
      });
      setActiveWorkoutId(null);
    }
  };

  const addExerciseToWorkout = (weekId: string, workoutId: string, exerciseId: string) => {
    setCurrentRoutine({
      ...currentRoutine,
      weeks: currentRoutine.weeks.map(w => {
        if (w.id === weekId) {
          return {
            ...w,
            workouts: w.workouts.map(wk => {
              if (wk.id === workoutId) {
                const newEntry: ExerciseEntry = {
                  id: Math.random().toString(36).substr(2, 9),
                  libraryExerciseId: exerciseId,
                  sets: [{ id: Math.random().toString(36).substr(2, 9), reps: '10', kg: '0', rir: '2', rmPercentage: '-', rest: '2:00' }]
                };
                return { ...wk, exercises: [...wk.exercises, newEntry] };
              }
              return wk;
            })
          };
        }
        return w;
      })
    });
  };

  const deleteExercise = (weekId: string, workoutId: string, entryId: string) => {
    setCurrentRoutine({
      ...currentRoutine,
      weeks: currentRoutine.weeks.map(w => {
        if (w.id === weekId) {
          return {
            ...w,
            workouts: w.workouts.map(wk => {
              if (wk.id === workoutId) {
                return { ...wk, exercises: wk.exercises.filter(e => e.id !== entryId) };
              }
              return wk;
            })
          };
        }
        return w;
      })
    });
  };

  const addSet = (weekId: string, workoutId: string, entryId: string) => {
    setCurrentRoutine({
      ...currentRoutine,
      weeks: currentRoutine.weeks.map(w => {
        if (w.id === weekId) {
          return {
            ...w,
            workouts: w.workouts.map(wk => {
              if (wk.id === workoutId) {
                return {
                  ...wk,
                  exercises: wk.exercises.map(ex => {
                    if (ex.id === entryId) {
                      const lastSet = ex.sets[ex.sets.length - 1];
                      return {
                        ...ex,
                        sets: [...ex.sets, {
                          id: Math.random().toString(36).substr(2, 9),
                          reps: lastSet?.reps || '10',
                          kg: lastSet?.kg || '0',
                          rir: lastSet?.rir || '2',
                          rmPercentage: lastSet?.rmPercentage || '-',
                          rest: lastSet?.rest || '2:00'
                        }]
                      };
                    }
                    return ex;
                  })
                };
              }
              return wk;
            })
          };
        }
        return w;
      })
    });
  };

  const deleteSet = (weekId: string, workoutId: string, entryId: string, setId: string) => {
    setCurrentRoutine({
      ...currentRoutine,
      weeks: currentRoutine.weeks.map(w => {
        if (w.id === weekId) {
          return {
            ...w,
            workouts: w.workouts.map(wk => {
              if (wk.id === workoutId) {
                return {
                  ...wk,
                  exercises: wk.exercises.map(ex => {
                    if (ex.id === entryId) {
                      return { ...ex, sets: ex.sets.filter(s => s.id !== setId) };
                    }
                    return ex;
                  })
                };
              }
              return wk;
            })
          };
        }
        return w;
      })
    });
  };

  const updateSet = (weekId: string, workoutId: string, entryId: string, setId: string, field: keyof TrainingSet, value: string) => {
    setCurrentRoutine({
      ...currentRoutine,
      weeks: currentRoutine.weeks.map(w => {
        if (w.id === weekId) {
          return {
            ...w,
            workouts: w.workouts.map(wk => {
              if (wk.id === workoutId) {
                return {
                  ...wk,
                  exercises: wk.exercises.map(ex => {
                    if (ex.id === entryId) {
                      return { ...ex, sets: ex.sets.map(s => s.id === setId ? { ...s, [field]: value } : s) };
                    }
                    return ex;
                  })
                };
              }
              return wk;
            })
          };
        }
        return w;
      })
    });
  };

  const currentWeek = currentRoutine.weeks.find(w => w.id === activeWeekId);
  const currentWorkout = currentWeek?.workouts.find(wk => wk.id === activeWorkoutId);

  const metricOrder = ['reps', 'kg', 'rir', 'rmPercentage', 'rest'] as const;

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-black transition-colors relative">
      {/* Overlay Móvil */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Biblioteca */}
      <div className={`w-80 bg-white dark:bg-darkCard border-r border-slate-200 dark:border-slate-800 flex flex-col fixed h-full z-30 transition-transform duration-300 lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight italic uppercase">Biblioteca</h2>
            <button
              onClick={() => {
                setNewExercise({ name: '', videoUrl: '', muscleImage: '', tip: '' });
                setShowLibraryForm(!showLibraryForm);
              }}
              className="p-2.5 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 shadow-md transition-all active:scale-90"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            </button>
          </div>

          {showLibraryForm && (
            <div className="space-y-3 mb-6 bg-slate-50 dark:bg-slate-900 p-5 rounded-[2rem] border-2 border-slate-200 dark:border-slate-800 animate-in slide-in-from-top-4 duration-200">
              <input
                placeholder="Nombre ejercicio"
                className="w-full px-4 py-3 text-sm rounded-xl bg-white dark:bg-black border-2 border-transparent focus:border-blue-500 outline-none font-bold text-slate-800 dark:text-white"
                value={newExercise.name}
                onChange={e => setNewExercise({ ...newExercise, name: e.target.value })}
              />
              <input
                placeholder="URL Video"
                className="w-full px-4 py-3 text-sm rounded-xl bg-white dark:bg-black border-2 border-transparent focus:border-blue-500 outline-none font-medium text-slate-800 dark:text-white"
                value={newExercise.videoUrl}
                onChange={e => setNewExercise({ ...newExercise, videoUrl: e.target.value })}
              />
              <input
                placeholder="URL Foto Músculo (Opcional)"
                className="w-full px-4 py-3 text-sm rounded-xl bg-white dark:bg-black border-2 border-transparent focus:border-blue-500 outline-none font-medium text-slate-800 dark:text-white"
                value={newExercise.muscleImage}
                onChange={e => setNewExercise({ ...newExercise, muscleImage: e.target.value })}
              />
              <textarea
                placeholder="Tip (opcional)"
                className="w-full px-4 py-3 text-sm rounded-xl bg-white dark:bg-black border-2 border-transparent focus:border-blue-500 outline-none h-20 resize-none font-medium"
                value={newExercise.tip}
                onChange={e => setNewExercise({ ...newExercise, tip: e.target.value })}
              />
              <button
                onClick={(e) => {
                  e.preventDefault();
                  if (newExercise.name) {
                    if (newExercise.id) {
                      onEditLibrary(newExercise as Exercise);
                    } else {
                      onAddToLibrary({ id: Math.random().toString(36).substr(2, 9), ...newExercise });
                    }
                    setNewExercise({ name: '', videoUrl: '', muscleImage: '', tip: '' });
                    setShowLibraryForm(false);
                  }
                }}
                className={`w-full py-3 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-colors ${newExercise.id ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {newExercise.id ? 'Actualizar Ejercicio' : 'Guardar Nuevo'}
              </button>
            </div>
          )}

          {/* Search Bar */}
          <div className="mb-4">
            <input
              placeholder="Buscar ejercicio..."
              value={libraryQuery}
              onChange={(e) => setLibraryQuery(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-900 border-2 border-transparent focus:border-blue-500 outline-none text-sm font-bold text-slate-800 dark:text-white"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {library.filter(ex => ex.name.toLowerCase().includes(libraryQuery.toLowerCase())).map(ex => (
            <div key={ex.id} className="p-4 bg-slate-100 dark:bg-slate-800/50 rounded-2xl border-2 border-transparent hover:border-blue-500 transition-all cursor-default group relative flex justify-between items-center">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">{ex.name}</div>
              </div>
              <div className="flex shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setNewExercise({ id: ex.id, name: ex.name, videoUrl: ex.videoUrl || '', muscleImage: ex.muscleImage || '', tip: ex.tip || '' });
                    setShowLibraryForm(true);
                  }}
                  className="p-2 text-slate-300 hover:text-blue-500 transition-all shrink-0"
                  title="Editar ejercicio"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onRemoveFromLibrary(ex.id); }}
                  className="p-2 text-slate-300 hover:text-red-500 transition-all shrink-0"
                  title="Eliminar de la biblioteca"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Builder Area */}
      <div className="flex-1 lg:ml-80 p-4 lg:p-8 pt-20 lg:pt-8">
        <div className="max-w-4xl mx-auto pb-32">

          {/* Mobile Header Toggle */}
          <div className="lg:hidden mb-6 flex items-center justify-between">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-3 bg-white dark:bg-slate-800 rounded-xl shadow-md text-slate-600 dark:text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <h1 className="text-lg font-black uppercase italic tracking-tighter dark:text-white">Constructor</h1>
            <div className="w-10"></div> {/* Spacer */}
          </div>

          {shareLinks && (
            <div className="mb-10 space-y-4 animate-in zoom-in duration-300">
              {/* Client Link */}
              <div className="p-8 bg-green-500 text-white rounded-[2.5rem] shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-black uppercase tracking-widest italic">Link Cliente (Solo Ver)</h3>
                  <button onClick={() => { window.location.hash = `routine/${routine.id}`; onGoToClient(); }} className="px-6 py-3 bg-white text-green-600 rounded-2xl font-black uppercase text-xs">Ir</button>
                </div>
                <div className="bg-white/10 p-4 rounded-2xl flex items-center justify-between gap-4">
                  <p className="text-xs font-bold truncate">{shareLinks.client}</p>
                  <button onClick={() => { navigator.clipboard.writeText(shareLinks.client); alert('Copiado'); }} className="shrink-0 px-4 py-2 bg-white/20 rounded-xl text-[10px] font-black uppercase">Copiar</button>
                </div>
              </div>

              {/* Builder Link */}
              <div className="p-8 bg-slate-800 text-white rounded-[2.5rem] shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-black uppercase tracking-widest italic">Link Coach (Editar)</h3>
                </div>
                <div className="bg-white/10 p-4 rounded-2xl flex items-center justify-between gap-4">
                  <p className="text-xs font-bold truncate">{shareLinks.builder}</p>
                  <button onClick={() => { navigator.clipboard.writeText(shareLinks.builder); alert('Copiado'); }} className="shrink-0 px-4 py-2 bg-white/20 rounded-xl text-[10px] font-black uppercase">Copiar</button>
                </div>
              </div>
            </div>
          )}

          {/* Routine Header */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-10 bg-white dark:bg-darkCard p-6 lg:p-8 rounded-[2rem] lg:rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-6">
              <img src={currentRoutine.image} className="w-16 h-16 lg:w-20 lg:h-20 rounded-[1.5rem] object-cover shadow-lg" alt="" />
              <div>
                <h1 className="text-xl lg:text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase italic">{currentRoutine.name}</h1>
                <p className="text-blue-500 font-black text-[10px] lg:text-xs uppercase tracking-widest mt-1">Para: {currentRoutine.clientName}</p>
              </div>
            </div>
            <button onClick={handleSave} className="w-full lg:w-auto px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs lg:text-sm uppercase tracking-widest hover:scale-105 transition-all shadow-xl">
              Guardar Cambios
            </button>
          </div>

          {/* Metric Selector */}
          <div className="mb-12 flex flex-wrap gap-2 items-center bg-slate-200/50 dark:bg-slate-900 p-3 rounded-[1.5rem] w-fit border border-slate-200 dark:border-slate-800">
            <span className="text-[10px] font-black text-slate-500 uppercase px-3 italic tracking-tighter">Métricas:</span>
            {metricOrder.map(metric => (
              <button
                key={metric}
                onClick={() => setCurrentRoutine({
                  ...currentRoutine,
                  enabledMetrics: { ...currentRoutine.enabledMetrics, [metric]: !currentRoutine.enabledMetrics[metric] }
                })}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${currentRoutine.enabledMetrics[metric] ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
              >
                {metric === 'rmPercentage' ? '% RM' : metric === 'rest' ? 'Descanso' : metric}
              </button>
            ))}
          </div>

          {/* TABS DE SEMANAS */}
          <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide">
            {currentRoutine.weeks.map((week, idx) => (
              <button
                key={week.id}
                onClick={() => setActiveWeekId(week.id)}
                className={`px-8 py-5 rounded-[2rem] font-black uppercase italic text-xs tracking-widest transition-all shrink-0 ${activeWeekId === week.id ? 'bg-blue-600 text-white shadow-xl scale-105' : 'bg-white dark:bg-darkCard text-slate-400 border border-slate-100 dark:border-slate-800'}`}
              >
                {week.name}
              </button>
            ))}
            <button
              onClick={addWeek}
              className="px-6 py-5 bg-slate-200 dark:bg-slate-800 text-slate-500 rounded-[2rem] hover:bg-blue-500 hover:text-white transition-all shrink-0"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
            </button>
          </div>

          {currentWeek ? (
            <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-300">
              {/* Header Semana con Borrar */}
              <div className="flex items-center justify-between">
                <input
                  className="bg-transparent text-4xl font-black text-slate-900 dark:text-white focus:outline-none uppercase italic tracking-tighter"
                  value={currentWeek.name}
                  onChange={e => setCurrentRoutine({
                    ...currentRoutine,
                    weeks: currentRoutine.weeks.map(w => w.id === currentWeek.id ? { ...w, name: e.target.value } : w)
                  })}
                />
                <button
                  onClick={() => deleteWeek(currentWeek.id)}
                  className="p-4 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-[1.5rem] transition-all flex items-center gap-2 font-black text-[10px] uppercase italic"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  Borrar Semana
                </button>
                <button
                  onClick={() => duplicateWeek(currentWeek.id)}
                  className="p-4 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 rounded-[1.5rem] transition-all flex items-center gap-2 font-black text-[10px] uppercase italic"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                  Duplicar Semana
                </button>
              </div>

              {/* TABS DE DÍAS (HORIZONTALES) */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-8 scrollbar-hide">
                {currentWeek.workouts.map(workout => (
                  <button
                    key={workout.id}
                    onClick={() => setActiveWorkoutId(workout.id)}
                    className={`px-6 py-4 rounded-[1.5rem] font-black uppercase italic text-[10px] tracking-widest transition-all shrink-0 ${activeWorkoutId === workout.id ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-black shadow-lg' : 'bg-slate-100 dark:bg-slate-900 text-slate-400'}`}
                  >
                    {workout.name}
                  </button>
                ))}
                <button
                  onClick={() => addWorkout(currentWeek.id)}
                  className="px-6 py-4 border-2 border-dashed border-slate-300 dark:border-slate-800 text-slate-400 rounded-[1.5rem] font-black text-[10px] uppercase italic hover:border-blue-500 hover:text-blue-500 transition-all shrink-0"
                >
                  + Agregar Día
                </button>
              </div>

              {currentWorkout ? (
                <div className="bg-white dark:bg-darkCard rounded-[3rem] border-2 border-slate-100 dark:border-slate-800 p-10 shadow-sm animate-in zoom-in-95 duration-200">
                  <div className="flex justify-between items-center mb-10">
                    <input
                      className="bg-transparent font-black text-2xl text-slate-800 dark:text-slate-100 focus:outline-none uppercase italic"
                      value={currentWorkout.name}
                      onChange={e => setCurrentRoutine({
                        ...currentRoutine,
                        weeks: currentRoutine.weeks.map(w => w.id === currentWeek.id ? { ...w, workouts: w.workouts.map(wk => wk.id === currentWorkout.id ? { ...wk, name: e.target.value } : wk) } : w)
                      })}
                    />
                    <button
                      onClick={() => deleteWorkout(currentWeek.id, currentWorkout.id)}
                      className="p-3 text-red-400 hover:text-red-600 transition-all flex items-center gap-2 font-black text-[10px] uppercase italic"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      Borrar Día
                    </button>
                  </div>

                  <div className="mb-10 p-6 bg-orange-50/30 dark:bg-orange-900/10 rounded-[2rem] border-2 border-dashed border-orange-100/50 dark:border-orange-500/20">
                    <textarea
                      placeholder="Instrucciones del día (calentamiento, foco, etc.)..."
                      className="w-full bg-transparent p-2 rounded-2xl text-sm font-medium outline-none h-20 text-slate-700 dark:text-slate-300 italic"
                      value={currentWorkout.warmup || ''}
                      onChange={(e) => setCurrentRoutine({
                        ...currentRoutine,
                        weeks: currentRoutine.weeks.map(w => w.id === currentWeek.id ? { ...w, workouts: w.workouts.map(wk => wk.id === currentWorkout.id ? { ...wk, warmup: e.target.value } : wk) } : w)
                      })}
                    />
                  </div>

                  <div className="space-y-16">
                    {currentWorkout.exercises.map(entry => {
                      const libEx = library.find(l => l.id === entry.libraryExerciseId);
                      return (
                        <div key={entry.id} className="relative group/ex">
                          <div className="flex justify-between items-center mb-6 border-b-2 border-slate-50 dark:border-slate-800 pb-4">
                            <div className="flex items-center gap-4">
                              <span className="font-black text-xl text-slate-900 dark:text-white uppercase italic tracking-tighter">{libEx?.name || 'Cargando...'}</span>
                            </div>
                            <button onClick={() => deleteExercise(currentWeek.id, currentWorkout.id, entry.id)} className="text-slate-300 hover:text-red-500 transition-all">
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>

                          <div className="overflow-x-auto mb-6">
                            <table className="w-full text-center">
                              <thead>
                                <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 dark:border-slate-800">
                                  <th className="py-2 w-10">SET</th>
                                  {currentRoutine.enabledMetrics.reps && <th className="py-2">REPS</th>}
                                  {currentRoutine.enabledMetrics.kg && <th className="py-2">KG</th>}
                                  {currentRoutine.enabledMetrics.rir && <th className="py-2">RIR</th>}
                                  {currentRoutine.enabledMetrics.rmPercentage && <th className="py-2">% RM</th>}
                                  {currentRoutine.enabledMetrics.rest && <th className="py-2">DESC.</th>}
                                  <th className="w-10"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {entry.sets.map((set, idx) => (
                                  <tr key={set.id}>
                                    <td className="py-4">
                                      <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center text-[10px] font-black text-slate-500 mx-auto">{idx + 1}</div>
                                    </td>
                                    {currentRoutine.enabledMetrics.reps && (
                                      <td><input className="w-14 py-3 text-center bg-slate-50 dark:bg-black rounded-xl font-bold dark:text-white border-2 border-transparent focus:border-blue-500 outline-none" value={set.reps} onChange={e => updateSet(currentWeek.id, currentWorkout.id, entry.id, set.id, 'reps', e.target.value)} /></td>
                                    )}
                                    {currentRoutine.enabledMetrics.kg && (
                                      <td><input className="w-14 py-3 text-center bg-slate-50 dark:bg-black rounded-xl font-bold dark:text-white border-2 border-transparent focus:border-blue-500 outline-none" value={set.kg} onChange={e => updateSet(currentWeek.id, currentWorkout.id, entry.id, set.id, 'kg', e.target.value)} /></td>
                                    )}
                                    {currentRoutine.enabledMetrics.rir && (
                                      <td><input className="w-14 py-3 text-center bg-slate-50 dark:bg-black rounded-xl font-bold dark:text-white border-2 border-transparent focus:border-blue-500 outline-none" value={set.rir} onChange={e => updateSet(currentWeek.id, currentWorkout.id, entry.id, set.id, 'rir', e.target.value)} /></td>
                                    )}
                                    {currentRoutine.enabledMetrics.rmPercentage && (
                                      <td><input className="w-14 py-3 text-center bg-slate-50 dark:bg-black rounded-xl font-bold dark:text-white border-2 border-transparent focus:border-blue-500 outline-none" value={set.rmPercentage} onChange={e => updateSet(currentWeek.id, currentWorkout.id, entry.id, set.id, 'rmPercentage', e.target.value)} /></td>
                                    )}
                                    {currentRoutine.enabledMetrics.rest && (
                                      <td><input className="w-16 py-3 text-center bg-slate-50 dark:bg-black rounded-xl font-bold dark:text-white border-2 border-transparent focus:border-blue-500 outline-none" value={set.rest} onChange={e => updateSet(currentWeek.id, currentWorkout.id, entry.id, set.id, 'rest', e.target.value)} /></td>
                                    )}
                                    <td>
                                      <button onClick={() => deleteSet(currentWeek.id, currentWorkout.id, entry.id, set.id)} className="text-slate-200 hover:text-red-500 transition-all">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <button
                            onClick={() => addSet(currentWeek.id, currentWorkout.id, entry.id)}
                            className="w-full py-4 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-300 hover:border-blue-500 hover:text-blue-500 transition-all active:scale-[0.98]"
                          >
                            + Agregar Serie
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-16">
                    <ExerciseSearch library={library} onSelect={(id) => addExerciseToWorkout(currentWeek.id, currentWorkout.id, id)} />
                  </div>
                </div>
              ) : (
                <div className="text-center py-20 bg-white dark:bg-darkCard rounded-[3rem] border-2 border-dashed border-slate-100 dark:border-slate-800">
                  <p className="font-black text-slate-400 uppercase tracking-widest text-sm italic mb-6">No hay días creados en esta semana</p>
                  <button onClick={() => addWorkout(currentWeek.id)} className="px-10 py-5 bg-blue-600 text-white rounded-3xl font-black uppercase tracking-widest italic hover:scale-105 transition-all shadow-xl">Empezar Día 1</button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-40">
              <p className="font-black text-slate-300 dark:text-slate-700 uppercase tracking-widest text-2xl italic mb-10">Tu programa está vacío</p>
              <button onClick={addWeek} className="px-12 py-6 bg-blue-600 text-white rounded-[2rem] font-black uppercase tracking-widest italic hover:scale-110 transition-all shadow-2xl">Crear Semana 1</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Componente de Búsqueda Mejorado
const ExerciseSearch: React.FC<{ library: Exercise[], onSelect: (id: string) => void }> = ({ library, onSelect }) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const filtered = query.length >= 3
    ? library.filter(e => e.name.toLowerCase().includes(query.toLowerCase()))
    : [];

  return (
    <div className="relative">
      <div className="flex items-center w-full px-8 py-5 bg-slate-900 dark:bg-black border border-slate-800 rounded-[2rem] text-white font-black uppercase text-[10px] tracking-widest shadow-2xl group">
        <svg className="w-5 h-5 mr-4 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
        <input
          placeholder="Escribe 3 letras para buscar ejercicio..."
          className="bg-transparent outline-none w-full placeholder:text-slate-600"
          value={query}
          onChange={e => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
        />
      </div>

      {isOpen && query.length >= 3 && (
        <div className="absolute bottom-full left-0 w-full mb-4 bg-white dark:bg-darkCard border-2 border-slate-100 dark:border-slate-800 rounded-[2.5rem] shadow-2xl z-50 max-h-72 overflow-y-auto p-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
          {filtered.length > 0 ? filtered.map(ex => (
            <div
              key={ex.id}
              className="p-5 hover:bg-blue-600 hover:text-white cursor-pointer rounded-2xl text-sm font-black text-slate-800 dark:text-slate-100 transition-all flex items-center justify-between uppercase italic"
              onClick={() => {
                onSelect(ex.id);
                setQuery('');
                setIsOpen(false);
              }}
            >
              <span>{ex.name}</span>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            </div>
          )) : (
            <div className="p-8 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest italic">No se encontraron resultados</div>
          )}
        </div>
      )}
    </div>
  );
}

export default RoutineBuilder;
