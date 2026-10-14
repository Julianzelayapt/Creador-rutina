import React, { useState, useEffect, useRef } from 'react';
import emailjs from '@emailjs/browser';
import { Routine, Exercise } from '../types';
import { supabase } from '../supabase';
import ProgressiveOverloadTab from './ProgressiveOverloadTab';

interface ClientViewProps {
  routine: Routine;
  library: Exercise[];
}

// Helper to convert any video URL into an embedded player
const getEmbedVideo = (url: string | undefined) => {
  if (!url) return null;
  const trimmed = url.trim();

  // YouTube detection (watch, share, shorts, embed)
  const ytMatch = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
  if (ytMatch && ytMatch[1]) {
    return {
      type: 'youtube' as const,
      src: `https://www.youtube.com/embed/${ytMatch[1]}?playsinline=1&modestbranding=1&rel=0`
    };
  }

  // Vimeo detection
  const vimeoMatch = trimmed.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch && vimeoMatch[1]) {
    return {
      type: 'vimeo' as const,
      src: `https://player.vimeo.com/video/${vimeoMatch[1]}`
    };
  }

  // Direct video file (.mp4, .webm, .mov)
  if (/\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(trimmed)) {
    return {
      type: 'direct' as const,
      src: trimmed
    };
  }

  // Fallback
  return {
    type: 'link' as const,
    src: trimmed
  };
};

const ClientView: React.FC<ClientViewProps> = ({ routine: initialRoutine, library }) => {
  const routine = {
    ...initialRoutine,
    enabledMetrics: initialRoutine.enabledMetrics || { reps: true, kg: true, rir: true, rmPercentage: false, rest: true, tempo: false }
  };

  // Safe load of saved progress
  const getSavedData = () => {
    const saved = localStorage.getItem(`routine_progress_${routine.id}`);
    let localData = null;
    if (saved) {
      try {
        localData = JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing saved progress:', e);
      }
    }
    if (localData) return localData;
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

  // Tab & View Navigation
  const [activeTab, setActiveTab] = useState<'training' | 'overload'>('training');
  // Navigation inside 'training': 'dashboard' (weeks + focus cards) | 'preview' (focus overview) | 'active' (workout mode)
  const [viewMode, setViewMode] = useState<'dashboard' | 'preview' | 'active'>('dashboard');
  const [activeWeekId, setActiveWeekId] = useState<string | null>(savedData?.activeWeekId || routine.weeks[0]?.id || null);
  const [activeWorkoutId, setActiveWorkoutId] = useState<string | null>(savedData?.activeWorkoutId || null);

  // Modals & UI States
  const [showFinishModal, setShowFinishModal] = useState<boolean>(false);
  const [showFeedbackScreen, setShowFeedbackScreen] = useState<boolean>(false);
  const [historyExerciseId, setHistoryExerciseId] = useState<string | null>(null);
  const [collapsedExercises, setCollapsedExercises] = useState<Record<string, boolean>>({});
  const [rating, setRating] = useState<number>(0);
  const [feedbackText, setFeedbackText] = useState<string>('');
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error' | null>(null);

  const isDirtyRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Translations
  const t = (key: string) => {
    const translations: Record<string, Record<string, string>> = {
      es: {
        weeks: 'Semanas',
        workouts: 'Días',
        completed: 'Completado',
        startWorkout: 'Start Workout',
        keepTraining: 'Seguir Entrenando',
        finishAnyway: 'Terminar de Todos Modos',
        finishWorkout: 'Terminar',
        finishTitle: '¿Terminar este entrenamiento?',
        finishDesc: 'Aún te quedan series por registrar. Si terminás ahora, se guardará todo lo que hiciste hoy.',
        viewHistory: 'Historial',
        exercisesCount: 'ejercicios',
        totalSets: 'SERIES TOTALES',
        tip: 'Tips del Coach',
        addNote: 'Añadir nota para este ejercicio...',
        set: 'SERIE',
        reps: 'REPS',
        kg: 'KG',
        rir: 'RIR',
        rm: '% RM',
        tempo: 'TEMPO',
        rest: 'DESCANSO',
        ok: 'OK',
        pause: 'Descanso',
        dayCompleted: '¡Entrenamiento Terminado!',
        howWasWorkout: '¿Cómo sentiste el entrenamiento de hoy?',
        comments: 'Comentarios para tu coach',
        sendSummary: 'Enviar Resumen',
        keepEditing: 'Volver a la rutina',
        closeSession: 'Cerrar Sesión',
        feedbackSent: '¡Feedback Enviado con Éxito!',
        feedbackDesc: 'Tu coach recibirá tu reporte detallado. ¡Gran trabajo hoy!',
        loading: 'Guardando...',
        syncing: 'Sincronizando...',
        synced: 'Guardado en la nube',
        syncError: 'Error al sincronizar',
        warmup: 'Calentamiento',
        noWorkouts: 'No hay días cargados en esta semana.',
        coachMode: 'Coach Mode',
        setsLogged: 'series registradas',
        of: 'de'
      },
      en: {
        weeks: 'Weeks',
        workouts: 'Workouts',
        completed: 'Completed',
        startWorkout: 'Start Workout',
        keepTraining: 'Keep Training',
        finishAnyway: 'Finish Anyway',
        finishWorkout: 'Finish',
        finishTitle: 'Finish this workout?',
        finishDesc: "You've still got sets to go. Finishing ends the workout and saves what you've logged so far.",
        viewHistory: 'History',
        exercisesCount: 'exercises',
        totalSets: 'TOTAL SETS',
        tip: "Coach's Tip",
        addNote: 'Add a note for this exercise...',
        set: 'SET',
        reps: 'REPS',
        kg: 'KG',
        rir: 'RIR',
        rm: '% RM',
        tempo: 'TEMPO',
        rest: 'REST',
        ok: 'OK',
        pause: 'Rest',
        dayCompleted: 'Workout Completed!',
        howWasWorkout: 'How was your workout today?',
        comments: 'Comments for your coach',
        sendSummary: 'Send Summary',
        keepEditing: 'Keep Editing',
        closeSession: 'Close Session',
        feedbackSent: 'Feedback Sent!',
        feedbackDesc: 'Your coach will receive your progress report. Great job today!',
        loading: 'Saving...',
        syncing: 'Syncing...',
        synced: 'Saved to cloud',
        syncError: 'Error syncing',
        warmup: 'Warmup',
        noWorkouts: 'No workouts in this week.',
        coachMode: 'Coach Mode',
        setsLogged: 'sets logged',
        of: 'of'
      },
      it: {
        weeks: 'Settimane',
        workouts: 'Allenamenti',
        completed: 'Completato',
        startWorkout: 'Start Workout',
        keepTraining: 'Continua ad allenarti',
        finishAnyway: 'Termina comunque',
        finishWorkout: 'Termina',
        finishTitle: 'Terminare questo allenamento?',
        finishDesc: 'Hai ancora serie da completare. Terminare adesso salverà tutto quanto registrato.',
        viewHistory: 'Cronologia',
        exercisesCount: 'esercizi',
        totalSets: 'SERIE TOTALI',
        tip: 'Consigli del Coach',
        addNote: 'Aggiungi una nota...',
        set: 'SERIE',
        reps: 'RIPS',
        kg: 'KG',
        rir: 'RIR',
        rm: '% RM',
        tempo: 'TEMPO',
        rest: 'REC',
        ok: 'OK',
        pause: 'Pausa',
        dayCompleted: 'Allenamento Terminato!',
        howWasWorkout: "Com'è andato l'allenamento di oggi?",
        comments: 'Commenti per il tuo coach',
        sendSummary: 'Invia Riepilogo',
        keepEditing: 'Continua Modifica',
        closeSession: 'Chiudi Sessione',
        feedbackSent: 'Feedback Inviato!',
        feedbackDesc: 'Il tuo coach riceverà il tuo report dettagliato. Ottimo lavoro!',
        loading: 'Salvataggio...',
        syncing: 'Sincronizzazione...',
        synced: 'Salvato nel cloud',
        syncError: 'Errore cloud',
        warmup: 'Riscaldamento',
        noWorkouts: 'Nessun allenamento in questa settimana.',
        coachMode: 'Coach Mode',
        setsLogged: 'serie registrate',
        of: 'di'
      }
    };
    return translations[language][key] || key;
  };

  // Keep activeWeekId valid
  useEffect(() => {
    if (!activeWeekId || !routine.weeks.some(w => w.id === activeWeekId)) {
      if (routine.weeks.length > 0) {
        setActiveWeekId(routine.weeks[0].id);
      }
    }
  }, [routine.weeks, activeWeekId]);

  // Audio initialization for countdown and timer alert
  const initAudio = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  };

  const playAlarm = () => {
    try {
      initAudio();
      const ctx = audioContextRef.current;
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume();

      const playNote = (freq: number, startTime: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.4, startTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      const now = ctx.currentTime;
      playNote(784, now, 0.18);
      playNote(880, now + 0.22, 0.18);
      playNote(1046, now + 0.44, 0.35);

      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 300]);
      }
    } catch (e) {
      console.error('Audio playback error:', e);
    }
  };

  // Timer countdown hook
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
        } else {
          setTimer(remaining);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  // Save progress helper (local + Supabase)
  const saveProgress = async (syncToCloud = false) => {
    if (!activeWorkoutId) return;

    // Calculate current week snapshot for progressive overload
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

    if (activeWeekId && Object.keys(currentWeekSnapshot).length > 0) {
      setWeeklySnapshots(newSnapshots);
    }

    const progressData = {
      completedSets,
      clientWeights,
      clientReps,
      feelings,
      activeWeekId,
      activeWorkoutId,
      language,
      weeklySnapshots: newSnapshots
    };

    localStorage.setItem(`routine_progress_${routine.id}`, JSON.stringify(progressData));

    if (syncToCloud) {
      try {
        await supabase
          .from('routines')
          .update({ data: { ...routine, clientProgress: progressData } })
          .eq('id', routine.id);
        setSyncStatus('synced');
      } catch (err) {
        console.error('Error synchronizing progress to Supabase:', err);
        setSyncStatus('error');
      }
    }
  };

  // Immediate local save
  useEffect(() => {
    if (activeWorkoutId) {
      saveProgress(false);
    }
  }, [completedSets, clientWeights, clientReps, feelings, activeWeekId, activeWorkoutId, language]);

  // Debounced cloud sync (2 sec)
  useEffect(() => {
    if (!isDirtyRef.current || !activeWorkoutId) return;
    const timeoutId = setTimeout(() => {
      saveProgress(true);
    }, 2000);
    return () => clearTimeout(timeoutId);
  }, [completedSets, clientWeights, clientReps, feelings, activeWeekId, activeWorkoutId, language]);

  // Set toggle and rest trigger
  const handleSetToggle = (setId: string, restTime: string) => {
    isDirtyRef.current = true;
    setSyncStatus('syncing');
    initAudio();

    const isNowCompleted = !completedSets[setId];
    setCompletedSets(prev => ({ ...prev, [setId]: isNowCompleted }));

    if (isNowCompleted && routine.enabledMetrics.rest) {
      let seconds = 0;
      if (restTime.includes(':')) {
        const parts = restTime.split(':');
        seconds = (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
      } else {
        seconds = parseInt(restTime, 10) || 0;
      }
      if (seconds > 0) {
        setTimer(seconds);
      }
    } else {
      setTimer(null);
    }
  };

  const handleRepsChange = (setId: string, value: string) => {
    isDirtyRef.current = true;
    setSyncStatus('syncing');
    setClientReps(prev => ({ ...prev, [setId]: value }));
  };

  const handleWeightsChange = (setId: string, value: string) => {
    isDirtyRef.current = true;
    setSyncStatus('syncing');
    setClientWeights(prev => ({ ...prev, [setId]: value }));
  };

  const handleFeelingsChange = (exerciseId: string, value: string) => {
    isDirtyRef.current = true;
    setSyncStatus('syncing');
    setFeelings(prev => ({ ...prev, [exerciseId]: value }));
  };

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Find active items
  const currentWeek = routine.weeks.find(w => w.id === activeWeekId);
  const currentWorkout = currentWeek?.workouts.find(wk => wk.id === activeWorkoutId);
  const currentWorkoutIndex = currentWeek?.workouts.findIndex(wk => wk.id === activeWorkoutId) ?? -1;
  const currentWorkoutDisplayTitle = currentWorkout
    ? (/^d[ií]a\s*\d+/i.test(currentWorkout.name.trim())
      ? currentWorkout.name
      : (currentWorkoutIndex >= 0 ? `Día ${currentWorkoutIndex + 1} · ${currentWorkout.name}` : currentWorkout.name))
    : '';

  // Compute total stats across the routine
  const totalWorkouts = routine.weeks.reduce((acc, w) => acc + (w.workouts?.length || 0), 0);
  let totalSetsInRoutine = 0;
  let totalCompletedSetsInRoutine = 0;
  routine.weeks.forEach(w => {
    w.workouts?.forEach(wk => {
      wk.exercises?.forEach(ex => {
        ex.sets?.forEach(s => {
          totalSetsInRoutine++;
          if (completedSets[s.id]) totalCompletedSetsInRoutine++;
        });
      });
    });
  });

  const completionPercent = totalSetsInRoutine > 0
    ? Math.round((totalCompletedSetsInRoutine / totalSetsInRoutine) * 100)
    : 0;

  // Active workout stats
  const activeWorkoutTotalSets = currentWorkout
    ? currentWorkout.exercises.reduce((acc, ex) => acc + (ex.sets?.length || 0), 0)
    : 0;

  const activeWorkoutLoggedSets = currentWorkout
    ? currentWorkout.exercises.reduce((acc, ex) => {
        return acc + ex.sets.filter(s => completedSets[s.id]).length;
      }, 0)
    : 0;

  // Handle Finish button click
  const handleFinishClick = () => {
    initAudio();
    if (activeWorkoutLoggedSets < activeWorkoutTotalSets) {
      setShowFinishModal(true);
    } else {
      setShowFeedbackScreen(true);
    }
  };

  // Final Feedback Submission
  const handleSubmitFeedback = async () => {
    if (rating === 0) {
      alert(language === 'es' ? 'Por favor selecciona una puntuación con las estrellas.' : 'Please select a rating with the stars.');
      return;
    }
    if (isSubmitting) return;
    setIsSubmitting(true);

    setSyncStatus('syncing');
    await saveProgress(true);

    const summary = currentWorkout?.exercises.map(entry => {
      const libEx = library.find(l => l.id === entry.libraryExerciseId);
      const exerciseSets = entry.sets.map((set, idx) => {
        const kg = clientWeights[set.id] || set.kg;
        const reps = clientReps[set.id] || set.reps;
        return `Set ${idx + 1}: ${reps} reps @ ${kg}kg`;
      }).join('\n');
      const note = feelings[entry.id] ? `\nNota: ${feelings[entry.id]}` : '';
      return `--- ${libEx?.name || 'Ejercicio'} ---\n${exerciseSets}${note}`;
    }).join('\n\n');

    const fullMessage = `
Rutina: ${routine.name}
Cliente: ${routine.clientName}
Enfoque: ${currentWorkout?.name}
Puntuación: ${rating}/5 estrellas

DETALLES:
${summary}

COMENTARIOS:
${feedbackText || 'Sin comentarios.'}
    `;

    const serviceId = 'service_2e0ckic';
    const templateId = 'template_0r9pqlp';
    const publicKey = 'Y5DaMTsCcNIrtI7Ld';
    const targetEmail = 'sortinofitnes@gmail.com';

    emailjs.init(publicKey);

    try {
      await emailjs.send(serviceId, templateId, {
        routine_name: routine.name,
        client_name: routine.clientName,
        workout_name: currentWorkout?.name,
        summary: fullMessage,
        to_email: targetEmail
      }, publicKey);
      setIsSubmitted(true);
    } catch (error: any) {
      console.error('Error emailjs:', error);
      alert(`⚠️ Error EmailJS: ${error?.text || error?.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ----------------------------------------------------
  // 1. FINAL FEEDBACK SCREEN
  // ----------------------------------------------------
  if (showFeedbackScreen) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col justify-center px-4 py-12 animate-in fade-in duration-300">
        <div className="max-w-md mx-auto w-full bg-[#18181b] border border-white/10 rounded-2xl p-6 sm:p-8 text-center shadow-2xl">
          {!isSubmitted ? (
            <>
              <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-black uppercase tracking-tight mb-2">{t('dayCompleted')}</h2>
              <p className="text-zinc-400 text-sm mb-8">{t('howWasWorkout')}</p>

              {/* Stars */}
              <div className="flex justify-center gap-3 mb-8">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    className="p-1 transition-transform active:scale-90 hover:scale-110"
                  >
                    <svg
                      className={`w-10 h-10 ${rating >= star ? 'text-yellow-400 fill-yellow-400' : 'text-zinc-600 fill-transparent'}`}
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  </button>
                ))}
              </div>

              <div className="space-y-4 text-left">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block ml-1">{t('comments')}</label>
                <textarea
                  placeholder={language === 'es' ? 'Contanos qué tal las cargas, sensaciones...' : 'Leave any comments for your coach...'}
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-2xl p-4 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white/30 resize-none h-32"
                />

                <button
                  onClick={handleSubmitFeedback}
                  disabled={isSubmitting}
                  className="w-full py-4 bg-white text-black font-bold uppercase tracking-wider rounded-full shadow-lg hover:bg-zinc-200 active:scale-95 transition-all text-sm"
                >
                  {isSubmitting ? t('loading') : t('sendSummary')}
                </button>

                <button
                  onClick={() => setShowFeedbackScreen(false)}
                  className="w-full py-3 text-zinc-400 hover:text-white text-xs font-semibold uppercase tracking-wider transition-colors"
                >
                  {t('keepEditing')}
                </button>
              </div>
            </>
          ) : (
            <div className="py-6">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-black uppercase tracking-tight mb-3">{t('feedbackSent')}</h2>
              <p className="text-zinc-400 text-sm leading-relaxed mb-8">{t('feedbackDesc')}</p>
              <button
                onClick={() => {
                  setShowFeedbackScreen(false);
                  setIsSubmitted(false);
                  setViewMode('dashboard');
                }}
                className="w-full py-4 bg-white text-black font-bold uppercase tracking-wider rounded-full shadow-lg hover:bg-zinc-200 active:scale-95 transition-all text-sm"
              >
                {t('closeSession')}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // MAIN CONTAINER (Aesthetic: Fitpros / iOS Clean Dark)
  // ----------------------------------------------------
  return (
    <div className="min-h-screen bg-black text-white font-['Inter'] selection:bg-zinc-800 pb-36">

      {/* Floating Rest Timer (iOS Frosted Glass Style) */}
      {timer !== null && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-top-6 duration-300">
          <div className="bg-zinc-900/85 backdrop-blur-2xl border border-white/15 text-white px-6 py-3 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex items-center gap-5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
              <span className="text-xs font-semibold tracking-wider uppercase text-zinc-400">{t('pause')}</span>
            </div>
            <span className="text-2xl font-black tabular-nums tracking-tight font-mono">{formatTime(timer)}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTimer(t => (t !== null ? t + 30 : 30))}
                className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-full text-xs font-bold transition-colors"
              >
                +30s
              </button>
              <button
                onClick={() => setTimer(null)}
                className="p-1 hover:bg-white/10 rounded-full text-zinc-400 hover:text-white transition-colors"
                title="Cancelar"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal for a specific exercise */}
      {historyExerciseId && (
        <div className="fixed inset-0 z-[250] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#18181b] border border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-white">
                {library.find(l => l.id === historyExerciseId)?.name || 'Historial'}
              </h3>
              <button
                onClick={() => setHistoryExerciseId(null)}
                className="p-2 text-zinc-400 hover:text-white rounded-full bg-white/5"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {routine.weeks.map((week, wIdx) => {
                const maxInWeek = weeklySnapshots[week.id]?.[historyExerciseId];
                return (
                  <div key={week.id} className="flex items-center justify-between p-3.5 bg-zinc-900 rounded-xl border border-white/5">
                    <span className="text-xs font-semibold text-zinc-400">{week.name || `Semana ${wIdx + 1}`}</span>
                    <span className="text-sm font-bold text-white font-mono">
                      {maxInWeek ? `${maxInWeek} kg (Máx)` : 'Sin registro'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Finish Workout Confirmation Modal (Image 3) */}
      {showFinishModal && (
        <div className="fixed inset-0 z-[220] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#1c1c1e] border border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in slide-in-from-bottom-10 duration-200 text-center">
            <div className="w-10 h-1 bg-zinc-600 rounded-full mx-auto mb-6 sm:hidden"></div>
            <h3 className="text-2xl font-bold text-white mb-2">{t('finishTitle')}</h3>
            <p className="text-zinc-400 text-sm leading-relaxed mb-8">{t('finishDesc')}</p>
            <div className="space-y-3">
              <button
                onClick={() => setShowFinishModal(false)}
                className="w-full py-4 bg-white text-black font-bold rounded-full text-base active:scale-95 transition-all shadow-md"
              >
                {t('keepTraining')}
              </button>
              <button
                onClick={() => {
                  setShowFinishModal(false);
                  setShowFeedbackScreen(true);
                }}
                className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-full text-base active:scale-95 transition-all"
              >
                {t('finishAnyway')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Tab Navigation: Training vs Progressive Overload */}
      <div className="max-w-xl mx-auto px-4 pt-5 pb-3 flex items-center justify-between">
        <div className="flex gap-1.5 bg-zinc-900 border border-white/10 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('training')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold tracking-tight transition-all ${
              activeTab === 'training' ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Entrenamiento
          </button>
          <button
            onClick={() => setActiveTab('overload')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold tracking-tight transition-all ${
              activeTab === 'overload' ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Sobrecarga Progresiva
          </button>
        </div>
      </div>

      {activeTab === 'overload' ? (
        <div className="max-w-xl mx-auto px-4 py-4">
          <ProgressiveOverloadTab
            routine={routine}
            library={library}
            weeklySnapshots={weeklySnapshots}
            language={language}
          />
        </div>
      ) : (
        <>
          {/* ========================================================================= */}
          {/* SUBVIEW 1: DASHBOARD (SEMANAS + CAJITAS DE ENFOQUES - Image 4)            */}
          {/* ========================================================================= */}
          {viewMode === 'dashboard' && (
            <div className="max-w-xl mx-auto px-4 space-y-5 animate-in fade-in duration-300">

              {/* Routine Cover & Header */}
              <div className="relative rounded-2xl overflow-hidden bg-zinc-900 border border-white/10 aspect-[16/9] flex flex-col justify-end p-5 shadow-lg">
                {routine.image && (
                  <img
                    src={routine.image}
                    alt={routine.name}
                    style={{ objectPosition: `center ${routine.imagePosition || '50%'}` }}
                    className="absolute inset-0 w-full h-full object-cover opacity-60"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>

                {/* Language Switcher Pill */}
                <div className="absolute top-3.5 right-3.5 z-20 flex gap-1 bg-black/60 backdrop-blur-md p-1 rounded-full border border-white/10">
                  {(['es', 'en', 'it'] as const).map(lang => (
                    <button
                      key={lang}
                      onClick={() => { isDirtyRef.current = true; setLanguage(lang); }}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase transition-all ${
                        language === lang ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>

                <div className="relative z-10">
                  <h1 className="text-2xl font-bold tracking-tight text-white uppercase">{routine.name}</h1>
                  <p className="text-zinc-200 text-xs font-bold tracking-wider uppercase mt-0.5">
                    by JULIAN
                  </p>
                  {routine.clientName && (
                    <p className="text-zinc-400 text-xs font-medium mt-0.5">
                      Para: {routine.clientName}
                    </p>
                  )}
                  {routine.description && (
                    <p className="text-zinc-400 text-xs mt-1.5 line-clamp-2">{routine.description}</p>
                  )}
                </div>
              </div>

              {/* Stats Card: Weeks | Workouts | Completed % */}
              <div className="bg-[#18181b] border border-white/5 rounded-2xl p-4 flex items-center justify-between shadow-md">
                <div className="flex-1 text-center border-r border-white/5">
                  <span className="text-xl font-bold text-white leading-none block">{routine.weeks.length}</span>
                  <span className="text-[11px] font-medium text-zinc-400 mt-1 block">
                    {t('weeks')}
                  </span>
                </div>
                <div className="flex-1 text-center border-r border-white/5">
                  <span className="text-xl font-bold text-white leading-none block">{totalWorkouts}</span>
                  <span className="text-[11px] font-medium text-zinc-400 mt-1 block">
                    {t('workouts')}
                  </span>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center">
                  <div className="relative w-10 h-10 flex items-center justify-center">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-zinc-800"
                        strokeWidth="3.5"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className="text-emerald-400 transition-all duration-500 ease-out"
                        strokeDasharray={`${completionPercent}, 100`}
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <span className="absolute text-[10px] font-bold">{completionPercent}%</span>
                  </div>
                  <span className="text-[10px] font-medium text-zinc-400 mt-1">
                    {totalCompletedSetsInRoutine}/{totalSetsInRoutine} {t('completed')}
                  </span>
                </div>
              </div>

              {/* Week Pills Selector (ONLY WEEKS) */}
              <div>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {routine.weeks.map((week, idx) => {
                    const isSelected = week.id === activeWeekId;
                    return (
                      <button
                        key={week.id}
                        onClick={() => setActiveWeekId(week.id)}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                          isSelected
                            ? 'bg-white text-black shadow-sm'
                            : 'bg-[#18181b] text-zinc-400 border border-white/5 hover:text-white'
                        }`}
                      >
                        {week.name || `Week ${idx + 1}`}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Workouts / Focus List for Selected Week */}
              <div className="space-y-2.5">
                {currentWeek?.workouts && currentWeek.workouts.length > 0 ? (
                  currentWeek.workouts.map((workout, idx) => {
                    const exercisePreview = workout.exercises
                      .map(e => library.find(l => l.id === e.libraryExerciseId)?.name)
                      .filter(Boolean)
                      .join(', ');

                    const hasDiaPrefix = /^d[ií]a\s*\d+/i.test(workout.name.trim());
                    const displayTitle = hasDiaPrefix ? workout.name : `Día ${idx + 1} · ${workout.name}`;

                    return (
                      <div
                        key={workout.id}
                        onClick={() => {
                          setActiveWorkoutId(workout.id);
                          setViewMode('preview');
                        }}
                        className="bg-[#18181b] hover:bg-[#202024] border border-white/5 hover:border-white/15 rounded-2xl p-4 flex items-center justify-between cursor-pointer active:scale-[0.99] transition-all shadow-md group"
                      >
                        <div className="flex items-center gap-3.5 min-w-0 pr-2">
                          {/* Dumbbell Icon Badge */}
                          <div className="w-11 h-11 rounded-xl bg-zinc-800/80 border border-white/5 flex items-center justify-center shrink-0 group-hover:bg-zinc-700/80 transition-colors">
                            <svg className="w-5 h-5 text-zinc-300 group-hover:text-white" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43 1.43 1.43 2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43 1.43-1.43zM4.57 5.57l1.43-1.43 1.43 1.43-1.43 1.43-1.43-1.43zm13.86 13.86l-1.43 1.43-1.43-1.43 1.43-1.43 1.43 1.43z" />
                            </svg>
                          </div>

                          <div className="min-w-0">
                            <h3 className="font-bold text-white text-sm tracking-tight uppercase truncate">
                              {displayTitle}
                            </h3>
                            <p className="text-zinc-400 text-xs truncate mt-0.5">
                              {exercisePreview || 'Sin ejercicios'}
                            </p>
                            <span className="text-[11px] font-medium text-zinc-500 mt-0.5 block">
                              {workout.exercises.length} {t('exercisesCount')}
                            </span>
                          </div>
                        </div>

                        {/* Chevron right */}
                        <div className="text-zinc-600 group-hover:text-white transition-colors shrink-0 pl-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-8 text-center text-zinc-500 bg-[#18181b] rounded-2xl border border-white/5 text-sm">
                    {t('noWorkouts')}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SUBVIEW 2: WORKOUT PREVIEW (EXERCISE LIST + START WORKOUT BUTTON - Image 2)*/}
          {/* ========================================================================= */}
          {viewMode === 'preview' && currentWorkout && (
            <div className="max-w-xl mx-auto px-4 space-y-4 animate-in slide-in-from-right-4 duration-300">

              {/* Top Bar with Back Arrow */}
              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => setViewMode('dashboard')}
                  className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-xs font-semibold uppercase tracking-wider p-2 -ml-2 rounded-xl hover:bg-white/5 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                  </svg>
                  Volver
                </button>
              </div>

              {/* Title & Workout Instructions */}
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white uppercase">
                  {currentWorkoutDisplayTitle}
                </h1>
                <p className="text-xs text-zinc-400 font-medium mt-0.5">
                  {currentWorkout.exercises.length} ejercicios · {activeWorkoutTotalSets} series
                </p>
                {currentWorkout.warmup && (
                  <p className="text-xs text-zinc-300 mt-2 p-3 bg-zinc-900 border border-white/5 rounded-xl font-medium">
                    🔥 {currentWorkout.warmup}
                  </p>
                )}
              </div>

              {/* Compact Start Workout Button at Top of List */}
              <div>
                <button
                  onClick={() => {
                    initAudio();
                    setViewMode('active');
                  }}
                  className="w-full py-3.5 px-6 bg-white text-black font-bold text-sm rounded-xl hover:bg-zinc-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <svg className="w-4 h-4 fill-black" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  {t('startWorkout')}
                </button>
              </div>

              {/* Exercises Preview List (Clicking ANY exercise also starts the workout!) */}
              <div className="space-y-2 pt-1">
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block ml-1">
                  Ejercicios (toca para entrenar)
                </span>
                {currentWorkout.exercises.map((entry, idx) => {
                  const libEx = library.find(l => l.id === entry.libraryExerciseId);
                  const firstSet = entry.sets[0];
                  return (
                    <div
                      key={entry.id || idx}
                      onClick={() => {
                        initAudio();
                        setViewMode('active');
                        setTimeout(() => {
                          const el = document.getElementById(`exercise-${entry.id}`);
                          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }, 120);
                      }}
                      className="bg-[#18181b] hover:bg-[#202024] border border-white/5 hover:border-white/15 rounded-xl p-3 flex items-center justify-between cursor-pointer active:scale-[0.99] transition-all group shadow-sm"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Circle Thumbnail */}
                        <div className="w-11 h-11 rounded-full bg-zinc-800 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                          {libEx?.muscleImage ? (
                            <img src={libEx.muscleImage} alt={libEx.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="font-bold text-xs text-zinc-400">
                              {(libEx?.name || 'EX').substring(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>

                        <div className="min-w-0">
                          <h4 className="font-semibold text-white text-sm truncate group-hover:text-emerald-400 transition-colors">
                            {libEx?.name || 'Ejercicio'}
                          </h4>
                          <p className="text-xs text-zinc-400 font-mono mt-0.5">
                            {entry.sets.length} × {firstSet?.reps || '10'} {firstSet?.kg ? `· ${firstSet.kg} kg` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {(entry.customTip || libEx?.tip) && (
                          <div className="p-1.5 text-zinc-500">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                          </div>
                        )}
                        <svg className="w-4 h-4 text-zinc-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SUBVIEW 3: ACTIVE WORKOUT EXECUTION (EMBEDDED VIDEO + SETS - Image 1)      */}
          {/* ========================================================================= */}
          {viewMode === 'active' && currentWorkout && (
            <div className="max-w-xl mx-auto px-4 space-y-5 animate-in fade-in duration-300">

              {/* Workout Header Bar */}
              <div className="flex items-center justify-between pt-1 pb-2">
                <button
                  onClick={() => setViewMode('preview')}
                  className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-xs font-bold uppercase tracking-wider p-2 -ml-2 rounded-full hover:bg-white/5 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                  </svg>
                  {currentWorkoutDisplayTitle}
                </button>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest bg-zinc-900 border border-white/5 px-2.5 py-1 rounded-full">
                    {activeWorkoutLoggedSets} / {activeWorkoutTotalSets}
                  </span>
                </div>
              </div>

              {/* Warmup notice if exists */}
              {currentWorkout.warmup && (
                <div className="p-4 bg-zinc-900 border border-white/10 rounded-2xl flex items-start gap-3">
                  <span className="text-lg">🔥</span>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider block">{t('warmup')}</span>
                    <p className="text-xs text-white font-medium mt-0.5">{currentWorkout.warmup}</p>
                  </div>
                </div>
              )}

              {/* Exercise Cards */}
              <div className="space-y-6">
                {currentWorkout.exercises.map((entry, eIdx) => {
                  const libEx = library.find(l => l.id === entry.libraryExerciseId);
                  const isCollapsed = !!collapsedExercises[entry.id];
                  const embed = getEmbedVideo(libEx?.videoUrl);
                  const tipText = entry.customTip || libEx?.tip;

                  return (
                    <div
                      id={`exercise-${entry.id}`}
                      key={entry.id || eIdx}
                      className="bg-[#18181b] border border-white/5 rounded-2xl p-4 sm:p-5 shadow-lg transition-all scroll-mt-6"
                    >
                      {/* Exercise Header */}
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block mb-1">
                            EJERCICIO {eIdx + 1}
                          </span>
                          <h3 className="text-xl font-bold text-white tracking-tight leading-snug">
                            {libEx?.name || 'Ejercicio'}
                          </h3>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* View History Button */}
                          <button
                            onClick={() => setHistoryExerciseId(entry.libraryExerciseId)}
                            className="flex items-center gap-1 text-[11px] font-semibold text-zinc-400 hover:text-white bg-zinc-800/80 hover:bg-zinc-700/80 px-2.5 py-1.5 rounded-full border border-white/5 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {t('viewHistory')}
                          </button>

                          {/* Collapse Toggle */}
                          <button
                            onClick={() => setCollapsedExercises(prev => ({ ...prev, [entry.id]: !prev[entry.id] }))}
                            className="p-1.5 text-zinc-400 hover:text-white rounded-full bg-zinc-800/80 transition-colors"
                          >
                            <svg
                              className={`w-4 h-4 transition-transform duration-200 ${isCollapsed ? 'rotate-180' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 15l7-7 7 7" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {!isCollapsed && (
                        <div className="space-y-4">
                          {/* EMBEDDED VIDEO PLAYER (Directly inside the app!) */}
                          {embed && (
                            <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black border border-white/10 shadow-lg">
                              {embed.type === 'youtube' || embed.type === 'vimeo' ? (
                                <iframe
                                  src={embed.src}
                                  title={libEx?.name || 'Video'}
                                  className="w-full h-full border-0"
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                  allowFullScreen
                                />
                              ) : embed.type === 'direct' ? (
                                <video
                                  src={embed.src}
                                  controls
                                  playsInline
                                  className="w-full h-full object-contain"
                                />
                              ) : (
                                <a
                                  href={embed.src}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-full h-full flex flex-col items-center justify-center text-zinc-400 hover:text-white p-4 text-center transition-colors"
                                >
                                  <svg className="w-10 h-10 mb-2 text-zinc-300" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M8 5v14l11-7z" />
                                  </svg>
                                  <span className="text-xs font-semibold">Ver video instructivo</span>
                                </a>
                              )}
                            </div>
                          )}

                          {/* Coach Tip Box */}
                          {tipText && (
                            <div className="p-3.5 bg-zinc-900/90 border border-white/5 rounded-2xl flex items-start gap-2.5">
                              <span className="text-sm">💡</span>
                              <div className="min-w-0">
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                                  {t('tip')}
                                </span>
                                <p className="text-xs text-zinc-200 mt-0.5 leading-relaxed font-medium">
                                  {tipText}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Sets List (One below the other with clean iOS columns) */}
                          <div className="space-y-2.5 pt-2">
                            {/* Table Header */}
                            <div className="grid grid-cols-12 gap-2 px-2 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                              <div className="col-span-1 text-center">#</div>
                              {routine.enabledMetrics.reps && <div className="col-span-3 text-center">{t('reps')}</div>}
                              {routine.enabledMetrics.kg && <div className="col-span-3 text-center">{t('kg')}</div>}
                              {routine.enabledMetrics.rir && <div className="col-span-2 text-center">{t('rir')}</div>}
                              <div className="col-span-3 text-center">{t('ok')}</div>
                            </div>

                            {/* Sets Rows */}
                            {entry.sets.map((set, sIdx) => {
                              const isDone = !!completedSets[set.id];
                              return (
                                <React.Fragment key={set.id || sIdx}>
                                  <div
                                    className={`grid grid-cols-12 gap-2 items-center p-2.5 rounded-2xl border transition-all ${
                                      isDone
                                        ? 'bg-emerald-500/10 border-emerald-500/30'
                                        : 'bg-zinc-900/70 border-white/5'
                                    }`}
                                  >
                                    {/* Set Index */}
                                    <div className="col-span-1 text-center font-bold text-xs text-zinc-400 font-mono">
                                      {sIdx + 1}
                                    </div>

                                    {/* Reps Input */}
                                    {routine.enabledMetrics.reps && (
                                      <div className="col-span-3">
                                        <input
                                          type="text"
                                          value={clientReps[set.id] !== undefined ? clientReps[set.id] : set.reps}
                                          onChange={(e) => handleRepsChange(set.id, e.target.value)}
                                          placeholder={set.reps}
                                          className="w-full bg-black/40 border border-white/10 rounded-xl py-2 px-1 text-center font-bold text-sm text-white focus:outline-none focus:border-white/30 font-mono"
                                        />
                                      </div>
                                    )}

                                    {/* Kg Input */}
                                    {routine.enabledMetrics.kg && (
                                      <div className="col-span-3">
                                        <input
                                          type="text"
                                          value={clientWeights[set.id] !== undefined ? clientWeights[set.id] : set.kg}
                                          onChange={(e) => handleWeightsChange(set.id, e.target.value)}
                                          placeholder={set.kg}
                                          className="w-full bg-black/40 border border-white/10 rounded-xl py-2 px-1 text-center font-bold text-sm text-white focus:outline-none focus:border-white/30 font-mono"
                                        />
                                      </div>
                                    )}

                                    {/* RIR badge if enabled */}
                                    {routine.enabledMetrics.rir && (
                                      <div className="col-span-2 text-center text-xs font-bold text-zinc-400">
                                        {set.rir || '-'}
                                      </div>
                                    )}

                                    {/* Checkbox (iOS Clean Round Button) */}
                                    <div className="col-span-3 flex justify-center">
                                      <button
                                        onClick={() => handleSetToggle(set.id, set.rest)}
                                        className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all active:scale-90 ${
                                          isDone
                                            ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/30 scale-105'
                                            : 'border-white/20 bg-zinc-800/40 text-transparent hover:border-emerald-400/50'
                                        }`}
                                      >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                        </svg>
                                      </button>
                                    </div>
                                  </div>

                                  {/* DropSets if any */}
                                  {set.dropsets?.map((ds, dsIdx) => (
                                    <div key={ds.id || dsIdx} className="pl-6 pr-2 py-1 text-xs text-zinc-400 flex items-center gap-2">
                                      <span className="text-[10px] font-bold uppercase text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full">
                                        DS {dsIdx + 1}
                                      </span>
                                      <span className="font-mono">{ds.kg} kg × {ds.reps} reps</span>
                                    </div>
                                  ))}
                                </React.Fragment>
                              );
                            })}
                          </div>

                          {/* Exercise Notes */}
                          <div className="pt-2">
                            <textarea
                              placeholder={t('addNote')}
                              value={feelings[entry.id] || ''}
                              onChange={(e) => handleFeelingsChange(entry.id, e.target.value)}
                              className="w-full bg-zinc-900/60 border border-white/5 rounded-2xl p-3.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/20 resize-none h-20"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Floating Bottom Bar (Sets Logged + Timer Pill + Finish Button - Image 1) */}
              <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-md bg-[#18181b]/90 backdrop-blur-2xl border border-white/10 rounded-full p-2.5 flex items-center justify-between shadow-2xl z-40">
                {/* Sets Logged text */}
                <div className="pl-3">
                  <span className="text-xs font-bold text-zinc-300">
                    {activeWorkoutLoggedSets} {t('of')} {activeWorkoutTotalSets} {t('setsLogged')}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Timer pill if running */}
                  {timer !== null && (
                    <div className="px-3 py-1.5 rounded-full bg-zinc-800 border border-white/10 text-xs font-mono font-bold text-emerald-400 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" strokeWidth="3" className="opacity-25" />
                        <path strokeLinecap="round" strokeWidth="3" d="M12 2a10 10 0 0110 10" />
                      </svg>
                      {formatTime(timer)}
                    </div>
                  )}

                  {/* Finish Pill Button */}
                  <button
                    onClick={handleFinishClick}
                    className="py-2.5 px-6 bg-white text-black font-black uppercase text-xs tracking-wider rounded-full shadow-lg hover:bg-zinc-200 active:scale-95 transition-all flex items-center gap-1.5"
                  >
                    <svg className="w-4 h-4 fill-black" viewBox="0 0 24 24">
                      <path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z" />
                    </svg>
                    {t('finishWorkout')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ClientView;
