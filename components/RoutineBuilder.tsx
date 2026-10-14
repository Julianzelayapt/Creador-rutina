
import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Routine, Exercise, Week, Workout, ExerciseEntry, TrainingSet } from '../types';
import { DEFAULT_MUSCLE_GROUPS, getMuscleGroupImage, findMuscleGroupById, getCustomMuscleImages, setCustomMuscleImage } from '../muscleGroups';

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
  const [newExercise, setNewExercise] = useState<{
    id?: string;
    name: string;
    videoUrl: string;
    muscleImage: string;
    muscleGroup: string;
    alternativeExerciseIds: string[];
    tip: string;
  }>({
    name: '',
    videoUrl: '',
    muscleImage: getMuscleGroupImage('pecho'),
    muscleGroup: 'pecho',
    alternativeExerciseIds: [],
    tip: ''
  });
  const [shareLinks, setShareLinks] = useState<{ client: string, builder: string } | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [libraryQuery, setLibraryQuery] = useState('');
  const [showImageModal, setShowImageModal] = useState(false);
  const [showMusclePhotosModal, setShowMusclePhotosModal] = useState(false);
  const [customMuscleImagesMap, setCustomMuscleImagesMap] = useState<Record<string, string>>(() => getCustomMuscleImages());

  // Navegación por ID
  const [activeWeekId, setActiveWeekId] = useState<string | null>(routine.weeks[0]?.id || null);
  const [activeWorkoutId, setActiveWorkoutId] = useState<string | null>(null);

  // Superset Creator Modal
  const [showSupersetModal, setShowSupersetModal] = useState(false);
  const [supersetForm, setSupersetForm] = useState<{ ex1Id: string | null, ex2Id: string | null, rest: string }>({ ex1Id: null, ex2Id: null, rest: '2:00' });

  // Modal personalizado para nombre de enfoque (reemplaza window.prompt)
  const [showEnfoqueModal, setShowEnfoqueModal] = useState(false);
  const [enfoqueModalInput, setEnfoqueModalInput] = useState('');
  const [enfoqueModalWeekId, setEnfoqueModalWeekId] = useState<string | null>(null);
  const [enfoqueModalDefault, setEnfoqueModalDefault] = useState('');

  // Sincronizar el estado local únicamente cuando cambia el ID de la rutina recibida por prop
  useEffect(() => {
    setCurrentRoutine({
      ...routine,
      enabledMetrics: routine.enabledMetrics || { reps: true, kg: true, rir: true, rmPercentage: false, rest: true, tempo: false }
    });
  }, [routine.id]);

  // Sincronizar en tiempo real los cambios del builder con debounce para evitar bucles y sobreescrituras
  useEffect(() => {
    if (!currentRoutine.id) return;
    const timer = setTimeout(() => {
      onSave(currentRoutine);
    }, 400);
    return () => clearTimeout(timer);
  }, [currentRoutine]);

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
      if (week && Array.isArray(week.workouts) && week.workouts.length > 0) {
        // Si no hay workout seleccionado o el seleccionado no pertenece a esta semana
        if (!activeWorkoutId || !week.workouts.some(wk => wk.id === activeWorkoutId)) {
          setActiveWorkoutId(week.workouts[0].id);
        }
      } else {
        setActiveWorkoutId(null);
      }
    }
  }, [activeWeekId, currentRoutine.weeks, activeWorkoutId]);

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

  const [isSaving, setIsSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const handleSave = async () => {
    if (currentRoutine.weeks.length === 0) {
      const confirmEmpty = window.confirm('La rutina no tiene semanas ni ejercicios. ¿Quieres guardarla vacía para generar el link de todas formas?');
      if (!confirmEmpty) return;
    }
    setIsSaving(true);
    try {
      const routineId = await onSave(currentRoutine);
      const origin = window.location.origin + window.location.pathname;
      setShareLinks({
        client: `${origin}#routine/${routineId}`,
        builder: `${origin}#builder/${routineId}`
      });
      setSavedMessage('¡Rutina guardada exitosamente en la nube y lista para compartir! 🚀');
      setTimeout(() => setSavedMessage(null), 4000);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
      alert(`⚠️ Error al guardar: ${e?.message || e}`);
    } finally {
      setIsSaving(false);
    }
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
    const week = currentRoutine.weeks.find(w => w.id === weekId);
    const dayNumber = (week?.workouts?.length || 0) + 1;
    const defaultName = `Día ${dayNumber}`;
    // Abre el modal para asignar título al día
    setEnfoqueModalWeekId(weekId);
    setEnfoqueModalDefault(defaultName);
    setEnfoqueModalInput(''); // Vacío para que el placeholder sea visible y el usuario escriba directamente
    setShowEnfoqueModal(true);
  };

  const confirmAddEnfoque = () => {
    if (!enfoqueModalWeekId) return;
    const workoutName = enfoqueModalInput.trim() || enfoqueModalDefault;
    const newWorkoutId = Math.random().toString(36).substr(2, 9);
    setCurrentRoutine({
      ...currentRoutine,
      weeks: currentRoutine.weeks.map(w => {
        if (w.id === enfoqueModalWeekId) {
          const newWorkout: Workout = {
            id: newWorkoutId,
            name: workoutName,
            warmup: '',
            exercises: []
          };
          return { ...w, workouts: [...w.workouts, newWorkout] };
        }
        return w;
      })
    });
    setActiveWorkoutId(newWorkoutId);
    setShowEnfoqueModal(false);
    setEnfoqueModalWeekId(null);
    setEnfoqueModalInput('');
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

  const updateExerciseCustomTip = (weekId: string, workoutId: string, entryId: string, tip: string) => {
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
                      return { ...ex, customTip: tip };
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
      {/* Toast Notificación de Guardado */}
      {savedMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-green-500 text-white font-black text-xs lg:text-sm px-8 py-4 rounded-[2rem] shadow-2xl z-[200] flex items-center gap-3 animate-in slide-in-from-top-6 duration-300">
          <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
          <span>{savedMessage}</span>
        </div>
      )}

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
                setNewExercise({
                  name: '',
                  videoUrl: '',
                  muscleImage: getMuscleGroupImage('pecho'),
                  muscleGroup: 'pecho',
                  alternativeExerciseIds: [],
                  tip: ''
                });
                setShowLibraryForm(!showLibraryForm);
              }}
              className="p-2.5 bg-yellow-400 text-black rounded-2xl hover:bg-yellow-500 shadow-md transition-all active:scale-90"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            </button>
          </div>

          {showLibraryForm && (
            <div className="space-y-3 mb-6 bg-slate-100 dark:bg-slate-900 p-5 rounded-[2rem] border-2 border-slate-200 dark:border-slate-800 animate-in slide-in-from-top-4 duration-200">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1 block">
                  Nombre del ejercicio
                </label>
                <input
                  placeholder="Ej: Press Inclinado con Mancuernas 45°"
                  className="w-full px-4 py-3 text-sm rounded-xl bg-white dark:bg-black border-2 border-transparent focus:border-yellow-600 outline-none font-bold text-slate-800 dark:text-white"
                  value={newExercise.name}
                  onChange={e => setNewExercise({ ...newExercise, name: e.target.value })}
                />
              </div>

              {/* Selector de Grupo Muscular con Foto Automática */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    Grupo Muscular (foto automática)
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowMusclePhotosModal(true)}
                    className="text-[10px] text-amber-500 hover:text-amber-400 font-bold underline flex items-center gap-1"
                  >
                    ⚙️ Cambiar fotos
                  </button>
                </div>
                <div className="flex items-center gap-3 bg-white dark:bg-black p-2 rounded-xl border border-slate-200 dark:border-zinc-800">
                  <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-amber-500/30 bg-zinc-900 flex items-center justify-center">
                    <img
                      src={newExercise.muscleImage || getMuscleGroupImage(newExercise.muscleGroup)}
                      alt="Músculo"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <select
                    className="flex-1 bg-transparent text-sm font-bold text-slate-800 dark:text-white outline-none cursor-pointer"
                    value={newExercise.muscleGroup}
                    onChange={(e) => {
                      const selectedGroup = e.target.value;
                      const autoImage = getMuscleGroupImage(selectedGroup);
                      setNewExercise({
                        ...newExercise,
                        muscleGroup: selectedGroup,
                        muscleImage: autoImage
                      });
                    }}
                  >
                    {DEFAULT_MUSCLE_GROUPS.map((g) => (
                      <option key={g.id} value={g.id} className="bg-zinc-900 text-white">
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1 block">
                  URL Video demostrativo
                </label>
                <input
                  placeholder="URL Video (YouTube, Vimeo, etc.)"
                  className="w-full px-4 py-3 text-sm rounded-xl bg-white dark:bg-black border-2 border-transparent focus:border-yellow-600 outline-none font-medium text-slate-800 dark:text-white"
                  value={newExercise.videoUrl}
                  onChange={e => setNewExercise({ ...newExercise, videoUrl: e.target.value })}
                />
              </div>

              {/* Selector de Alternativas con Vinculación Recíproca */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    Sustitutos / Máquina ocupada (mismo enfoque)
                  </label>
                  <span className="text-[9px] text-amber-500 font-bold uppercase tracking-wider">
                    Bidireccional
                  </span>
                </div>

                {/* Chips de alternativas seleccionadas */}
                {newExercise.alternativeExerciseIds && newExercise.alternativeExerciseIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2 p-2 bg-white/50 dark:bg-black/50 rounded-xl border border-slate-200 dark:border-zinc-800">
                    {newExercise.alternativeExerciseIds.map((altId) => {
                      const altEx = library.find(l => l.id === altId);
                      return (
                        <span
                          key={altId}
                          className="inline-flex items-center gap-1.5 text-xs bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-lg font-bold"
                        >
                          <span className="truncate max-w-[150px]">{altEx?.name || 'Ejercicio'}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setNewExercise({
                                ...newExercise,
                                alternativeExerciseIds: newExercise.alternativeExerciseIds.filter(id => id !== altId)
                              });
                            }}
                            className="hover:text-red-500 font-black text-xs ml-0.5"
                            title="Quitar sustituto"
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Desplegable para sumar alternativas */}
                <select
                  className="w-full px-3 py-2.5 text-xs rounded-xl bg-white dark:bg-black border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 font-semibold outline-none focus:border-amber-500 cursor-pointer"
                  value=""
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    if (selectedId && !newExercise.alternativeExerciseIds.includes(selectedId)) {
                      setNewExercise({
                        ...newExercise,
                        alternativeExerciseIds: [...newExercise.alternativeExerciseIds, selectedId]
                      });
                    }
                  }}
                >
                  <option value="" disabled>
                    ➕ Agregar ejercicio sustituto compatible...
                  </option>
                  {library
                    .filter(ex => ex.id !== newExercise.id && !newExercise.alternativeExerciseIds.includes(ex.id))
                    .map(ex => (
                      <option key={ex.id} value={ex.id} className="bg-zinc-900 text-white">
                        {ex.name} {ex.muscleGroup ? `(${ex.muscleGroup})` : ''}
                      </option>
                    ))}
                </select>
                <p className="text-[10px] text-zinc-500 mt-1 leading-tight">
                  💡 <strong>Recíproco automático:</strong> al guardar, estos ejercicios también tendrán a este como sustituto.
                </p>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1 block">
                  Tips y recomendaciones (opcional)
                </label>
                <textarea
                  placeholder="Ej: Banco a 45°, retracción escapular, bajar controlado"
                  className="w-full px-4 py-3 text-sm rounded-xl bg-white dark:bg-black border-2 border-transparent focus:border-yellow-600 outline-none h-20 resize-none font-medium"
                  value={newExercise.tip}
                  onChange={e => setNewExercise({ ...newExercise, tip: e.target.value })}
                />
              </div>

              <button
                onClick={(e) => {
                  e.preventDefault();
                  if (newExercise.name) {
                    const payload: Exercise = {
                      id: newExercise.id || Math.random().toString(36).substr(2, 9),
                      name: newExercise.name,
                      videoUrl: newExercise.videoUrl,
                      muscleGroup: newExercise.muscleGroup,
                      muscleImage: newExercise.muscleImage || getMuscleGroupImage(newExercise.muscleGroup),
                      alternativeExerciseIds: newExercise.alternativeExerciseIds,
                      tip: newExercise.tip
                    };

                    if (newExercise.id) {
                      onEditLibrary(payload);
                    } else {
                      onAddToLibrary(payload);
                    }
                    setNewExercise({
                      name: '',
                      videoUrl: '',
                      muscleImage: getMuscleGroupImage('pecho'),
                      muscleGroup: 'pecho',
                      alternativeExerciseIds: [],
                      tip: ''
                    });
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
              className="p-3 bg-slate-100 dark:bg-slate-800/50 rounded-2xl border-2 border-transparent hover:border-yellow-600 transition-all cursor-pointer group relative flex justify-between items-center text-slate-800 dark:text-slate-100"
              onClick={() => {
                if (!activeWeekId || !activeWorkoutId) {
                  alert('Primero selecciona una semana y un día');
                  return;
                }
                addExerciseToWorkout(activeWeekId, activeWorkoutId, ex.id);
              }}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <img
                  src={ex.muscleImage || getMuscleGroupImage(ex.muscleGroup)}
                  alt={ex.name}
                  className="w-10 h-10 rounded-xl object-cover shrink-0 bg-zinc-900 border border-slate-300 dark:border-white/10"
                />
                <div className="min-w-0">
                  <div className="font-bold text-sm truncate">{ex.name}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {ex.muscleGroup && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                        {ex.muscleGroup}
                      </span>
                    )}
                    {ex.alternativeExerciseIds && ex.alternativeExerciseIds.length > 0 && (
                      <span className="text-[9px] bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold px-1.5 py-0.2 rounded-md">
                        🔀 {ex.alternativeExerciseIds.length} alt
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const group = ex.muscleGroup || 'pecho';
                    setNewExercise({
                      id: ex.id,
                      name: ex.name,
                      videoUrl: ex.videoUrl || '',
                      muscleImage: ex.muscleImage || getMuscleGroupImage(group),
                      muscleGroup: group,
                      alternativeExerciseIds: ex.alternativeExerciseIds || [],
                      tip: ex.tip || ''
                    });
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
                  <button onClick={async () => { await onSave(currentRoutine); window.location.hash = `routine/${currentRoutine.id}`; onGoToClient(); }} className="px-6 py-3 bg-white text-green-600 rounded-2xl font-black uppercase text-xs">Ir</button>
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
              <div
                onClick={() => setShowImageModal(true)}
                className="relative group/img cursor-pointer"
                title="Hacé clic para reposicionar o cambiar la imagen de portada"
              >
                <img
                  src={currentRoutine.image}
                  style={{ objectPosition: `center ${currentRoutine.imagePosition || '50%'}` }}
                  className="w-20 h-20 lg:w-24 lg:h-24 rounded-2xl object-cover shadow-lg border-2 border-slate-100 dark:border-slate-800"
                  alt=""
                />
                <div className="absolute inset-0 bg-black/50 rounded-2xl flex flex-col items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity text-white text-[10px] font-bold uppercase tracking-wider text-center p-1">
                  <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  Ajustar
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
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 flex items-center gap-3">
                    <span className="text-blue-500 font-black text-[10px] uppercase tracking-widest bg-blue-500/10 px-3 py-1 rounded-lg">OBJETIVO</span>
                    <input
                      className="flex-1 bg-transparent text-blue-500 font-black text-xs lg:text-sm uppercase tracking-widest focus:outline-none border-b border-transparent focus:border-blue-500/30 pb-0.5"
                      value={currentRoutine.objective || ''}
                      onChange={e => setCurrentRoutine({ ...currentRoutine, objective: e.target.value })}
                      placeholder="EJ. HIPERTROFIA"
                    />
                  </div>
                  <div className="flex-1 flex items-center gap-3">
                    <span className="text-purple-500 font-black text-[10px] uppercase tracking-widest bg-purple-500/10 px-3 py-1 rounded-lg">SPLIT</span>
                    <input
                      className="flex-1 bg-transparent text-purple-500 font-black text-xs lg:text-sm uppercase tracking-widest focus:outline-none border-b border-transparent focus:border-purple-500/30 pb-0.5"
                      value={currentRoutine.split || ''}
                      onChange={e => setCurrentRoutine({ ...currentRoutine, split: e.target.value })}
                      placeholder="EJ. PUSH PULL LEGS"
                    />
                  </div>
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
              disabled={isSaving}
              className="w-full lg:w-auto px-10 py-5 bg-yellow-400 text-black rounded-[1.5rem] font-black text-xs lg:text-sm uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-yellow-500/20 active:shadow-inner flex items-center justify-center gap-3 disabled:opacity-50 cursor-pointer"
            >
              <svg className={`w-5 h-5 ${isSaving ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isSaving ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 12a8 8 0 018-8v8H4z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                )}
              </svg>
              {isSaving ? 'GUARDANDO EN LA NUBE...' : 'GUARDAR CAMBIOS'}
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

              {/* TABS DE DÍAS (SELECTOR + BOTÓN AGREGAR DÍA) */}
              <div className="space-y-4 mb-10">
                <div className="flex flex-col md:flex-row gap-4 items-stretch">
                  <div className="relative group flex-1">
                    <label className="text-[10px] font-black text-slate-950 dark:text-slate-200 uppercase tracking-widest ml-4 mb-2 block">Seleccionar Día</label>
                    <select
                      value={activeWorkoutId || ''}
                      onChange={(e) => setActiveWorkoutId(e.target.value)}
                      className="w-full bg-slate-100 dark:bg-slate-900/50 px-8 py-5 rounded-[2rem] font-black uppercase text-xs tracking-widest border border-transparent focus:border-yellow-600 transition-all outline-none text-slate-950 dark:text-white appearance-none cursor-pointer shadow-inner"
                    >
                      {currentWeek.workouts.map((workout, idx) => {
                        const hasPrefix = /^d[ií]a\s*\d+/i.test(workout.name.trim());
                        const label = hasPrefix ? workout.name : `Día ${idx + 1} · ${workout.name}`;
                        return (
                          <option key={workout.id} value={workout.id}>{label}</option>
                        );
                      })}
                    </select>
                    <div className="absolute right-6 bottom-5 pointer-events-none text-yellow-600">
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z" /></svg>
                    </div>
                  </div>
                  <button
                    onClick={() => addWorkout(currentWeek.id)}
                    className="px-8 py-5 border-2 border-dashed border-slate-300 dark:border-slate-800 text-slate-950 dark:text-white rounded-[2rem] font-black text-[10px] uppercase hover:border-yellow-600 hover:text-yellow-600 transition-all flex items-center justify-center gap-2 h-[66px] shrink-0"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
                    + AGREGAR DÍA
                  </button>
                </div>

                {/* Botones rápidos de días de la semana */}
                {currentWeek.workouts.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                    {currentWeek.workouts.map((wk, idx) => {
                      const isActive = wk.id === activeWorkoutId;
                      const hasPrefix = /^d[ií]a\s*\d+/i.test(wk.name.trim());
                      const pillLabel = hasPrefix ? wk.name : `Día ${idx + 1}: ${wk.name}`;
                      return (
                        <button
                          key={wk.id}
                          type="button"
                          onClick={() => setActiveWorkoutId(wk.id)}
                          className={`px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all border ${
                            isActive
                              ? 'bg-yellow-400 text-black border-yellow-400 shadow-md scale-[1.02]'
                              : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-white/10 hover:border-yellow-500/50'
                          }`}
                        >
                          {pillLabel}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {currentWorkout ? (
                <div className="bg-white dark:bg-darkCard rounded-[3rem] border-2 border-slate-100 dark:border-slate-800 p-10 shadow-sm animate-in zoom-in-95 duration-200">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                    <div className="flex-1 w-full">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5 ml-1">
                        Título del Día (hacé clic para editar, ej: CHEST DAY, PUSH, TRACCIÓN, PIERNAS)
                      </label>
                      <div className="flex items-center gap-3 bg-slate-100 dark:bg-black/50 border border-slate-200 dark:border-white/10 rounded-2xl px-5 py-3 focus-within:border-yellow-500 transition-all shadow-inner">
                        <svg className="w-5 h-5 text-zinc-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        <input
                          className="bg-transparent font-bold text-xl sm:text-2xl text-slate-800 dark:text-white focus:outline-none uppercase w-full tracking-tight"
                          value={currentWorkout.name}
                          onChange={e => setCurrentRoutine({
                            ...currentRoutine,
                            weeks: currentRoutine.weeks.map(w => w.id === currentWeek.id ? { ...w, workouts: w.workouts.map(wk => wk.id === currentWorkout.id ? { ...wk, name: e.target.value } : wk) } : w)
                          })}
                          placeholder="Ej: CHEST DAY, PUSH, TRACCIÓN, PIERNAS..."
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => deleteWorkout(currentWeek.id, currentWorkout.id)}
                      className="p-3 text-red-400 hover:text-red-600 transition-all flex items-center gap-2 font-black text-[10px] uppercase shrink-0 self-end sm:self-center"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      Borrar Día
                    </button>
                  </div>

                  <div className="mb-10 p-6 bg-orange-50/30 dark:bg-orange-500/10 rounded-[2rem] border-2 border-dashed border-orange-200/50 dark:border-orange-500/40 transition-all focus-within:border-orange-500">
                    <textarea
                      placeholder="Instrucciones del enfoque (calentamiento, foco, etc.)..."
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
                                              <div className="flex justify-between items-center mb-4">
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

                                              <div className="mb-4 bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/85 focus-within:border-yellow-500/50 transition-all">
                                                <div className="flex items-center gap-2 mb-1.5">
                                                  <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                                    Instrucción personalizada para el alumno
                                                  </span>
                                                </div>
                                                <textarea
                                                  placeholder={libEx?.tip ? `Tip por defecto: ${libEx.tip}` : "Escribe una instrucción personalizada (ej. rest-pause de 10 seg, al fallo...)"}
                                                  className="w-full bg-transparent text-xs font-semibold outline-none text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 h-14 resize-none"
                                                  value={entry.customTip || ''}
                                                  onChange={e => updateExerciseCustomTip(currentWeek.id, currentWorkout.id, entry.id, e.target.value)}
                                                />
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
                  <button onClick={() => addWorkout(currentWeek.id)} className="px-10 py-5 bg-yellow-400 text-black rounded-3xl font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl">+ Empezar Día 1</button>
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

      {/* Modal Reposicionar Portada */}
      {showImageModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-[#18181b] border border-white/10 rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200 space-y-5">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight">Portada de la Rutina</h3>
                <p className="text-xs text-zinc-400">Ajustá la posición vertical para centrar el cuerpo o rostro</p>
              </div>
              <button
                onClick={() => setShowImageModal(false)}
                className="p-2 text-zinc-400 hover:text-white rounded-full bg-white/5"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Vista Previa en Vivo 16:9 exactamente como la ve el alumno */}
            <div className="relative rounded-2xl overflow-hidden aspect-[16/9] w-full bg-zinc-900 border border-white/10 shadow-lg">
              <img
                src={currentRoutine.image}
                alt="Vista previa"
                style={{ objectPosition: `center ${currentRoutine.imagePosition || '50%'}` }}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent"></div>
              <div className="relative z-10 p-4 flex flex-col justify-end h-full">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Vista previa del alumno</span>
                <h4 className="text-xl font-bold text-white leading-tight">{currentRoutine.name || 'Título de Rutina'}</h4>
                <p className="text-xs text-zinc-300 font-bold uppercase mt-0.5">by JULIAN</p>
              </div>
            </div>

            {/* Slider de Posición Vertical */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="text-zinc-300">Alineación Vertical (Enfoque)</span>
                <span className="text-white font-mono bg-zinc-800 px-2 py-0.5 rounded-md">
                  {currentRoutine.imagePosition || '50%'}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={parseInt((currentRoutine.imagePosition || '50%').replace('%', ''), 10) || 50}
                onChange={e => setCurrentRoutine({ ...currentRoutine, imagePosition: `${e.target.value}%` })}
                className="w-full accent-white h-2 bg-zinc-800 rounded-lg cursor-pointer"
              />
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setCurrentRoutine({ ...currentRoutine, imagePosition: '20%' })}
                  className="flex-1 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-white/10 rounded-lg text-xs font-semibold text-zinc-300 hover:text-white transition-all"
                >
                  Arriba (20%)
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentRoutine({ ...currentRoutine, imagePosition: '50%' })}
                  className="flex-1 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-white/10 rounded-lg text-xs font-semibold text-zinc-300 hover:text-white transition-all"
                >
                  Centro (50%)
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentRoutine({ ...currentRoutine, imagePosition: '80%' })}
                  className="flex-1 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-white/10 rounded-lg text-xs font-semibold text-zinc-300 hover:text-white transition-all"
                >
                  Abajo (80%)
                </button>
              </div>
            </div>

            {/* URL o Cambiar Imagen */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400">URL de la Imagen</label>
              <input
                type="text"
                value={currentRoutine.image}
                onChange={e => setCurrentRoutine({ ...currentRoutine, image: e.target.value })}
                placeholder="https://images.unsplash.com/..."
                className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-white/30 font-mono"
              />
            </div>

            <button
              onClick={() => {
                setShowImageModal(false);
                onSave(currentRoutine);
              }}
              className="w-full py-3.5 bg-white text-black font-bold text-sm rounded-xl hover:bg-zinc-200 active:scale-95 transition-all shadow-md"
            >
              Guardar y Cerrar
            </button>
          </div>
        </div>
      )}

      {/* ── Modal: Personalizar Fotos de Grupos Musculares ── */}
      {showMusclePhotosModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[300] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#18181b] border border-white/10 rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-white/5 pb-3 shrink-0">
              <div>
                <h3 className="text-xl font-black text-white tracking-tight uppercase flex items-center gap-2">
                  <span>🎨</span> Fotos de Grupos Musculares
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Pegá el link de cualquier foto que te guste o dejalo vacío para usar la ilustración anatómica.
                </p>
              </div>
              <button
                onClick={() => setShowMusclePhotosModal(false)}
                className="p-2 text-zinc-400 hover:text-white rounded-full bg-white/5"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Lista con scroll de grupos musculares */}
            <div className="space-y-3 overflow-y-auto pr-1 flex-1">
              {DEFAULT_MUSCLE_GROUPS.map((group) => {
                const customUrl = customMuscleImagesMap[group.id] || '';
                const currentImg = customUrl || group.defaultImage;

                return (
                  <div
                    key={group.id}
                    className="p-3.5 bg-zinc-900 rounded-2xl border border-white/5 flex items-center gap-3.5"
                  >
                    <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-amber-500/30 bg-black flex items-center justify-center">
                      <img src={currentImg} alt={group.name} className="w-full h-full object-cover" />
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-white">{group.name}</span>
                        {customUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              setCustomMuscleImage(group.id, '');
                              setCustomMuscleImagesMap(getCustomMuscleImages());
                              if (newExercise.muscleGroup === group.id) {
                                setNewExercise(prev => ({ ...prev, muscleImage: group.defaultImage }));
                              }
                            }}
                            className="text-[10px] text-amber-400 hover:text-amber-300 underline font-semibold"
                          >
                            Restablecer
                          </button>
                        )}
                      </div>
                      <input
                        placeholder="Pegar link de foto (URL)..."
                        value={customUrl}
                        onChange={(e) => {
                          const val = e.target.value.trim();
                          setCustomMuscleImage(group.id, val);
                          setCustomMuscleImagesMap(getCustomMuscleImages());
                          if (newExercise.muscleGroup === group.id) {
                            setNewExercise(prev => ({
                              ...prev,
                              muscleImage: val || group.defaultImage
                            }));
                          }
                        }}
                        className="w-full px-3 py-1.5 text-xs rounded-lg bg-black border border-white/10 text-white focus:border-amber-500 outline-none"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="shrink-0 pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => setShowMusclePhotosModal(false)}
                className="w-full py-3 bg-yellow-400 hover:bg-yellow-500 text-black font-black uppercase text-xs tracking-wider rounded-xl transition-all"
              >
                Listo / Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Nombre del Día / Entrenamiento ── */}
      {showEnfoqueModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[300] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#18181b] border border-white/10 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-white tracking-tight uppercase">Nuevo Día de Entrenamiento</h3>
                <p className="text-xs text-zinc-400 mt-1">Asignale un título o enfoque (ej: Chest Day, Push, Tracción, Piernas...)</p>
              </div>
              <button
                onClick={() => setShowEnfoqueModal(false)}
                className="p-2 text-zinc-500 hover:text-white rounded-full hover:bg-white/10 transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Input */}
            <div className="space-y-2">
              <label className="text-[11px] font-black text-zinc-400 uppercase tracking-widest block">Título del Día</label>
              <input
                type="text"
                autoFocus
                value={enfoqueModalInput}
                onChange={e => setEnfoqueModalInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') confirmAddEnfoque(); if (e.key === 'Escape') setShowEnfoqueModal(false); }}
                placeholder={`Ej: CHEST DAY, PUSH, TRACCIÓN, PIERNAS (por defecto: ${enfoqueModalDefault})`}
                className="w-full bg-zinc-900 border-2 border-white/10 focus:border-yellow-500 rounded-2xl px-5 py-4 text-white font-bold text-base focus:outline-none placeholder:text-zinc-500 placeholder:font-normal transition-all"
              />
            </div>

            {/* Sugerencias rápidas */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Sugerencias rápidas (tocá para elegir):</span>
              <div className="flex flex-wrap gap-2">
                {[
                  'CHEST DAY',
                  'PUSH',
                  'PULL',
                  'TRACCIÓN',
                  'PIERNAS',
                  'LEGS',
                  'TORSO',
                  'PIERNA ANTERIOR',
                  'PIERNA POSTERIOR',
                  'BRAZOS Y HOMBROS',
                  'FULL BODY'
                ].map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setEnfoqueModalInput(s)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
                      enfoqueModalInput === s
                        ? 'bg-yellow-400 text-black border-yellow-400 shadow-md scale-105'
                        : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border-white/10'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Botones */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowEnfoqueModal(false)}
                className="flex-1 py-3.5 bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-white font-bold rounded-2xl text-xs uppercase tracking-wider transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmAddEnfoque}
                className="flex-1 py-3.5 bg-yellow-400 hover:bg-yellow-300 text-black font-black rounded-2xl text-xs uppercase tracking-wider active:scale-95 transition-all shadow-lg"
              >
                Añadir Día ✓
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
