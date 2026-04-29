
import React, { useState, useEffect, useRef } from 'react';
import emailjs from '@emailjs/browser';
import { Routine, Exercise } from '../types';
import { supabase } from '../supabase';
import ProgressiveOverloadTab from './ProgressiveOverloadTab';

interface ClientViewProps {
  routine: Routine;
  library: Exercise[];
}

const ExerciseBlock: React.FC<{
  entry: any;
  library: any[];
  t: (k: string) => string;
  routine: any;
  completedSets: Record<string, boolean>;
  clientReps: Record<string, string>;
  clientWeights: Record<string, string>;
  setClientReps: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setClientWeights: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  handleSetToggle: (id: string, rest: string) => void;
  feelings: Record<string, string>;
  setFeelings: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  isSuperset?: boolean;
}> = ({ entry, library, t, routine, completedSets, clientReps, clientWeights, setClientReps, setClientWeights, handleSetToggle, feelings, setFeelings, isSuperset }) => {
  const libEx = library.find(l => l.id === entry.libraryExerciseId);
  return (
    <div key={entry.id} className="relative mb-20 lg:mb-32">
      <div className="flex flex-col gap-10 lg:gap-14">
        <div>
          <div className="flex items-center gap-5 mb-5 flex-wrap">
            {libEx?.videoUrl ? (
              <a
                href={libEx.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-14 h-14 bg-green-500 hover:bg-green-600 text-white rounded-[1.5rem] flex items-center justify-center shrink-0 shadow-lg transition-all active:scale-90"
                title="Ver Video"
              >
                <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              </a>
            ) : null}
            <h4 className="text-2xl lg:text-4xl font-['Oswald'] font-black text-slate-800 dark:text-white tracking-tighter uppercase pr-4">
              {isSuperset && entry.supersetLabel && entry.supersetOrder ? `[${entry.supersetLabel}${entry.supersetOrder}] ` : ''}
              {libEx?.name}
            </h4>
          </div>

          <div className="mb-8 p-6 bg-slate-100 dark:bg-black/30 rounded-xl border-l-[8px] border-yellow-500">
            <p className="text-slate-950 dark:text-white font-bold text-base">💡 {t('tip')}: {libEx?.tip || '...'}</p>
          </div>

          <div className="overflow-x-auto mb-8 w-full pb-4">
            <table className="w-full text-center table-auto min-w-max">
              <thead>
                <tr className="text-[9px] lg:text-[10px] font-black text-slate-950 dark:text-slate-200 uppercase tracking-tight border-b border-slate-100 dark:border-slate-800">
                  {routine.enabledMetrics.reps && <th className="py-4 px-1 lg:px-2">{t('reps')}</th>}
                  {routine.enabledMetrics.kg && <th className="py-4">{t('kg')}</th>}
                  {routine.enabledMetrics.rir && <th className="py-4">{t('rir')}</th>}
                  {routine.enabledMetrics.rmPercentage && <th className="py-2 lg:py-4">{t('rm')}</th>}
                  {routine.enabledMetrics.tempo && <th className="py-2 lg:py-4">{t('tempo')}</th>}
                  <th className="py-2 lg:py-4 w-12 lg:w-20">{t('ok')}</th>
                </tr>
              </thead>
              <tbody>
                {entry.sets.map((set: any, idx: number) => (
                  <React.Fragment key={set.id}>
                    <tr className={`transition-all border-b border-slate-100 dark:border-slate-900 last:border-0 ${completedSets[set.id] ? 'bg-green-500/10 dark:bg-green-500/5' : ''}`}>
                      {routine.enabledMetrics.reps && (
                        <td className="py-3 lg:py-6 px-1 lg:px-2">
                          <input
                            type="text"
                            className="w-14 lg:w-24 py-2 lg:py-4 text-center bg-white dark:bg-black border-2 lg:border-[3px] border-slate-200 dark:border-slate-700 rounded-2xl font-black text-slate-900 dark:text-white outline-none focus:border-yellow-500 transition-all text-base lg:text-xl"
                            value={clientReps[set.id] !== undefined ? clientReps[set.id] : set.reps}
                            onChange={(e) => setClientReps(prev => ({ ...prev, [set.id]: e.target.value }))}
                          />
                        </td>
                      )}
                      {routine.enabledMetrics.kg && (
                        <td className="py-3 lg:py-6 px-1 lg:px-2">
                          <input
                            type="text"
                            className="w-14 lg:w-24 py-2 lg:py-4 text-center bg-white dark:bg-black border-2 lg:border-[3px] border-slate-200 dark:border-slate-700 rounded-2xl font-black text-slate-900 dark:text-white outline-none focus:border-yellow-500 transition-all text-base lg:text-xl"
                            value={clientWeights[set.id] !== undefined ? clientWeights[set.id] : set.kg}
                            onChange={(e) => setClientWeights(prev => ({ ...prev, [set.id]: e.target.value }))}
                          />
                        </td>
                      )}
                      {routine.enabledMetrics.rir && <td className="py-3 lg:py-6 px-1 lg:px-2 font-black text-slate-950 dark:text-white text-base lg:text-lg">{set.rir}</td>}
                      {routine.enabledMetrics.rmPercentage && <td className="py-3 lg:py-6 px-1 lg:px-2 font-black text-slate-950 dark:text-white text-base lg:text-lg">{set.rmPercentage}%</td>}
                      {routine.enabledMetrics.tempo && <td className="py-3 lg:py-6 px-1 lg:px-2 font-black text-slate-950 dark:text-white text-base lg:text-lg">{set.tempo}</td>}
                      <td className="py-3 lg:py-6 px-2">
                        <button
                          onClick={() => handleSetToggle(set.id, set.rest)}
                          className={`w-12 h-12 lg:w-16 lg:h-16 mx-auto rounded-lg lg:rounded-xl border-[3px] lg:border-4 flex items-center justify-center transition-all active:scale-90 ${completedSets[set.id] ? 'bg-green-500 border-green-500 text-white shadow-2xl scale-110' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-transparent hover:border-green-400'}`}
                        >
                          <svg className="w-5 h-5 lg:w-10 lg:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" d="M5 13l4 4L19 7" /></svg>
                        </button>
                      </td>
                    </tr>
                    {set.dropsets?.map((ds: any, dsIdx: number) => (
                      <tr key={ds.id} className="bg-orange-50/10 dark:bg-orange-900/5">
                        <td colSpan={10} className="py-3">
                          <div className="flex items-center justify-center gap-4">
                            <div className="flex items-center gap-1 bg-orange-100 dark:bg-orange-500/20 px-2 py-1 rounded">
                              <div className="w-3 h-3 border-l-2 border-b-2 border-orange-400 rounded-bl-sm"></div>
                              <span className="text-[10px] font-black text-orange-600 dark:text-orange-400">DS {dsIdx + 1}</span>
                            </div>
                            <span className="text-lg font-black text-slate-700 dark:text-slate-300">{ds.kg}kg</span>
                            <span className="text-slate-950 dark:text-slate-200 font-bold">x</span>
                            <span className="text-lg font-black text-slate-700 dark:text-slate-300">{ds.reps} reps</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-8 bg-slate-100 dark:bg-black/40 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800">
            <textarea
              placeholder={t('notesPlaceholder')}
              className="w-full bg-white dark:bg-darkCard p-6 rounded-lg border-2 border-transparent focus:border-yellow-500 outline-none transition-all h-28 text-slate-800 dark:text-slate-200 font-medium shadow-inner"
              value={feelings[entry.id] || ''}
              onChange={(e) => {
                const val = e.target.value;
                setFeelings(prev => ({ ...prev, [entry.id]: val }));
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const ClientView: React.FC<ClientViewProps> = ({ routine: initialRoutine, library }) => {
  const routine = {
    ...initialRoutine,
    enabledMetrics: initialRoutine.enabledMetrics || { reps: true, kg: true, rir: true, rmPercentage: false, rest: true, tempo: false }
  };
  // Función para obtener datos guardados de forma segura
  const getSavedData = () => {
    // Priorizamos el localStorage ya que es la fuente de verdad de la sesión actual en este dispositivo.
    // Solo usamos routine.clientProgress (nube) si no hay nada local (ej: cambio de dispositivo).
    const saved = localStorage.getItem(`routine_progress_${routine.id}`);
    let localData = null;
    
    if (saved) {
      try {
        localData = JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing saved progress:', e);
      }
    }

    // Si tenemos datos locales, los devolvemos directamente.
    // No sobreescribimos el localStorage aquí (es un efecto secundario que no debe ir en el render).
    if (localData) return localData;

    // Si no hay datos locales, devolvemos lo que venga de la nube (si existe).
    return (routine.clientProgress && Object.keys(routine.clientProgress).length > 0) ? routine.clientProgress : null;
  };

  const savedData = getSavedData();

  const [completedSets, setCompletedSets] = useState<Record<string, boolean>>(savedData?.completedSets || {});
  const [clientWeights, setClientWeights] = useState<Record<string, string>>(savedData?.clientWeights || {});
  const [clientReps, setClientReps] = useState<Record<string, string>>(savedData?.clientReps || {});
  const [feelings, setFeelings] = useState<Record<string, string>>(savedData?.feelings || {});
  const [timer, setTimer] = useState<number | null>(null);
  const [language, setLanguage] = useState<'es' | 'en' | 'it'>(savedData?.language || 'es');
  const [weeklySnapshots, setWeeklySnapshots] = useState<Record<string, Record<string, number>>>(savedData?.weeklySnapshots || routine.clientProgress?.weeklySnapshots || {});
  const [scrollPositions, setScrollPositions] = useState<Record<string, number>>(savedData?.scrollPositions || {});

  // Tabs: 'training' o 'overload'
  const [activeTab, setActiveTab] = useState<'training' | 'overload'>('training');
  const [activeSupersetInteraction, setActiveSupersetInteraction] = useState<{
    label: string;
    exerciseIndex: number;
    setIndex: number;
  } | null>(null);

  const t = (key: string) => {
    const translations: Record<string, Record<string, string>> = {
      es: {
        week: 'Semana',
        day: 'Día',
        addDay: 'Agregar Día',
        startDay: 'Empezar Día',
        finishWorkout: 'Terminar Entrenamiento',
        feedbackSent: '¡Feedback Enviado!',
        feedbackDesc: 'Tu coach recibirá tus sensaciones y progresos. ¡Excelente trabajo hoy!',
        closeSession: 'Cerrar Sesión',
        howWasWorkout: '¿Qué tal estuvo el entrenamiento de hoy?',
        comments: 'Comentarios para tu Coach',
        sendSummary: 'Enviar Resumen',
        keepEditing: 'Seguir Editando',
        selectDay: 'Selecciona un día para empezar',
        noContent: 'Tu coach aún no ha cargado contenido',
        pause: 'Pausa',
        tip: 'Tip',
        set: 'SERIE',
        reps: 'REPS',
        kg: 'KG',
        rir: 'RIR',
        rm: '% RM',
        tempo: 'TEMPO',
        rest: 'PAUSA',
        ok: 'OK',
        dayCompleted: '¡Día Completado!',
        hello: 'Hola',
        loading: 'Cargando...',
        notesPlaceholder: 'Notas específicas para este ejercicio...',
        feedbackPlaceholder: 'Contanos cómo te sentiste, pesos, fatiga...',
        warmup: 'Calentamiento'
      },
      en: {
        week: 'Week',
        day: 'Day',
        addDay: 'Add Day',
        startDay: 'Start Day',
        finishWorkout: 'Finish Workout',
        feedbackSent: 'Feedback Sent!',
        feedbackDesc: 'Your coach will receive your progress. Great job today!',
        closeSession: 'Close Session',
        howWasWorkout: 'How was your workout today?',
        comments: 'Comments for your Coach',
        sendSummary: 'Send Summary',
        keepEditing: 'Keep Editing',
        selectDay: 'Select a day to start',
        noContent: 'Your coach has not uploaded content yet',
        pause: 'Rest',
        tip: 'Tip',
        set: 'SET',
        reps: 'REPS',
        kg: 'KG',
        rir: 'RIR',
        rm: '% RM',
        tempo: 'TEMPO',
        rest: 'REST',
        ok: 'OK',
        dayCompleted: 'Workout Completed!',
        hello: 'Hello',
        loading: 'Loading...',
        notesPlaceholder: 'Specific notes for this exercise...',
        feedbackPlaceholder: 'Tell us how you felt, weights, fatigue...',
        warmup: 'Warmup'
      },
      it: {
        week: 'Settimana',
        day: 'Giorno',
        addDay: 'Aggiungi Giorno',
        startDay: 'Inizia Giorno',
        finishWorkout: 'Termina Allenamento',
        feedbackSent: 'Feedback Inviato!',
        feedbackDesc: 'Il tuo coach riceverà i tuoi progressi. Ottimo lavoro oggi!',
        closeSession: 'Chiudi Sessione',
        howWasWorkout: 'Com\'è andato l\'allenamento oggi?',
        comments: 'Commenti per il tuo Coach',
        sendSummary: 'Invia Riepilogo',
        keepEditing: 'Continua a Modificare',
        selectDay: 'Seleziona un giorno per iniziare',
        noContent: 'Il tuo coach non ha ancora caricato contenuti',
        pause: 'Pausa',
        tip: 'Consiglio',
        set: 'SERIE',
        reps: 'RIPS',
        kg: 'KG',
        rir: 'RIR',
        rm: '% RM',
        tempo: 'TEMPO',
        rest: 'REC',
        ok: 'OK',
        dayCompleted: 'Allenamento Completato!',
        hello: 'Ciao',
        loading: 'Caricamento...',
        notesPlaceholder: 'Note specifiche per questo esercizio...',
        feedbackPlaceholder: 'Raccontaci come ti sei sentito, pesi, fatica...',
        warmup: 'Riscaldamento'
      }
    };
    return translations[language][key] || key;
  };

  const getTranslatedName = (name: string, type: 'week' | 'day') => {
    // Si el nombre es el default (Week X o Día X), lo traducimos dinámicamente
    const numMatch = name.match(/\d+/);
    if (numMatch) {
      if (type === 'week' && name.toLowerCase().includes('week')) {
        return `${t('week')} ${numMatch[0]}`;
      }
      if (type === 'day' && (name.toLowerCase().includes('día') || name.toLowerCase().includes('dia') || name.toLowerCase().includes('day'))) {
        return `${t('day')} ${numMatch[0]}`;
      }
    }
    return name;
  };

  const [activeWeekId, setActiveWeekId] = useState<string | null>(savedData?.activeWeekId || routine.weeks[0]?.id || null);
  const [activeWorkoutId, setActiveWorkoutId] = useState<string | null>(savedData?.activeWorkoutId || null);

  // Estados para el Feedback Final
  const [showFeedbackScreen, setShowFeedbackScreen] = useState(false);
  const [rating, setRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (activeWeekId) {
      const week = routine.weeks.find(w => w.id === activeWeekId);
      if (week && week.workouts.length > 0) {
        // Solo establecer el primer día si NO hay uno ya seleccionado o cargado
        if (!activeWorkoutId) {
          setActiveWorkoutId(week.workouts[0].id);
        } else {
          // Si hay uno seleccionado, verificar que pertenezca a esta semana
          const belongsToWeek = week.workouts.some(wk => wk.id === activeWorkoutId);
          if (!belongsToWeek) {
            setActiveWorkoutId(week.workouts[0].id);
          }
        }
      }
    }
  }, [activeWeekId, routine.weeks]);

  /* Timer Logic using robust Date.now() diff for main thread stability */
  useEffect(() => {
    let interval: number;

    if (timer !== null && timer > 0) {
      const endTime = Date.now() + timer * 1000;

      interval = window.setInterval(() => {
        const remaining = Math.ceil((endTime - Date.now()) / 1000);

        if (remaining <= 0) {
          setTimer(null);
          playAlarm();
          clearInterval(interval);
          setTimeout(() => alert('🔔 ¡Tiempo de descanso completado!'), 150);
        } else {
          setTimer(remaining);
        }
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [timer]);

  const saveProgress = async () => {
    if (!activeWorkoutId) return;

    // Calcular el snapshot de la semana actual
    const currentWeekSnapshot: Record<string, number> = {};
    const week = routine.weeks.find(w => w.id === activeWeekId);
    if (week) {
      week.workouts.forEach(workout => {
        workout.exercises.forEach(entry => {
          let maxKg = 0;
          let hasSets = false;
          entry.sets.forEach(set => {
            if (completedSets[set.id]) {
              const kg = parseFloat(clientWeights[set.id] || set.kg);
              if (!isNaN(kg)) {
                if (kg > maxKg) maxKg = kg;
                hasSets = true;
              }
            }
          });
          if (hasSets) {
            // Si hay varios del mismo ejercicio en la misma semana, guardamos el máximo global de la semana
            if (currentWeekSnapshot[entry.libraryExerciseId]) {
              currentWeekSnapshot[entry.libraryExerciseId] = Math.max(currentWeekSnapshot[entry.libraryExerciseId], maxKg);
            } else {
              currentWeekSnapshot[entry.libraryExerciseId] = maxKg;
            }
          }
        });
      });
    }

    const newSnapshots = {
      ...weeklySnapshots,
      ...(activeWeekId && Object.keys(currentWeekSnapshot).length > 0 ? { [activeWeekId]: currentWeekSnapshot } : {})
    };

    // Update local state lightly
    if (activeWeekId && Object.keys(currentWeekSnapshot).length > 0) {
      setWeeklySnapshots(newSnapshots);
    }

    const currentScrollPosition = window.scrollY;
    
    const progressData = {
      completedSets,
      clientWeights,
      clientReps,
      feelings,
      activeWeekId,
      activeWorkoutId,
      language,
      weeklySnapshots: newSnapshots,
      scrollPositions: {
        ...scrollPositions,
        ...(activeWorkoutId ? { [activeWorkoutId]: currentScrollPosition } : {})
      }
    };

    localStorage.setItem(`routine_progress_${routine.id}`, JSON.stringify(progressData));

    // Guardado en la nube: Sincronizar el progreso real con Supabase
    try {
      await supabase
        .from('routines')
        .update({ data: { ...routine, clientProgress: progressData } })
        .eq('id', routine.id);
    } catch (err) {
      console.error('Error synchronizing progress to Supabase:', err);
    }

    // Actualizar el estado local para la próxima vez
    if (activeWorkoutId) {
      setScrollPositions(prev => ({ ...prev, [activeWorkoutId]: currentScrollPosition }));
    }
  };

  // Debounced Autosave
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (Object.keys(completedSets).length > 0 || Object.keys(clientWeights).length > 0 || Object.keys(clientReps).length > 0 || Object.keys(feelings).length > 0 || activeWeekId || activeWorkoutId) {
        saveProgress();
      }
    }, 2000); // Save after 2 seconds of inactivity
    return () => clearTimeout(timeoutId);
  }, [completedSets, clientWeights, clientReps, feelings, activeWeekId, activeWorkoutId]);

  // Cargamos inicialmente en el useState, así que el useEffect de carga ya no es necesario
  // pero mantendremos este por si cambia el routine.id
  useEffect(() => {
    const data = getSavedData();
    if (data) {
      if (data.completedSets) setCompletedSets(data.completedSets);
      if (data.clientWeights) setClientWeights(data.clientWeights);
      if (data.clientReps) setClientReps(data.clientReps);
      if (data.feelings) setFeelings(data.feelings);
      if (data.activeWeekId) setActiveWeekId(data.activeWeekId);
      if (data.activeWorkoutId) setActiveWorkoutId(data.activeWorkoutId);
      if (data.language) setLanguage(data.language);
      if (data.scrollPositions) setScrollPositions(data.scrollPositions);
    }
  }, [routine.id]);

  // Restaurar el scroll al cambiar de entrenamiento
  useEffect(() => {
    if (activeWorkoutId && scrollPositions[activeWorkoutId] !== undefined) {
      // Un pequeño delay para que React termine de renderizar la rutina
      const timer = setTimeout(() => {
        window.scrollTo({
          top: scrollPositions[activeWorkoutId],
          behavior: 'instant'
        } as any);
      }, 150);
      return () => clearTimeout(timer);
    } else {
       window.scrollTo(0, 0);
    }
  }, [activeWorkoutId]);

  const initAudio = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  };

  /* Audio Unlock Hack for Mobile Safari/Chrome Background Audio */
  const unlockAudio = () => {
    if (!audioContextRef.current) initAudio();
    const ctx = audioContextRef.current;
    if (ctx && ctx.state !== 'running') ctx.resume();

    // Play silent buffer to keep audio thread active
    if (ctx) {
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    }
  };

  const playAlarm = () => {
    try {
      if (!audioContextRef.current) initAudio();
      const ctx = audioContextRef.current!;
      if (ctx.state === 'suspended') ctx.resume();

      const playNote = (freq: number, startTime: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.5, startTime + 0.05); // Increased volume
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      // Play a triple beep sequence
      const now = ctx.currentTime;
      playNote(880, now, 0.2);
      playNote(880, now + 0.3, 0.2);
      playNote(880, now + 0.6, 0.4);
    } catch (e) { console.error('Audio error:', e); }
  };

  const handleSetToggle = (setId: string, restTime: string) => {
    initAudio();
    const isNowCompleted = !completedSets[setId];
    setCompletedSets(prev => ({ ...prev, [setId]: isNowCompleted }));

    if (isNowCompleted && routine.enabledMetrics.rest) {
      // If we are in interactive mode, we might want to auto-advance
      if (activeSupersetInteraction) {
        // Logic for auto-advancing will be handled in the interactive UI component
      }

      const parts = restTime.split(':');
      let seconds = 0;
      if (parts.length === 2) {
        seconds = (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0);
      } else {
        seconds = parseInt(parts[0]) || 0;
      }

      if (seconds > 0) {
        unlockAudio(); // Try to keep audio active
        setTimer(seconds);
      }
    } else {
      setTimer(null);
    }
  };

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const currentWeek = routine.weeks.find(w => w.id === activeWeekId);
  const currentWorkout = currentWeek?.workouts.find(wk => wk.id === activeWorkoutId);

  const handleSubmitFeedback = async () => {
    if (rating === 0) {
      alert(language === 'es' ? 'Por favor selecciona una puntuación con las estrellas.' : language === 'en' ? 'Please select a rating.' : 'Per favore seleziona un punteggio.');
      return;
    }

    if (isSubmitting) return; // Guard against multiple clicks
    setIsSubmitting(true);

    // Al usar localStorage, simplemente nos aseguramos de que todo esté guardado localmente
    saveProgress();

    // 1. Generar Resumen del Entrenamiento
    const summary = currentWorkout?.exercises.map(entry => {
      const libEx = library.find(l => l.id === entry.libraryExerciseId);
      const exerciseSets = entry.sets.map((set, idx) => {
        const kg = clientWeights[set.id] || set.kg;
        const reps = clientReps[set.id] || set.reps;
        return `Set ${idx + 1}: ${reps} reps @ ${kg}kg`;
      }).join('\n');
      const note = feelings[entry.id] ? `\nNota: ${feelings[entry.id]}` : '';
      return `--- ${libEx?.name} ---\n${exerciseSets}${note}`;
    }).join('\n\n');

    const fullMessage = `
Rutina: ${routine.name}
Cliente: ${routine.clientName}
Entrenamiento: ${currentWorkout?.name}
Puntuación: ${rating}/5 estrellas

DETALLES:
${summary}

COMENTARIOS FINALES:
${feedbackText || 'Sin comentarios adicionales.'}
    `;

    // 2. Enviar vía EmailJS (Configuración del usuario)
    const serviceId = 'service_2e0ckic';
    const templateId = 'template_0r9pqlp';
    const publicKey = 'Y5DaMTsCcNIrtI7Ld';
    const targetEmail = 'sortinofitnes@gmail.com';

    emailjs.init(publicKey);

    try {
      console.log("Intentando enviar mail directo con EmailJS...");
      await emailjs.send(serviceId, templateId, {
        routine_name: routine.name,
        client_name: routine.clientName,
        workout_name: currentWorkout?.name,
        summary: fullMessage,
        to_email: targetEmail
      }, publicKey);
      console.log("Envío de mail exitoso.");
      setIsSubmitted(true);
    } catch (error: any) {
      console.error("Error al enviar email:", error);
      alert(`⚠️ Error EmailJS: ${error?.text || error?.message}\n\nDEBUG INFO:\nTemplate: ${templateId}\nService: ${serviceId}\nPublic Key: ${publicKey}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Pantalla de Feedback / Finalización
  if (showFeedbackScreen) {
    return (
      <div className="max-w-xl mx-auto px-6 py-20 min-h-screen flex flex-col justify-center animate-in fade-in duration-500">
        <div className="bg-white dark:bg-darkCard rounded-[3rem] p-10 shadow-2xl border border-slate-100 dark:border-slate-800 text-center">
          {!isSubmitted ? (
            <>
              <div className="w-20 h-20 bg-yellow-500 text-black rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-xl shadow-yellow-500/30">
                <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              </div>
              <h2 className="text-4xl font-black text-slate-900 dark:text-white mb-4 tracking-tighter uppercase">{t('dayCompleted')}</h2>
              <p className="text-slate-950 dark:text-white font-bold mb-10">{t('howWasWorkout')}</p>

              {/* Estrellas */}
              <div className="flex justify-center gap-3 mb-12">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    className={`transition-all transform hover:scale-110 active:scale-90 ${rating >= star ? 'text-yellow-500' : 'text-slate-200 dark:text-slate-600'}`}
                  >
                    <svg className="w-12 h-12 fill-current" viewBox="0 0 24 24">
                      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                    </svg>
                  </button>
                ))}
              </div>

              <div className="space-y-6">
                <div className="text-left space-y-2">
                  <label className="text-[10px] font-black text-slate-900 dark:text-slate-300 uppercase tracking-widest ml-4">{t('comments')}</label>
                  <textarea
                    placeholder={t('feedbackPlaceholder')}
                    className="w-full bg-slate-100 dark:bg-black p-6 rounded-[2rem] border-2 border-transparent focus:border-yellow-600 outline-none transition-all h-36 text-slate-800 dark:text-slate-200 font-medium shadow-inner"
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                  />
                </div>
                <button
                  onClick={handleSubmitFeedback}
                  disabled={isSubmitting}
                  className={`w-full py-6 bg-yellow-500 text-black rounded-[2rem] font-black uppercase tracking-widest shadow-xl transition-all active:scale-95 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-yellow-500'}`}
                >
                  {isSubmitting ? t('loading') : t('sendSummary')}
                </button>
                <button
                  onClick={() => setShowFeedbackScreen(false)}
                  className="w-full py-2 text-slate-900 dark:text-slate-400 font-black uppercase text-[10px] tracking-[0.2em] hover:text-slate-900 dark:hover:text-white transition-all"
                >
                  {t('keepEditing')}
                </button>
              </div>
            </>
          ) : (
            <div className="animate-in zoom-in duration-500">
              <div className="w-24 h-24 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto mb-8 shadow-2xl">
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>
              </div>
              <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-4 uppercase tracking-tighter">{t('feedbackSent')}</h2>
              <p className="text-slate-950 dark:text-white font-bold mb-10 leading-relaxed">{t('feedbackDesc')}</p>
              <button
                onClick={() => {
                  setShowFeedbackScreen(false);
                  setIsSubmitted(false);
                  setRating(0);
                  setFeedbackText('');
                }}
                className="px-12 py-5 bg-slate-900 dark:bg-white dark:text-black text-white rounded-2xl font-black uppercase tracking-widest shadow-lg hover:scale-105 transition-all"
              >
                {t('closeSession')}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 pt-24 pb-48 lg:py-12 lg:pb-48 dark:bg-black min-h-screen">

      {/* Timer flotante estilo iOS */}
      {timer !== null && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 bg-yellow-500 text-black px-8 py-5 rounded-[3rem] shadow-[0_20px_50px_rgba(250,204,21,0.4)] z-[150] flex items-center gap-8 border border-white/20 backdrop-blur-md animate-in slide-in-from-bottom-12 duration-500">
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase opacity-80 tracking-widest mb-0.5">{t('pause')}</span>
            <span className="text-4xl font-black tabular-nums tracking-tighter leading-none">{formatTime(timer)}</span>
          </div>
          <div className="flex gap-3">
            <button onClick={() => { unlockAudio(); setTimer(t => (t !== null ? t + 30 : 30)); }} className="px-5 py-2.5 bg-white/20 rounded-2xl font-black text-[10px] uppercase transition-colors">+30s</button>
            <button onClick={() => setTimer(null)} className="p-3 bg-white/10 hover:bg-red-500 rounded-full transition-all">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      )}

      {/* Portada */}
      <div className="bg-white dark:bg-darkCard rounded-[3rem] shadow-xl overflow-hidden mb-10 border border-slate-100 dark:border-slate-800 transition-colors">
        <div className="relative h-72">
          <img src={routine.image} alt={routine.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent flex flex-col justify-end p-6 lg:p-10">
            {/* Language Selector */}
            <div className="absolute top-6 right-6 flex gap-2">
              <button onClick={() => setLanguage('es')} className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-[10px] transition-all ${language === 'es' ? 'bg-yellow-500 text-black scale-110 shadow-lg' : 'bg-black/40 text-white backdrop-blur-sm'}`}>ES</button>
              <button onClick={() => setLanguage('en')} className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-[10px] transition-all ${language === 'en' ? 'bg-yellow-500 text-black scale-110 shadow-lg' : 'bg-black/40 text-white backdrop-blur-sm'}`}>EN</button>
              <button onClick={() => setLanguage('it')} className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-[10px] transition-all ${language === 'it' ? 'bg-yellow-500 text-black scale-110 shadow-lg' : 'bg-black/40 text-white backdrop-blur-sm'}`}>IT</button>
            </div>

            <h1 className="text-3xl lg:text-5xl font-black text-white mb-2 tracking-tighter uppercase">{routine.name}</h1>
            <p className="text-yellow-600 font-black text-[10px] lg:text-xs uppercase tracking-widest">{t('hello')}, {routine.clientName}</p>
          </div>
        </div>
        <div className="p-6 lg:p-8">
          <p className="text-slate-950 dark:text-white font-bold text-base lg:text-lg leading-relaxed">"{routine.description}"</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex gap-4 mb-8 bg-slate-200/50 dark:bg-slate-800/50 p-2 rounded-[2rem] overflow-x-auto">
        <button
          onClick={() => setActiveTab('training')}
          className={`flex-1 min-w-[150px] py-4 px-6 rounded-[1.5rem] font-black uppercase tracking-widest text-[10px] sm:text-xs transition-all ${activeTab === 'training' ? 'bg-slate-900 dark:bg-yellow-400 text-yellow-500 dark:text-black shadow-lg scale-100' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-black/50 scale-95'}`}
        >
          🏋️ {language === 'es' ? 'Entrenamiento' : language === 'en' ? 'Training' : 'Allenamento'}
        </button>
        <button
          onClick={() => setActiveTab('overload')}
          className={`flex-1 min-w-[150px] py-4 px-6 rounded-[1.5rem] font-black uppercase tracking-widest text-[10px] sm:text-xs transition-all ${activeTab === 'overload' ? 'bg-slate-900 dark:bg-yellow-400 text-yellow-500 dark:text-black shadow-lg scale-100' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-black/50 scale-95'}`}
        >
          📈 {language === 'es' ? 'Sobrecarga Progresiva' : language === 'en' ? 'Progressive Overload' : 'Sovraccarico Progressivo'}
        </button>
      </div>

      {activeTab === 'training' ? (
        <>
          {/* Navegación Semanas y Días (Dropdowns) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div className="relative group">
              <label className="text-[10px] font-black text-slate-950 dark:text-slate-200 uppercase tracking-widest ml-4 mb-2 block">{t('week')}</label>
              <select
                value={activeWeekId || ''}
                onChange={(e) => setActiveWeekId(e.target.value)}
                className="w-full bg-white dark:bg-darkCard px-6 py-5 rounded-[2rem] font-black uppercase text-sm tracking-widest border border-slate-100 dark:border-slate-800 shadow-lg appearance-none cursor-pointer focus:border-yellow-500 transition-all outline-none"
              >
                {routine.weeks.map(week => (
                  <option key={week.id} value={week.id}>{getTranslatedName(week.name, 'week')}</option>
                ))}
              </select>
              <div className="absolute right-6 bottom-5 pointer-events-none text-yellow-500">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z" /></svg>
              </div>
            </div>

            <div className="relative group">
              <label className="text-[10px] font-black text-slate-950 dark:text-slate-200 uppercase tracking-widest ml-4 mb-2 block">{t('day')}</label>
              <select
                value={activeWorkoutId || ''}
                onChange={(e) => setActiveWorkoutId(e.target.value)}
                className="w-full bg-white dark:bg-darkCard px-6 py-5 rounded-[2rem] font-black uppercase text-sm tracking-widest border border-slate-100 dark:border-slate-800 shadow-lg appearance-none cursor-pointer focus:border-yellow-600 transition-all outline-none"
              >
                {currentWeek?.workouts.map(workout => (
                  <option key={workout.id} value={workout.id}>{getTranslatedName(workout.name, 'day')}</option>
                ))}
              </select>
              <div className="absolute right-6 bottom-5 pointer-events-none text-yellow-600">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z" /></svg>
              </div>
            </div>
          </div>

          {currentWeek ? (
            <div className="space-y-16 lg:space-y-20 animate-in fade-in slide-in-from-left-4 duration-300">
              {currentWorkout ? (
                <div className="space-y-12">
                  <div className="bg-white dark:bg-darkCard rounded-[2.5rem] lg:rounded-[3.5rem] p-5 lg:p-10 shadow-lg border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
                    <h3 className="text-2xl lg:text-3xl font-black text-slate-800 dark:text-slate-100 mb-6 lg:mb-10 border-b-2 border-slate-100 dark:border-slate-800 pb-4 tracking-tight uppercase">{getTranslatedName(currentWorkout.name, 'day')}</h3>

                    {currentWorkout.warmup && (
                      <div className="mb-10 bg-orange-50 dark:bg-orange-500/10 rounded-[2.5rem] p-8 border border-orange-200/50 dark:border-orange-500/30 flex gap-6 items-start">
                        <div className="w-12 h-12 bg-orange-500 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-lg">
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" /></svg>
                        </div>
                        <p className="text-slate-950 dark:text-white font-bold leading-relaxed">{currentWorkout.warmup}</p>
                      </div>
                    )}

                      {(() => {
                        const processedExercises: { type: 'single' | 'superset', label?: string, entries: any[], id: string }[] = [];
                        const processedIds = new Set<string>();

                        currentWorkout.exercises.forEach(ex => {
                          if (processedIds.has(ex.id)) return;
                          
                          if (ex.supersetLabel) {
                            const group = currentWorkout.exercises.filter(e => e.supersetLabel === ex.supersetLabel);
                            processedExercises.push({ type: 'superset', label: ex.supersetLabel, entries: group, id: `group-${ex.supersetLabel}` });
                            group.forEach(ge => processedIds.add(ge.id));
                          } else {
                            processedExercises.push({ type: 'single', entries: [ex], id: ex.id });
                            processedIds.add(ex.id);
                          }
                        });

                        return processedExercises.map((group, gIdx) => {
                          if (group.type === 'superset') {
                            const isInteracting = activeSupersetInteraction?.label === group.label;
                            
                            if (isInteracting && activeSupersetInteraction) {
                              const currentExIdx = activeSupersetInteraction.exerciseIndex;
                              const currentSetIdx = activeSupersetInteraction.setIndex;
                              const currentEntry = group.entries[currentExIdx];
                              const currentSet = currentEntry.sets[currentSetIdx];
                              const libEx = library.find(l => l.id === currentEntry.libraryExerciseId);
                              return (
                                <div key={`interact-${group.label}`} className="bg-white dark:bg-darkCard rounded-2xl p-5 border-2 border-yellow-500 shadow-2xl animate-in zoom-in-95 duration-300">
                                  {/* Progress Tabs */}
                                  <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-hide">
                                    {group.entries.map((ent: any, i: number) => {
                                      const isDone = ent.sets[currentSetIdx] && completedSets[ent.sets[currentSetIdx].id];
                                      return (
                                        <button 
                                          key={ent.id}
                                          onClick={() => setActiveSupersetInteraction(prev => prev ? { ...prev, exerciseIndex: i } : null)}
                                          className={`flex-1 py-2 px-3 rounded-lg border-2 transition-all font-['Oswald'] flex items-center justify-center gap-2 ${
                                            currentExIdx === i 
                                              ? 'bg-yellow-500 border-yellow-500 text-black shadow-md' 
                                              : 'bg-slate-900 border-slate-800 text-slate-500'
                                          }`}
                                        >
                                          <span className="text-[10px] font-black uppercase">EX {i + 1}</span>
                                          {isDone && <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>}
                                        </button>
                                      );
                                    })}
                                  </div>

                                  {/* Focused Exercise Info */}
                                  <div className="flex flex-col items-center text-center mb-4">
                                    <div className="relative mb-3">
                                      <div className="w-20 h-20 rounded-full border-3 border-yellow-500 overflow-hidden shadow-md bg-[#0F1115] flex items-center justify-center p-1">
                                        <img 
                                          src={libEx?.muscleImage || libEx?.imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(libEx?.name || 'EX')}&background=0D0D0D&color=fff&bold=true`} 
                                          className="w-full h-full object-contain"
                                          alt={libEx?.name}
                                        />
                                      </div>
                                      {libEx?.videoUrl && (
                                        <a href={libEx.videoUrl} target="_blank" className="absolute bottom-2 right-2 w-12 h-12 bg-green-500 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-all">
                                          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                        </a>
                                      )}
                                    </div>
                                    <h4 className="text-2xl font-['Oswald'] font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-tight max-w-xs">{libEx?.name}</h4>
                                    <div className="mt-2 px-4 py-1.5 bg-yellow-500 text-black rounded-full text-[9px] font-black uppercase tracking-widest">SERIE {currentSetIdx + 1} DE {currentEntry.sets.length}</div>
                                  </div>

                                  {/* Interactive Metrics */}
                                  <div className="grid grid-cols-2 gap-3 mb-4">
                                    <div className="bg-slate-100 dark:bg-black p-4 rounded-xl border-2 border-transparent focus-within:border-yellow-500 transition-all">
                                      <span className="text-[9px] font-black text-slate-950 dark:text-white uppercase tracking-widest mb-1 block">Reps</span>
                                      <input 
                                        type="text"
                                        className="bg-transparent border-none w-full text-4xl lg:text-5xl font-['Oswald'] font-black text-center text-slate-900 dark:text-white outline-none"
                                        value={clientReps[currentSet.id] !== undefined ? clientReps[currentSet.id] : currentSet.reps}
                                        onChange={(e) => setClientReps(prev => ({ ...prev, [currentSet.id]: e.target.value }))}
                                      />
                                      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 text-[11px] font-black text-slate-950 dark:text-slate-400 uppercase tracking-widest text-center">
                                        OBJETIVO: <span className="text-yellow-600 dark:text-yellow-500">{currentSet.reps}</span>
                                      </div>
                                    </div>
                                    <div className="bg-slate-100 dark:bg-black p-4 rounded-xl border-2 border-transparent focus-within:border-yellow-500 transition-all">
                                      <span className="text-[9px] font-black text-slate-950 dark:text-white uppercase tracking-widest mb-1 block">Kg</span>
                                      <input 
                                        type="tel" 
                                        className="bg-transparent border-none w-full text-4xl lg:text-5xl font-['Oswald'] font-black text-center text-slate-900 dark:text-white outline-none"
                                        value={clientWeights[currentSet.id] !== undefined ? clientWeights[currentSet.id] : currentSet.kg}
                                        onChange={(e) => setClientWeights(prev => ({ ...prev, [currentSet.id]: e.target.value }))}
                                      />
                                      <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-[9px] font-black text-slate-950 dark:text-slate-400 uppercase tracking-widest text-center">
                                        OBJETIVO: <span className="text-yellow-600 dark:text-yellow-500">{currentSet.kg}KG</span>
                                      </div>
                                    </div>
                                  </div>

                                  <button 
                                    onClick={() => {
                                      handleSetToggle(currentSet.id, currentSet.rest);
                                      if (currentExIdx < group.entries.length - 1) {
                                        setActiveSupersetInteraction(prev => prev ? { ...prev, exerciseIndex: currentExIdx + 1 } : null);
                                      } else {
                                        const maxSets = Math.max(...group.entries.map((e: any) => e.sets.length));
                                        if (currentSetIdx < maxSets - 1) {
                                          setActiveSupersetInteraction(prev => prev ? { ...prev, exerciseIndex: 0, setIndex: currentSetIdx + 1 } : null);
                                        } else {
                                          setActiveSupersetInteraction(null);
                                        }
                                      }
                                    }}
                                    className={`w-full py-4 rounded-xl font-['Oswald'] font-black uppercase text-lg tracking-widest flex items-center justify-center gap-4 transition-all active:scale-95 shadow-xl shadow-slate-900/10 dark:shadow-none ${
                                      completedSets[currentSet.id] ? 'bg-green-500 text-white' : 'bg-yellow-500 text-black'
                                    }`}
                                  >
                                    {completedSets[currentSet.id] ? (
                                      <><svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg> {t('set').toUpperCase()} LISTO</>
                                    ) : (
                                      `MARCAR ${t('set').toUpperCase()}`
                                    )}
                                  </button>

                                  <button onClick={() => setActiveSupersetInteraction(null)} className="w-full mt-6 text-[9px] font-bold text-slate-950 dark:text-slate-200 uppercase tracking-widest hover:text-red-500 transition-all">TERMINAR MODO ENFOCADO</button>
                                </div>
                              );
                            }

                            return (
                              <div key={`group-${group.label}`} className="bg-slate-100/30 dark:bg-white/5 rounded-xl p-6 lg:p-8 border border-slate-200 dark:border-slate-800 space-y-8 shadow-sm">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                                  <div className="flex items-center gap-6">
                                    <div className="w-12 h-12 bg-yellow-500 text-black rounded-2xl flex items-center justify-center shadow-lg shadow-yellow-500/20 ring-4 ring-yellow-500/5 shrink-0">
                                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                    </div>
                                    <div className="space-y-6">
                                      <h3 className="text-2xl lg:text-4xl font-['Oswald'] font-black text-slate-900 dark:text-white uppercase tracking-tighter whitespace-nowrap">SUPERSERIE {group.label}</h3>
                                      <div className="flex items-center gap-2 mt-1">
                                        <div className="flex -space-x-4">
                                          {group.entries.slice(0, 3).map((e: any, i: number) => {
                                            const ex = library.find(l => l.id === e.libraryExerciseId);
                                            return (
                                              <div key={i} className="w-8 h-8 rounded-full border-2 border-white dark:border-darkCard bg-slate-200 dark:bg-slate-800 overflow-hidden p-0.5">
                                                <img src={ex?.muscleImage || ex?.imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(ex?.name || 'EX')}&background=0D0D0D&color=fff&bold=true`} className="w-full h-full object-contain rounded-full" alt="EX" />
                                              </div>
                                            );
                                          })}
                                        </div>
                                        <p className="text-[10px] font-black text-slate-900 dark:text-slate-400 uppercase tracking-widest ml-2">{group.entries.length} EJERCICIOS</p>
                                      </div>
                                    </div>
                                  </div>
                                  <button 
                                    onClick={() => setActiveSupersetInteraction({ label: group.label, exerciseIndex: 0, setIndex: 0 })}
                                    className="w-full sm:w-auto px-6 py-4 bg-yellow-500 text-black rounded-lg font-['Oswald'] font-black uppercase text-xs tracking-[0.2em] hover:scale-105 transition-all shadow-lg shadow-yellow-500/10"
                                  >
                                    EMPEZAR SUPERSERIE
                                  </button>
                                </div>

                                <div className="space-y-4 relative ml-5 border-l-2 border-dashed border-yellow-200 dark:border-yellow-900/40 pl-8 py-1">
                                  {group.entries.sort((a: any, b: any) => (a.supersetOrder || 0) - (b.supersetOrder || 0)).map((ent: any, idx: number) => {
                                    const ex = library.find(l => l.id === ent.libraryExerciseId);
                                    return (
                                      <div key={ent.id} className="relative group/item">
                                        <div className="absolute -left-[49px] top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-yellow-500 ring-4 ring-white dark:ring-black"></div>
                                        <div className="flex items-center gap-3 lg:gap-4 p-3 lg:p-4 bg-white dark:bg-black/30 rounded-2xl border border-slate-100 dark:border-slate-800/50 shadow-sm hover:shadow-md transition-all">
                                          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden p-1 flex items-center justify-center shrink-0">
                                            <img 
                                              src={ex?.muscleImage || ex?.imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(ex?.name || 'EX')}&background=0D0D0D&color=fff&bold=true`} 
                                              className="w-full h-full object-contain"
                                              alt={ex?.name}
                                            />
                                          </div>
                                          <div className="flex-1">
                                            <span className="text-[8px] font-black text-yellow-500 uppercase tracking-widest mb-1 block">Ejercicio {idx + 1}</span>
                                            <span className="block font-black text-sm lg:text-lg text-slate-800 dark:text-slate-200 uppercase tracking-tighter leading-[1.1]">{ex?.name}</span>
                                            <div className="flex items-center gap-2 mt-2">
                                              <span className="text-[10px] font-black text-yellow-600 dark:text-yellow-500 uppercase tracking-widest bg-yellow-500/10 px-2 py-0.5 rounded-md">{ent.sets[0]?.reps} REPS</span>
                                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">•</span>
                                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{ent.sets[0]?.kg} KG</span>
                                            </div>
                                          </div>
                                          <div className="shrink-0 ml-auto pl-4">
                                            <span className="inline-block bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-3 py-1 rounded-lg text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">{ent.sets.length} SETS</span>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          }
                          return (
                            <ExerciseBlock 
                              key={group.entries[0].id} 
                              entry={group.entries[0]} 
                              library={library} 
                              t={t} 
                              routine={routine} 
                              completedSets={completedSets} 
                              clientReps={clientReps} 
                              clientWeights={clientWeights} 
                              setClientReps={setClientReps} 
                              setClientWeights={setClientWeights} 
                              handleSetToggle={handleSetToggle} 
                              feelings={feelings} 
                              setFeelings={setFeelings}
                            />
                          );
                        });
                      })()}
                  </div>

                  {/* Botón Finalizar Entrenamiento */}
                  <div className="pt-10 flex justify-center">
                    <button
                      onClick={() => {
                        initAudio();
                        setShowFeedbackScreen(true);
                      }}
                      className="w-full max-w-md py-8 bg-slate-900 dark:bg-white text-white dark:text-black rounded-[2.5rem] font-black uppercase tracking-[0.2em] text-xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] dark:shadow-[0_20px_50px_rgba(255,255,255,0.05)] hover:scale-105 active:scale-95 transition-all animate-bounce-slow"
                    >
                      {t('finishWorkout')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-24 bg-white dark:bg-darkCard rounded-[3rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
                  <p className="font-bold text-slate-900 uppercase tracking-widest text-sm">{t('selectDay')}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="font-black text-slate-300 dark:text-slate-700 uppercase tracking-widest text-xl">{t('noContent')}</p>
            </div>
          )}
        </>
      ) : (
        <ProgressiveOverloadTab
          routine={routine}
          library={library}
          weeklySnapshots={weeklySnapshots}
          language={language}
        />
      )}

      <style>{`
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 2s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default ClientView;
