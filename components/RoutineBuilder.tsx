
import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
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
  const [currentRoutine, setCurrentRoutine] = useState<Routine>(() => ({
    ...routine,
    enabledMetrics: routine.enabledMetrics || { reps: true, kg: true, rir: true, rmPercentage: false, rest: true, tempo: false }
  }));
  const [showLibraryForm, setShowLibraryForm] = useState(false);
  const [newExercise, setNewExercise] = useState<{ id?: string, name: string, videoUrl: string, muscleImage: string, tip: string }>({ name: '', videoUrl: '', muscleImage: '', tip: '' });
  const [shareLinks, setShareLinks] = useState<{ client: string, builder: string } | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [libraryQuery, setLibraryQuery] = useState('');

  // Navegación por ID
  const [activeWeekId, setActiveWeekId] = useState<string | null>(routine.weeks[0]?.id || null);
  const [activeWorkoutId, setActiveWorkoutId] = useState<string | null>(null);

  // Superset Creator Modal
  const [showSupersetModal, setShowSupersetModal] = useState(false);
  const [supersetForm, setSupersetForm] = useState<{ ex1Id: string | null, ex2Id: string | null, rest: string }>({ ex1Id: null, ex2Id: null, rest: '2:00' });

  // Sincronizar el estado local cuando la rutina inicial cambia (por ejemplo, al terminar la carga de la base de datos)
  useEffect(() => {
    setCurrentRoutine({
      ...routine,
      enabledMetrics: routine.enabledMetrics || { reps: true, kg: true, rir: true, rmPercentage: false, rest: true, tempo: false }
    });
  }, [routine]);

  // Asegurar que activeWeekId sea válido y no quede en null si hay semanas disponibles
  useEffect(() => {
    if (!activeWeekId || !currentRoutine.weeks.some(w => w.id === activeWeekId)) {
      if (currentRoutine.weeks.length > 0) {
        setActiveWeekId(currentRoutine.weeks[0].id);
      }
    }
  }, [currentRoutine.weeks, activeWeekId]);

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

  const onDragEnd = (result: any) => {
    if (!result.destination) return;
    if (result.source.index === result.destination.index) return;
    if (!activeWeekId || !activeWorkoutId) return;

    setCurrentRoutine({
      ...currentRoutine,
      weeks: currentRoutine.weeks.map(w => {
        if (w.id === activeWeekId) {
          return {
            ...w,
            workouts: w.workouts.map(wk => {
              if (wk.id === activeWorkoutId) {
                // 1. Replicar la misma lógica de "processedExercises" de la UI
                const groups: { type: 'single' | 'superset', exercises: ExerciseEntry[], id: string }[] = [];
                const processedIds = new Set<string>();

                wk.exercises.forEach(ex => {
                  if (processedIds.has(ex.id)) return;
                  if (ex.supersetLabel) {
                    const group = wk.exercises.filter(e => e.supersetLabel === ex.supersetLabel);
                    groups.push({ type: 'superset', exercises: group, id: `group-${ex.supersetLabel}` });
                    group.forEach(ge => processedIds.add(ge.id));
                  } else {
                    groups.push({ type: 'single', exercises: [ex], id: ex.id });
                    processedIds.add(ex.id);
                  }
                });

                // 2. Reordenar los grupos (no los ejercicios individuales sueltos)
                const newGroups = Array.from(groups);
                const [reorderedGroup] = newGroups.splice(result.source.index, 1);
                newGroups.splice(result.destination.index, 0, reorderedGroup);

                // 3. Aplanar de vuelta a la lista flat con el nuevo orden
                const newExercises = newGroups.flatMap(g => g.exercises);
                
                return { ...wk, exercises: newExercises };
              }
              return wk;
            })
          };
        }
        return w;
      })
    });
  };

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

  const updateExerciseSuperset = (weekId: string, workoutId: string, entryId: string, fields: Partial<ExerciseEntry>) => {
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
                      return { ...ex, ...fields };
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

  const addDropset = (weekId: string, workoutId: string, entryId: string, setId: string) => {
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
                      return {
                        ...ex,
                        sets: ex.sets.map(s => {
                          if (s.id === setId) {
                            const newDropset = { id: Math.random().toString(36).substr(2, 9), reps: '10', kg: '0' };
                            return { ...s, dropsets: [...(s.dropsets || []), newDropset] };
                          }
                          return s;
                        })
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

  const updateDropset = (weekId: string, workoutId: string, entryId: string, setId: string, dropsetId: string, field: 'reps' | 'kg', value: string) => {
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
                      return {
                        ...ex,
                        sets: ex.sets.map(s => {
                          if (s.id === setId) {
                            return {
                              ...s,
                              dropsets: s.dropsets?.map(ds => ds.id === dropsetId ? { ...ds, [field]: value } : ds)
                            };
                          }
                          return s;
                        })
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

  const deleteDropset = (weekId: string, workoutId: string, entryId: string, setId: string, dropsetId: string) => {
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
                      return {
                        ...ex,
                        sets: ex.sets.map(s => {
                          if (s.id === setId) {
                            return { ...s, dropsets: s.dropsets?.filter(ds => ds.id !== dropsetId) };
                          }
                          return s;
                        })
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

  const currentWeek = currentRoutine.weeks.find(w => w.id === activeWeekId);
  const currentWorkout = currentWeek?.workouts.find(wk => wk.id === activeWorkoutId);

  const metricOrder = ['reps', 'kg', 'rir', 'rmPercentage', 'tempo', 'rest'] as const;

  return (
    <div className="flex min-h-screen bg-slate-100 dark:bg-black transition-colors relative">
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
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Biblioteca</h2>
            <button
              onClick={() => {
                setNewExercise({ name: '', videoUrl: '', muscleImage: '', tip: '' });
                setShowLibraryForm(!showLibraryForm);
              }}
              className="p-2.5 bg-yellow-400 text-black rounded-2xl hover:bg-yellow-500 shadow-md transition-all active:scale-90"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            </button>
          </div>

          {showLibraryForm && (
            <div className="space-y-3 mb-6 bg-slate-100 dark:bg-slate-900 p-5 rounded-[2rem] border-2 border-slate-200 dark:border-slate-800 animate-in slide-in-from-top-4 duration-200">
              <input
                placeholder="Nombre ejercicio"
                className="w-full px-4 py-3 text-sm rounded-xl bg-white dark:bg-black border-2 border-transparent focus:border-yellow-600 outline-none font-bold text-slate-800 dark:text-white"
                value={newExercise.name}
                onChange={e => setNewExercise({ ...newExercise, name: e.target.value })}
              />
              <input
                placeholder="URL Video"
                className="w-full px-4 py-3 text-sm rounded-xl bg-white dark:bg-black border-2 border-transparent focus:border-yellow-600 outline-none font-medium text-slate-800 dark:text-white"
                value={newExercise.videoUrl}
                onChange={e => setNewExercise({ ...newExercise, videoUrl: e.target.value })}
              />
              <input
                placeholder="URL Foto Músculo (Opcional)"
                className="w-full px-4 py-3 text-sm rounded-xl bg-white dark:bg-black border-2 border-transparent focus:border-yellow-600 outline-none font-medium text-slate-800 dark:text-white"
                value={newExercise.muscleImage}
                onChange={e => setNewExercise({ ...newExercise, muscleImage: e.target.value })}
              />
              <textarea
                placeholder="Tip (opcional)"
                className="w-full px-4 py-3 text-sm rounded-xl bg-white dark:bg-black border-2 border-transparent focus:border-yellow-600 outline-none h-20 resize-none font-medium"
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
                className={`w-full py-3 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-colors ${newExercise.id ? 'bg-green-600 hover:bg-green-700' : 'bg-yellow-400 text-black hover:bg-yellow-500'}`}
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
              className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-900 border-2 border-transparent focus:border-yellow-600 outline-none text-sm font-bold text-slate-800 dark:text-white"
            />
          </div>
               <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {library.filter(ex => ex.name.toLowerCase().includes(libraryQuery.toLowerCase())).map(ex => (
            <div 
              key={ex.id}
              className="p-4 bg-slate-100 dark:bg-slate-800/50 rounded-2xl border-2 border-transparent hover:border-yellow-600 transition-all cursor-pointer group relative flex justify-between items-center text-slate-800 dark:text-slate-100"
              onClick={() => {
                if (!activeWeekId || !activeWorkoutId) {
                  alert('Primero selecciona una semana y un día');
                  return;
                }
                addExerciseToWorkout(activeWeekId, activeWorkoutId, ex.id);
              }}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="font-bold text-sm truncate">{ex.name}</div>
              </div>
              <div className="flex shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setNewExercise({ id: ex.id, name: ex.name, videoUrl: ex.videoUrl || '', muscleImage: ex.muscleImage || '', tip: ex.tip || '' });
                    setShowLibraryForm(true);
                  }}
                  className="p-2 text-slate-950 dark:text-white hover:text-yellow-600 transition-all shrink-0"
                  title="Editar ejercicio"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onRemoveFromLibrary(ex.id); }}
                  className="p-2 text-slate-950 dark:text-white hover:text-red-500 transition-all shrink-0"
                  title="Eliminar de la biblioteca"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
   </div>
      </div>

      {/* Main Builder Area */}
      <div className="flex-1 lg:ml-80 p-4 lg:p-8 pt-20 lg:pt-8">
        <div className="max-w-4xl mx-auto pb-32">

          {/* Mobile Header Toggle */}
          <div className="lg:hidden mb-6 flex items-center justify-between">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-3 bg-white dark:bg-slate-800 rounded-xl shadow-md text-slate-950 dark:text-white dark:text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <h1 className="text-lg font-black uppercase tracking-tighter dark:text-white">Constructor</h1>
            <div className="w-10"></div> {/* Spacer */}
          </div>

          {shareLinks && (
            <div className="mb-10 space-y-4 animate-in zoom-in duration-300">
              {/* Client Link */}
              <div className="p-8 bg-green-500 text-white rounded-[2.5rem] shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-black uppercase tracking-widest">Link Cliente (Solo Ver)</h3>
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
                  <h3 className="text-xl font-black uppercase tracking-widest">Link Coach (Editar)</h3>
                </div>
                <div className="bg-white/10 p-4 rounded-2xl flex items-center justify-between gap-4">
                  <p className="text-xs font-bold truncate">{shareLinks.builder}</p>
                  <button onClick={() => { navigator.clipboard.writeText(shareLinks.builder); alert('Copiado'); }} className="shrink-0 px-4 py-2 bg-white/20 rounded-xl text-[10px] font-black uppercase">Copiar</button>
                </div>
              </div>
            </div>
          )}

          {/* Routine Header (Editables: Nombre, Alumno, Descripción) */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-10 bg-white dark:bg-darkCard p-6 lg:p-10 rounded-[3rem] shadow-xl border border-slate-100 dark:border-slate-800 transition-all focus-within:ring-2 focus-within:ring-yellow-500/20">
            <div className="flex items-center gap-8 w-full lg:flex-1">
              <div className="relative group/img cursor-pointer">
                <img src={currentRoutine.image} className="w-20 h-20 lg:w-24 lg:h-24 rounded-[1.5rem] object-cover shadow-lg border-2 border-slate-100 dark:border-slate-800" alt="" />
                <div className="absolute inset-0 bg-black/40 rounded-[1.5rem] flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
              </div>
              
              <div className="flex-1 space-y-3">
                <input
                  className="w-full bg-transparent text-2xl lg:text-3xl font-black text-slate-950 dark:text-white focus:outline-none uppercase tracking-tighter"
                  value={currentRoutine.name}
                  onChange={e => setCurrentRoutine({ ...currentRoutine, name: e.target.value })}
                  placeholder="NOMBRE DE LA RUTINA"
                />
                <div className="flex items-center gap-3">
                  <span className="text-yellow-600 font-black text-[10px] uppercase tracking-widest bg-yellow-500/10 px-3 py-1 rounded-lg">PARA</span>
                  <input
                    className="flex-1 bg-transparent text-yellow-600 font-black text-xs lg:text-sm uppercase tracking-widest focus:outline-none border-b border-transparent focus:border-yellow-500/30 pb-0.5"
                    value={currentRoutine.clientName}
                    onChange={e => setCurrentRoutine({ ...currentRoutine, clientName: e.target.value })}
                    placeholder="NOMBRE DEL ASESORADO"
                  />
                </div>
                <textarea
                  className="w-full bg-transparent text-slate-500 dark:text-slate-400 font-medium text-xs lg:text-sm focus:outline-none border-l-2 border-slate-100 dark:border-slate-800 pl-4 py-1 h-auto resize-none overflow-hidden"
                  rows={2}
                  value={currentRoutine.description || ''}
                  onChange={e => {
                    setCurrentRoutine({ ...currentRoutine, description: e.target.value });
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                  }}
                  placeholder="Descripción de la rutina (objetivos, duración, frecuencia...)"
                />
              </div>
            </div>
            
            <button 
              onClick={handleSave} 
              className="w-full lg:w-auto px-10 py-5 bg-yellow-400 text-black rounded-[1.5rem] font-black text-xs lg:text-sm uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-yellow-500/20 active:shadow-inner flex items-center justify-center gap-3"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
              Guardar Cambios
            </button>
          </div>

          {/* Metric Selector */}
          <div className="mb-12 flex flex-wrap gap-2 items-center bg-slate-200/50 dark:bg-slate-900 p-3 rounded-[1.5rem] w-fit border border-slate-200 dark:border-slate-800">
            <span className="text-[10px] font-black text-slate-900 dark:text-slate-200 uppercase px-3 tracking-tighter">Métricas:</span>
            {metricOrder.map(metric => (
              <button
                key={metric}
                onClick={() => setCurrentRoutine({
                  ...currentRoutine,
                  enabledMetrics: { ...currentRoutine.enabledMetrics, [metric]: !currentRoutine.enabledMetrics[metric] }
                })}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${currentRoutine.enabledMetrics[metric] ? 'bg-yellow-400 text-black shadow-md' : 'text-slate-950 dark:text-white hover:text-slate-950 dark:text-white dark:hover:text-slate-200'}`}
              >
                {metric === 'rmPercentage' ? '% RM' : metric === 'rest' ? 'Descanso' : metric}
              </button>
            ))}
          </div>

          {/* TABS DE SEMANAS (AHORA DROPBOX) */}
          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <div className="relative group flex-1">
              <label className="text-[10px] font-black text-slate-950 dark:text-slate-200 uppercase tracking-widest ml-4 mb-2 block">Seleccionar Semana</label>
              <select
                value={activeWeekId || ''}
                onChange={(e) => setActiveWeekId(e.target.value)}
                className="w-full bg-white dark:bg-darkCard px-8 py-5 rounded-[2rem] font-black uppercase text-sm tracking-widest border border-slate-100 dark:border-slate-800 shadow-xl appearance-none cursor-pointer focus:border-yellow-600 transition-all outline-none text-slate-950 dark:text-white"
              >
                {currentRoutine.weeks.map((week) => (
                  <option key={week.id} value={week.id}>{week.name}</option>
                ))}
              </select>
              <div className="absolute right-6 bottom-5 pointer-events-none text-yellow-600">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z" /></svg>
              </div>
            </div>
            <button
              onClick={addWeek}
              className="px-8 py-5 bg-white dark:bg-slate-800 text-slate-950 dark:text-white border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[2rem] hover:border-yellow-600 hover:text-yellow-600 transition-all font-black uppercase text-[10px] tracking-widest h-[66px] flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
              NUEVA SEMANA
            </button>
          </div>

          {currentWeek ? (
            <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-300">
              {/* Header Semana con Borrar */}
              <div className="flex items-center justify-between">
                <input
                  className="bg-transparent text-4xl font-black text-slate-900 dark:text-white focus:outline-none uppercase tracking-tighter"
                  value={currentWeek.name}
                  onChange={e => setCurrentRoutine({
                    ...currentRoutine,
                    weeks: currentRoutine.weeks.map(w => w.id === currentWeek.id ? { ...w, name: e.target.value } : w)
                  })}
                />
                <button
                  onClick={() => deleteWeek(currentWeek.id)}
                  className="p-4 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-[1.5rem] transition-all flex items-center gap-2 font-black text-[10px] uppercase"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  Borrar Semana
                </button>
                <button
                  onClick={() => duplicateWeek(currentWeek.id)}
                  className="p-4 text-yellow-600 hover:bg-yellow-500 dark:hover:bg-blue-900/10 rounded-[1.5rem] transition-all flex items-center gap-2 font-black text-[10px] uppercase"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                  Duplicar Semana
                </button>
              </div>

              {/* TABS DE DÍAS (AHORA DROPBOX) */}
              <div className="flex flex-col md:flex-row gap-4 mb-10">
                <div className="relative group flex-1">
                  <label className="text-[10px] font-black text-slate-950 dark:text-slate-200 uppercase tracking-widest ml-4 mb-2 block">Seleccionar Día</label>
                  <select
                    value={activeWorkoutId || ''}
                    onChange={(e) => setActiveWorkoutId(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-slate-900/50 px-8 py-5 rounded-[2rem] font-black uppercase text-xs tracking-widest border border-transparent focus:border-yellow-600 transition-all outline-none text-slate-950 dark:text-white appearance-none cursor-pointer shadow-inner"
                  >
                    {currentWeek.workouts.map(workout => (
                      <option key={workout.id} value={workout.id}>{workout.name}</option>
                    ))}
                  </select>
                  <div className="absolute right-6 bottom-5 pointer-events-none text-yellow-600">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z" /></svg>
                  </div>
                </div>
                <button
                  onClick={() => addWorkout(currentWeek.id)}
                  className="px-8 py-5 border-2 border-dashed border-slate-300 dark:border-slate-800 text-slate-950 dark:text-white rounded-[2rem] font-black text-[10px] uppercase hover:border-yellow-600 hover:text-yellow-600 transition-all flex items-center justify-center gap-2 h-[66px]"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
                  AGREGAR DÍA
                </button>
              </div>

              {currentWorkout ? (
                <div className="bg-white dark:bg-darkCard rounded-[3rem] border-2 border-slate-100 dark:border-slate-800 p-10 shadow-sm animate-in zoom-in-95 duration-200">
                  <div className="flex justify-between items-center mb-10">
                    <input
                      className="bg-transparent font-black text-2xl text-slate-800 dark:text-slate-100 focus:outline-none uppercase"
                      value={currentWorkout.name}
                      onChange={e => setCurrentRoutine({
                        ...currentRoutine,
                        weeks: currentRoutine.weeks.map(w => w.id === currentWeek.id ? { ...w, workouts: w.workouts.map(wk => wk.id === currentWorkout.id ? { ...wk, name: e.target.value } : wk) } : w)
                      })}
                    />
                    <button
                      onClick={() => deleteWorkout(currentWeek.id, currentWorkout.id)}
                      className="p-3 text-red-400 hover:text-red-600 transition-all flex items-center gap-2 font-black text-[10px] uppercase"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      Borrar Día
                    </button>
                  </div>

                  <div className="mb-10 p-6 bg-orange-50/30 dark:bg-orange-500/10 rounded-[2rem] border-2 border-dashed border-orange-200/50 dark:border-orange-500/40 transition-all focus-within:border-orange-500">
                    <textarea
                      placeholder="Instrucciones del día (calentamiento, foco, etc.)..."
                      className="w-full bg-transparent p-2 rounded-2xl text-sm font-black outline-none h-20 text-slate-700 dark:text-white placeholder:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white"
                      value={currentWorkout.warmup || ''}
onChange={(e) => setCurrentRoutine({
                        ...currentRoutine,
                        weeks: currentRoutine.weeks.map(w => w.id === currentWeek.id ? { ...w, workouts: w.workouts.map(wk => wk.id === currentWorkout.id ? { ...wk, warmup: e.target.value } : wk) } : w)
                      })}
                    />
                  </div>

                  <DragDropContext onDragEnd={onDragEnd}>
                    <Droppable droppableId="exercises-list">
                      {(provided) => {
                        const processedExercises: { type: 'single' | 'superset', exercises: ExerciseEntry[], id: string }[] = [];
                        const processedIds = new Set<string>();

                        currentWorkout.exercises.forEach(ex => {
                          if (processedIds.has(ex.id)) return;
                          
                          if (ex.supersetLabel) {
                            const group = currentWorkout.exercises.filter(e => e.supersetLabel === ex.supersetLabel);
                            processedExercises.push({ type: 'superset', exercises: group, id: `group-${ex.supersetLabel}` });
                            group.forEach(ge => processedIds.add(ge.id));
                          } else {
                            processedExercises.push({ type: 'single', exercises: [ex], id: ex.id });
                            processedIds.add(ex.id);
                          }
                        });

                        return (
                          <div 
                            className="space-y-16"
                            {...provided.droppableProps}
                            ref={provided.innerRef}
                          >
                            {processedExercises.map((group, groupIndex) => (
                              <Draggable key={group.id} draggableId={group.id} index={groupIndex}>
                                {(provided) => {
                                  return (
                                    <div 
                                      className={`relative group/ex p-8 rounded-2xl border-2 transition-all ${
                                        group.type === 'superset' 
                                          ? 'bg-yellow-50/30 dark:bg-yellow-900/5 border-yellow-100 dark:border-yellow-900/30 shadow-lg shadow-yellow-500/5' 
                                          : 'bg-white dark:bg-darkCard border-slate-100 dark:border-slate-800 shadow-sm'
                                      }`}
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                    >
                                      <div className="absolute left-4 top-1/2 -translate-y-1/2 opacity-0 group-hover/ex:opacity-100 transition-opacity">
                                        <div {...provided.dragHandleProps} className="p-2 text-slate-950 dark:text-white hover:text-yellow-500 cursor-grab active:cursor-grabbing">
                                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 8h16M4 16h16" /></svg>
                                        </div>
                                      </div>

                                      {group.type === 'superset' && (
                                        <div className="flex items-center gap-2 mb-8 ml-6">
                                          <div className="px-4 py-1.5 bg-yellow-400 text-black rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">SUPERSERIE {group.exercises[0].supersetLabel}</div>
                                          <div className="h-[2px] flex-1 bg-gradient-to-r from-yellow-500 to-transparent dark:from-blue-900/50"></div>
                                        </div>
                                      )}

                                      <div className="space-y-10 ml-6">
                                        {group.exercises.map((entry, entryIdx) => {
                                          const libEx = library.find(l => l.id === entry.libraryExerciseId);
                                          return (
                                            <div key={entry.id} className={`${entryIdx > 0 ? 'pt-10 border-t border-blue-100/50 dark:border-blue-900/20' : ''}`}>
                                              <div className="flex justify-between items-center mb-6">
                                                <div className="flex items-center gap-4">
                                                  {group.type === 'superset' && (
                                                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-[10px] font-black text-yellow-400 text-black">
                                                      {entryIdx + 1}
                                                    </div>
                                                  )}
                                                  <span className="font-black text-xl text-slate-900 dark:text-white uppercase tracking-tighter">
                                                    {libEx?.name || 'Cargando...'}
                                                  </span>
                                                </div>
                                                <button 
                                                  onClick={() => deleteExercise(currentWeek.id, currentWorkout.id, entry.id)} 
                                                  className="text-slate-950 dark:text-white hover:text-red-500 transition-all"
                                                >
                                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                                                </button>
                                              </div>

                                              <div className="overflow-x-auto mb-6 -mx-4 px-4 lg:mx-0 lg:px-0 w-[100vw] lg:w-full">
                                                <table className="w-full text-center table-auto min-w-max">
                                                  <thead>
                                                    <tr className="text-[9px] font-black text-slate-950 dark:text-slate-200 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                                                      {currentRoutine.enabledMetrics.reps && <th className="py-2">REPS</th>}
                                                      {currentRoutine.enabledMetrics.kg && <th className="py-2">KG</th>}
                                                      {currentRoutine.enabledMetrics.rir && <th className="py-2">RIR</th>}
                                                      {currentRoutine.enabledMetrics.rmPercentage && <th className="py-2">% RM</th>}
                                                      {currentRoutine.enabledMetrics.tempo && <th className="py-2">TEMPO</th>}
                                                      {currentRoutine.enabledMetrics.rest && (
                                                        <th className="py-2">
                                                          {group.type === 'superset' ? (entryIdx === 0 ? '' : 'DESC.') : 'DESC.'}
                                                        </th>
                                                      )}
                                                      <th className="py-2">DROP</th>
                                                      <th className="w-10"></th>
                                                    </tr>
                                                  </thead>
                                                  <tbody>
                                                    {entry.sets.map((set, idx) => (
                                                      <React.Fragment key={set.id}>
                                                        <tr>
                                                          {currentRoutine.enabledMetrics.reps && (
                                                            <td><input className="w-14 py-3 text-center bg-slate-100 dark:bg-black rounded-xl font-bold dark:text-white border-2 border-transparent focus:border-yellow-600 outline-none" value={set.reps} onChange={e => updateSet(currentWeek.id, currentWorkout.id, entry.id, set.id, 'reps', e.target.value)} /></td>
                                                          )}
                                                          {currentRoutine.enabledMetrics.kg && (
                                                            <td><input className="w-14 py-3 text-center bg-slate-100 dark:bg-black rounded-xl font-bold dark:text-white border-2 border-transparent focus:border-yellow-600 outline-none" value={set.kg} onChange={e => updateSet(currentWeek.id, currentWorkout.id, entry.id, set.id, 'kg', e.target.value)} /></td>
                                                          )}
                                                          {currentRoutine.enabledMetrics.rir && (
                                                            <td><input className="w-14 py-3 text-center bg-slate-100 dark:bg-black rounded-xl font-bold dark:text-white border-2 border-transparent focus:border-yellow-600 outline-none" value={set.rir} onChange={e => updateSet(currentWeek.id, currentWorkout.id, entry.id, set.id, 'rir', e.target.value)} /></td>
                                                          )}
                                                          {currentRoutine.enabledMetrics.rmPercentage && (
                                                            <td><input className="w-14 py-3 text-center bg-slate-100 dark:bg-black rounded-xl font-bold dark:text-white border-2 border-transparent focus:border-yellow-600 outline-none" value={set.rmPercentage} onChange={e => updateSet(currentWeek.id, currentWorkout.id, entry.id, set.id, 'rmPercentage', e.target.value)} /></td>
                                                          )}
                                                          {currentRoutine.enabledMetrics.tempo && (
                                                            <td><input className="w-16 py-3 text-center bg-slate-100 dark:bg-black rounded-xl font-bold dark:text-white border-2 border-transparent focus:border-yellow-600 outline-none placeholder:font-normal placeholder:text-slate-300 dark:placeholder:text-slate-700" value={set.tempo || ''} placeholder="ej: 3-1-1" onChange={e => updateSet(currentWeek.id, currentWorkout.id, entry.id, set.id, 'tempo', e.target.value)} /></td>
                                                          )}
                                                          {currentRoutine.enabledMetrics.rest && (
                                                            <td>
                                                              {group.type === 'superset' && entryIdx === 0 ? (
                                                                <span className="text-[9px] font-black text-slate-950 dark:text-white">0:10</span>
                                                              ) : (
                                                                <input className="w-14 py-3 text-center bg-slate-100 dark:bg-black rounded-xl font-bold dark:text-white border-2 border-transparent focus:border-yellow-600 outline-none" value={set.rest} onChange={e => updateSet(currentWeek.id, currentWorkout.id, entry.id, set.id, 'rest', e.target.value)} />
                                                              )}
                                                            </td>
                                                          )}
                                                          <td>
                                                            <button 
                                                              onClick={() => addDropset(currentWeek.id, currentWorkout.id, entry.id, set.id)}
                                                              className="p-2 text-orange-400 hover:text-orange-600 transition-all"
                                                            >
                                                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                                                            </button>
                                                          </td>
                                                          <td>
                                                            <button onClick={() => deleteSet(currentWeek.id, currentWorkout.id, entry.id, set.id)} className="text-slate-200 hover:text-red-500 transition-all">
                                                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                                                            </button>
                                                          </td>
                                                        </tr>
                                                        {set.dropsets?.map((ds, dsIdx) => (
                                                          <tr key={ds.id} className="bg-orange-50/20 dark:bg-orange-900/5">
                                                            {currentRoutine.enabledMetrics.reps && (
                                                              <td>
                                                                <div className="flex items-center justify-center gap-1 relative">
                                                                  <span className="absolute left-0 text-[8px] font-black text-orange-400">DS {dsIdx + 1}</span>
                                                                  <input className="w-12 py-2 text-center bg-transparent border-b border-orange-200 dark:border-orange-800 outline-none text-xs font-bold dark:text-white" value={ds.reps} onChange={e => updateDropset(currentWeek.id, currentWorkout.id, entry.id, set.id, ds.id, 'reps', e.target.value)} />
                                                                </div>
                                                              </td>
                                                            )}
                                                            {currentRoutine.enabledMetrics.kg && (
                                                              <td><input className="w-12 py-2 text-center bg-transparent border-b border-orange-200 dark:border-orange-800 outline-none text-xs font-bold dark:text-white" value={ds.kg} onChange={e => updateDropset(currentWeek.id, currentWorkout.id, entry.id, set.id, ds.id, 'kg', e.target.value)} /></td>
                                                            )}
                                                            {currentRoutine.enabledMetrics.rir && <td></td>}
                                                            {currentRoutine.enabledMetrics.rmPercentage && <td></td>}
                                                            {currentRoutine.enabledMetrics.tempo && <td></td>}
                                                            {currentRoutine.enabledMetrics.rest && <td></td>}
                                                            <td></td>
                                                            <td>
                                                              <button onClick={() => deleteDropset(currentWeek.id, currentWorkout.id, entry.id, set.id, ds.id)} className="text-slate-950 dark:text-white hover:text-red-500 transition-all">
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                                              </button>
                                                            </td>
                                                          </tr>
                                                        ))}
                                                      </React.Fragment>
                                                    ))}
                                                  </tbody>
                                                </table>
                                              </div>
                                              <button
                                                onClick={() => addSet(currentWeek.id, currentWorkout.id, entry.id)}
                                                className="w-full py-4 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-950 dark:text-white hover:border-yellow-600 hover:text-yellow-600 transition-all active:scale-[0.98]"
                                              >
                                                + Agregar Serie
                                              </button>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                }}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        );
                      }}
                    </Droppable>
                  </DragDropContext>

                   <div className="mt-16 flex flex-col lg:flex-row gap-4">
                     <div className="flex-1">
                       <ExerciseSearch library={library} onSelect={(id) => addExerciseToWorkout(currentWeek.id, currentWorkout.id, id)} />
                     </div>
                     <button 
                       onClick={() => setShowSupersetModal(true)}
                       className="px-8 py-5 bg-yellow-400 text-black rounded-[2rem] font-black uppercase text-xs tracking-widest hover:scale-105 transition-all shadow-xl flex items-center justify-center gap-3"
                     >
                       <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                       Nueva Superserie
                     </button>
                   </div>
                </div>
              ) : (
                <div className="text-center py-20 bg-white dark:bg-darkCard rounded-[3rem] border-2 border-dashed border-slate-100 dark:border-slate-800">
                  <p className="font-black text-slate-950 dark:text-white uppercase tracking-widest text-sm mb-6">No hay días creados en esta semana</p>
                  <button onClick={() => addWorkout(currentWeek.id)} className="px-10 py-5 bg-yellow-400 text-black rounded-3xl font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl">Empezar Día 1</button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-40">
              <p className="font-black text-slate-950 dark:text-white dark:text-slate-700 uppercase tracking-widest text-2xl mb-10">Tu programa está vacío</p>
              <button onClick={addWeek} className="px-12 py-6 bg-yellow-400 text-black rounded-[2rem] font-black uppercase tracking-widest hover:scale-110 transition-all shadow-2xl">Crear Semana 1</button>
            </div>
          )}
        </div>
      </div>

      {/* Superset Modal */}
      {showSupersetModal && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-darkCard rounded-[3rem] w-full max-w-2xl border-2 border-slate-100 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-10 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Crear Superserie</h3>
                <p className="text-[10px] font-bold text-slate-950 dark:text-white uppercase tracking-widest mt-1">Selecciona los dos ejercicios del bloque</p>
              </div>
              <button onClick={() => setShowSupersetModal(false)} className="p-4 text-slate-950 dark:text-white hover:text-red-500 transition-all">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-10 space-y-10">
              <div className="space-y-4">
                <span className="text-[10px] font-black text-slate-950 dark:text-white uppercase tracking-widest ml-4">Ejercicio 1</span>
                <ExerciseSearch 
                  library={library} 
                  onSelect={(id) => setSupersetForm(prev => ({ ...prev, ex1Id: id }))} 
                />
                {supersetForm.ex1Id && (
                  <div className="ml-4 flex items-center gap-2 text-yellow-400 text-black font-bold text-xs">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
                    Seleccionado: {library.find(l => l.id === supersetForm.ex1Id)?.name}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <span className="text-[10px] font-black text-slate-950 dark:text-white uppercase tracking-widest ml-4">Ejercicio 2</span>
                <ExerciseSearch 
                  library={library} 
                  onSelect={(id) => setSupersetForm(prev => ({ ...prev, ex2Id: id }))} 
                />
                {supersetForm.ex2Id && (
                  <div className="ml-4 flex items-center gap-2 text-yellow-400 text-black font-bold text-xs">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
                    Seleccionado: {library.find(l => l.id === supersetForm.ex2Id)?.name}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <span className="text-[10px] font-black text-slate-950 dark:text-white uppercase tracking-widest ml-4">Descanso Sugerido</span>
                <div className="flex items-center w-full px-8 py-5 bg-slate-900 dark:bg-black border border-slate-800 rounded-[2rem] text-white font-black uppercase text-[10px] tracking-widest shadow-2xl group">
                  <svg className="w-5 h-5 mr-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <input
                    placeholder="Ej: 2:00"
                    className="bg-transparent outline-none w-full text-white placeholder:text-slate-500 uppercase"
                    value={supersetForm.rest}
                    onChange={e => setSupersetForm(prev => ({ ...prev, rest: e.target.value }))}
                  />
                </div>
              </div>

              <button 
                onClick={() => {
                  if (!supersetForm.ex1Id || !supersetForm.ex2Id) {
                    alert('Por favor selecciona ambos ejercicios');
                    return;
                  }
                  if (!activeWeekId || !activeWorkoutId) return;
                  
                  const week = currentRoutine.weeks.find(w => w.id === activeWeekId);
                  const workout = week?.workouts.find(wk => wk.id === activeWorkoutId);
                  const existingLabels = workout?.exercises.map(e => e.supersetLabel).filter(Boolean) as string[];
                  const lastLabel = existingLabels.length > 0 ? (existingLabels.length === 1 ? existingLabels[0] : existingLabels.sort().pop() || '@') : '@';
                  const nextLabel = String.fromCharCode(lastLabel.charCodeAt(0) + 1);

                  setCurrentRoutine(prev => ({
                    ...prev,
                    weeks: prev.weeks.map(w => w.id === activeWeekId ? {
                      ...w,
                      workouts: w.workouts.map(wk => wk.id === activeWorkoutId ? {
                        ...wk,
                        exercises: [
                          ...wk.exercises,
                          {
                            id: Math.random().toString(36).substr(2, 9),
                            libraryExerciseId: supersetForm.ex1Id!,
                            supersetLabel: nextLabel,
                            supersetOrder: 1,
                            sets: [{ id: Math.random().toString(36).substr(2, 9), reps: '10', kg: '0', rir: '2', rmPercentage: '-', rest: '0:10' }]
                          },
                          {
                            id: Math.random().toString(36).substr(2, 9),
                            libraryExerciseId: supersetForm.ex2Id!,
                            supersetLabel: nextLabel,
                            supersetOrder: 2,
                            sets: [{ id: Math.random().toString(36).substr(2, 9), reps: '10', kg: '0', rir: '2', rmPercentage: '-', rest: supersetForm.rest }]
                          }
                        ]
                      } : wk)
                    } : w)
                  }));

                  setShowSupersetModal(false);
                  setSupersetForm({ ex1Id: null, ex2Id: null, rest: '2:00' });
                }}
                className={`w-full py-6 rounded-[2rem] font-black uppercase tracking-widest transition-all shadow-xl ${
                  supersetForm.ex1Id && supersetForm.ex2Id 
                    ? 'bg-yellow-400 text-black hover:scale-[1.02]' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-950 dark:text-white cursor-not-allowed'
                }`}
              >
                Crear Superserie
              </button>
            </div>
          </div>
        </div>
      )}
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
        <svg className="w-5 h-5 mr-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
        <input
          placeholder="Escribe 3 letras para buscar ejercicio..."
          className="bg-transparent outline-none w-full text-slate-950 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
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
              className="p-5 hover:bg-yellow-400 hover:text-black cursor-pointer rounded-2xl text-sm font-black text-slate-800 dark:text-slate-100 transition-all flex items-center justify-between uppercase"
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
            <div className="p-8 text-center text-slate-950 dark:text-white font-bold uppercase text-[10px] tracking-widest">No se encontraron resultados</div>
          )}
        </div>
      )}
    </div>
  );
}

export default RoutineBuilder;
