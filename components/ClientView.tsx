import React, { useState, useEffect, useRef } from 'react';
import emailjs from '@emailjs/browser';
import { Routine, Exercise } from '../types';
import { supabase } from '../supabase';
import ProgressiveOverloadTab from './ProgressiveOverloadTab';
import { getMuscleGroupImage } from '../muscleGroups';

interface ClientViewProps {
  routine: Routine;
  library: Exercise[];
}

// Detects vertical (9:16) YouTube Shorts
export const isYouTubeShort = (url: string | undefined): boolean => {
  if (!url) return false;
  return url.includes('/shorts/');
};

// Helper to extract YouTube video ID and thumbnail
export const getYouTubeThumbnail = (url: string | undefined): string | null => {
  if (!url) return null;
  const trimmed = url.trim();
  // Match YouTube URLs: watch?v=, embed/, v/, shorts/, youtu.be/, with optional query params
  const ytMatch = trimmed.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:embed\/|v\/|watch\?(?:.*&)?v=|shorts\/))([\w-]{11})/i);
  if (ytMatch && ytMatch[1]) {
    // YouTube Shorts do not have maxresdefault, go straight to hqdefault
    if (isYouTubeShort(trimmed)) {
      return `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;
    }
    // Use maxresdefault (1280x720) for clean fill in square crops.
    // onYTThumbLoad and onYTThumbError cascade to hqdefault → mqdefault → muscle group if 404 or placeholder.
    return `https://img.youtube.com/vi/${ytMatch[1]}/maxresdefault.jpg`;
  }
  return null;
};

// Helper to get exercise cover image (prefers YouTube thumbnail, falls back to custom/muscle group)
export const getExerciseCoverImage = (libEx?: Exercise): string => {
  if (!libEx) return '';
  const ytThumb = getYouTubeThumbnail(libEx.videoUrl);
  if (ytThumb) return ytThumb;
  return libEx.muscleImage || (libEx.muscleGroup ? getMuscleGroupImage(libEx.muscleGroup) : '');
};

// Helper when image loads: YouTube returns a 120x90 placeholder JPEG when maxresdefault/hqdefault is missing.
// Modern browsers fire onLoad (not onError) because the payload is valid JPEG.
// Checking naturalWidth <= 120 detects this placeholder immediately.
export const onYTThumbLoad = (muscleGroupFallback?: string) =>
  (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth <= 120) {
      if (img.src.includes('/maxresdefault.jpg')) {
        img.src = img.src.replace('/maxresdefault.jpg', '/hqdefault.jpg');
      } else if (img.src.includes('/hqdefault.jpg')) {
        img.src = img.src.replace('/hqdefault.jpg', '/mqdefault.jpg');
      } else if (muscleGroupFallback && img.src !== muscleGroupFallback) {
        img.src = muscleGroupFallback;
      }
    }
  };

// Fallback handler: cascades gracefully maxresdefault → hqdefault → mqdefault → muscle group
export const onYTThumbError = (muscleGroupFallback?: string) =>
  (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.src.includes('/maxresdefault.jpg')) {
      img.src = img.src.replace('/maxresdefault.jpg', '/hqdefault.jpg');
    } else if (img.src.includes('/hqdefault.jpg')) {
      img.src = img.src.replace('/hqdefault.jpg', '/mqdefault.jpg');
    } else if (muscleGroupFallback && img.src !== muscleGroupFallback) {
      img.src = muscleGroupFallback;
    }
  };

// Helper to convert any video URL into an embedded player
const getEmbedVideo = (url: string | undefined) => {
  if (!url) return null;
  const trimmed = url.trim();

  // YouTube detection (watch, share, shorts, embed)
  const ytMatch = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
  if (ytMatch && ytMatch[1]) {
    const videoId = ytMatch[1];
    return {
      type: 'youtube' as const,
      videoId,
      thumbnail: isYouTubeShort(trimmed)
        ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
        : `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      src: `https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1&modestbranding=1&rel=0`
    };
  }

  // Vimeo detection
  const vimeoMatch = trimmed.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch && vimeoMatch[1]) {
    return {
      type: 'vimeo' as const,
      thumbnail: null,
      src: `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`
    };
  }

  // Direct video file (.mp4, .webm, .mov)
  if (/\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(trimmed)) {
    return {
      type: 'direct' as const,
      thumbnail: null,
      src: trimmed
    };
  }

  // Fallback
  return {
    type: 'link' as const,
    thumbnail: null,
    src: trimmed
  };
};

const ClientView: React.FC<ClientViewProps> = ({ routine: initialRoutine, library }) => {
  const routine = {
    ...initialRoutine,
    enabledMetrics: initialRoutine.enabledMetrics || { reps: true, kg: true, rir: true, rmPercentage: false, rest: true, tempo: false }
  };

  // Safe load of saved progress (supports both clientProgress and legacy clientState)
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
    const remoteData = routine.clientProgress || (routine as any).clientState || null;
    let normalizedRemote: any = null;
    if (remoteData) {
      const completedSets = remoteData.completedSets || (typeof remoteData === 'object' && !remoteData.completedSets ? remoteData : {});
      normalizedRemote = {
        completedSets: completedSets || {},
        clientWeights: remoteData.clientWeights || {},
        clientReps: remoteData.clientReps || {},
        feelings: remoteData.feelings || {},
        activeWeekId: remoteData.activeWeekId || null,
        activeWorkoutId: remoteData.activeWorkoutId || null,
        language: remoteData.language || 'es',
        weeklySnapshots: remoteData.weeklySnapshots || {}
      };
    }

    if (localData && normalizedRemote) {
      return {
        ...normalizedRemote,
        ...localData,
        completedSets: { ...(normalizedRemote.completedSets || {}), ...(localData.completedSets || {}) },
        clientWeights: { ...(normalizedRemote.clientWeights || {}), ...(localData.clientWeights || {}) },
        clientReps: { ...(normalizedRemote.clientReps || {}), ...(localData.clientReps || {}) },
        feelings: { ...(normalizedRemote.feelings || {}), ...(localData.feelings || {}) },
        weeklySnapshots: { ...(normalizedRemote.weeklySnapshots || {}), ...(localData.weeklySnapshots || {}) }
      };
    }
    return localData || normalizedRemote || null;
  };

  const savedData = getSavedData();

  const [completedSets, setCompletedSets] = useState<Record<string, boolean>>(savedData?.completedSets || {});
  const [clientWeights, setClientWeights] = useState<Record<string, string>>(savedData?.clientWeights || {});
  const [clientReps, setClientReps] = useState<Record<string, string>>(savedData?.clientReps || {});
  const [feelings, setFeelings] = useState<Record<string, string>>(savedData?.feelings || {});
  const [timer, setTimer] = useState<number | null>(null);
  const [language, setLanguage] = useState<'es' | 'en' | 'it'>(savedData?.language || 'es');
  const [weeklySnapshots, setWeeklySnapshots] = useState<Record<string, Record<string, number>>>(savedData?.weeklySnapshots || routine.clientProgress?.weeklySnapshots || {});

  // Sincronización reactiva cuando llegan datos frescos de Supabase
  useEffect(() => {
    const remoteData = routine.clientProgress || (routine as any).clientState;
    if (!remoteData) return;
    const remoteSets = remoteData.completedSets || (typeof remoteData === 'object' && !remoteData.completedSets ? remoteData : {});
    if (remoteSets && Object.keys(remoteSets).length > 0) {
      setCompletedSets(prev => ({
        ...remoteSets,
        ...prev
      }));
    }
    if (remoteData.clientWeights && Object.keys(remoteData.clientWeights).length > 0) {
      setClientWeights(prev => ({ ...remoteData.clientWeights, ...prev }));
    }
    if (remoteData.clientReps && Object.keys(remoteData.clientReps).length > 0) {
      setClientReps(prev => ({ ...remoteData.clientReps, ...prev }));
    }
    if (remoteData.feelings && Object.keys(remoteData.feelings).length > 0) {
      setFeelings(prev => ({ ...remoteData.feelings, ...prev }));
    }
    if (remoteData.weeklySnapshots && Object.keys(remoteData.weeklySnapshots).length > 0) {
      setWeeklySnapshots(prev => ({ ...remoteData.weeklySnapshots, ...prev }));
    }
  }, [routine.id, routine.clientProgress]);

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
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  
  // Ejercicios sustitutos / alternativas seleccionadas por el alumno (TEMPORAL SOLO POR SESIÓN)
  const [exerciseOverrides, setExerciseOverrides] = useState<Record<string, string>>(() => {
    try {
      // Purgar cualquier override viejo permanente de localStorage para respetar la rutina original del coach
      localStorage.removeItem(`routine_overrides_${routine.id}`);
      const raw = sessionStorage.getItem(`routine_overrides_${routine.id}`);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const clearExerciseOverrides = () => {
    setExerciseOverrides({});
    try {
      sessionStorage.removeItem(`routine_overrides_${routine.id}`);
      localStorage.removeItem(`routine_overrides_${routine.id}`);
    } catch (e) {
      console.error('Error clearing overrides:', e);
    }
  };

  const [altModalExerciseEntry, setAltModalExerciseEntry] = useState<{
    entryId: string;
    originalExercise: Exercise;
    currentExercise: Exercise;
    alternatives: Exercise[];
  } | null>(null);

  const handleChooseAlternative = (entryId: string, alternativeId: string | null) => {
    setExerciseOverrides(prev => {
      const updated = { ...prev };
      if (!alternativeId) {
        delete updated[entryId];
      } else {
        updated[entryId] = alternativeId;
      }
      try {
        sessionStorage.setItem(`routine_overrides_${routine.id}`, JSON.stringify(updated));
      } catch (e) {
        console.error('Error saving overrides:', e);
      }
      return updated;
    });
    setAltModalExerciseEntry(null);
  };

  const [rating, setRating] = useState<number>(0);
  const [feedbackText, setFeedbackText] = useState<string>('');
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error' | null>(null);

  const isDirtyRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const timerEndTimeRef = useRef<number | null>(null);

  // Translations
  const t = (key: string) => {
    const translations: Record<string, Record<string, string>> = {
      es: {
        training: 'Entrenamiento',
        overload: 'Sobrecarga Progresiva',
        weeks: 'Semanas',
        week: 'Semana',
        workouts: 'Días',
        day: 'Día',
        completed: 'Completado',
        startWorkout: 'Iniciar Entrenamiento',
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
        warmupBadge: 'Calentamiento',
        workingBadge: 'Efectivas',
        noWorkouts: 'No hay días cargados en esta semana.',
        coachMode: 'Coach Mode',
        setsLogged: 'series registradas',
        of: 'de',
        back: 'Volver',
        exercisesTapToTrain: 'Ejercicios (toca para entrenar)',
        exercisePrefix: 'EJERCICIO',
        busyMachine: '¿Máquina ocupada?',
        busyShort: '¿Ocupada?',
        substituteActive: 'Sustituto activo',
        substitute: 'Sustituto',
        replaces: 'Reemplaza a',
        changeAlt: 'Cambiar alt',
        busyModalTitle: '¿Máquina o banco ocupado?',
        busyModalSubtitle: 'Mismo patrón, ángulo y enfoque muscular aprobado por tu coach.',
        originalPlannedExercise: 'Ejercicio planificado originalmente',
        restoreOriginal: 'Restablecer original',
        noAlternatives: 'No hay sustitutos configurados para este ejercicio.',
        inUse: 'En uso',
        useThis: 'Usar este',
        forClient: 'Para',
        noExercises: 'Sin ejercicios',
        series: 'series',
        watchVideo: 'Ver video instructivo'
      },
      en: {
        training: 'Training',
        overload: 'Progressive Overload',
        weeks: 'Weeks',
        week: 'Week',
        workouts: 'Workouts',
        day: 'Day',
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
        keepEditing: 'Back to routine',
        closeSession: 'Close Session',
        feedbackSent: 'Feedback Sent!',
        feedbackDesc: 'Your coach will receive your progress report. Great job today!',
        loading: 'Saving...',
        syncing: 'Syncing...',
        synced: 'Saved to cloud',
        syncError: 'Error syncing',
        warmup: 'Warmup',
        warmupBadge: 'Warmup',
        workingBadge: 'Working',
        noWorkouts: 'No workouts in this week.',
        coachMode: 'Coach Mode',
        setsLogged: 'sets logged',
        of: 'of',
        back: 'Back',
        exercisesTapToTrain: 'Exercises (tap to train)',
        exercisePrefix: 'EXERCISE',
        busyMachine: 'Machine busy?',
        busyShort: 'Busy?',
        substituteActive: 'Substitute active',
        substitute: 'Substitute',
        replaces: 'Replaces',
        changeAlt: 'Change alt',
        busyModalTitle: 'Machine or bench busy?',
        busyModalSubtitle: 'Same pattern, angle and muscle focus approved by your coach.',
        originalPlannedExercise: 'Originally planned exercise',
        restoreOriginal: 'Reset to original',
        noAlternatives: 'No substitutes configured for this exercise.',
        inUse: 'In use',
        useThis: 'Use this',
        forClient: 'For',
        noExercises: 'No exercises',
        series: 'sets',
        watchVideo: 'Watch instructional video'
      },
      it: {
        training: 'Allenamento',
        overload: 'Sovraccarico Progressivo',
        weeks: 'Settimane',
        week: 'Settimana',
        workouts: 'Allenamenti',
        day: 'Giorno',
        completed: 'Completato',
        startWorkout: 'Inizia Allenamento',
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
        keepEditing: 'Torna alla scheda',
        closeSession: 'Chiudi Sessione',
        feedbackSent: 'Feedback Inviato!',
        feedbackDesc: 'Il tuo coach riceverà il tuo report dettagliato. Ottimo lavoro!',
        loading: 'Salvataggio...',
        syncing: 'Sincronizzazione...',
        synced: 'Salvato nel cloud',
        syncError: 'Errore cloud',
        warmup: 'Riscaldamento',
        warmupBadge: 'Riscaldamento',
        workingBadge: 'Allenanti',
        noWorkouts: 'Nessun allenamento in questa settimana.',
        coachMode: 'Coach Mode',
        setsLogged: 'serie registrate',
        of: 'di',
        back: 'Indietro',
        exercisesTapToTrain: 'Esercizi (tocca per allenarti)',
        exercisePrefix: 'ESERCIZIO',
        busyMachine: 'Attrezzo occupato?',
        busyShort: 'Occupato?',
        substituteActive: 'Sostituto attivo',
        substitute: 'Sostituto',
        replaces: 'Sostituisce',
        changeAlt: 'Cambia alt',
        busyModalTitle: 'Attrezzo o panca occupata?',
        busyModalSubtitle: 'Stesso schema, angolo e focus muscolare approvato dal tuo coach.',
        originalPlannedExercise: 'Esercizio originariamente pianificato',
        restoreOriginal: 'Ripristina originale',
        noAlternatives: 'Nessun sostituto configurato per questo esercizio.',
        inUse: 'In uso',
        useThis: 'Usa questo',
        forClient: 'Per',
        noExercises: 'Senza esercizi',
        series: 'serie',
        watchVideo: 'Guarda video istruttivo'
      }
    };
    return translations[language]?.[key] || translations['es']?.[key] || key;
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

  // Funciones de control del cronómetro con reloj real
  const startTimer = (seconds: number) => {
    initAudio();
    if ('Notification' in window && Notification.permission === 'default') {
      try { Notification.requestPermission(); } catch (e) {}
    }
    const endTime = Date.now() + seconds * 1000;
    timerEndTimeRef.current = endTime;
    localStorage.setItem('active_timer_end', String(endTime));
    setTimer(seconds);
  };

  const addTimerSeconds = (secondsToAdd: number) => {
    const base = timerEndTimeRef.current && timerEndTimeRef.current > Date.now()
      ? timerEndTimeRef.current
      : Date.now();
    const newEndTime = base + secondsToAdd * 1000;
    timerEndTimeRef.current = newEndTime;
    localStorage.setItem('active_timer_end', String(newEndTime));
    const remaining = Math.ceil((newEndTime - Date.now()) / 1000);
    setTimer(remaining);
  };

  const stopTimer = () => {
    timerEndTimeRef.current = null;
    localStorage.removeItem('active_timer_end');
    setTimer(null);
  };

  // Restaurar timer persistido si la página se recargó
  useEffect(() => {
    const saved = localStorage.getItem('active_timer_end');
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (parsed > Date.now()) {
        timerEndTimeRef.current = parsed;
        setTimer(Math.ceil((parsed - Date.now()) / 1000));
      } else {
        localStorage.removeItem('active_timer_end');
      }
    }
  }, []);

  // Timer countdown hook con sincronización de reloj real y soporte de segundo plano (TikTok/otras apps)
  useEffect(() => {
    if (timer === null && !timerEndTimeRef.current) return;

    const checkTimer = () => {
      if (!timerEndTimeRef.current) return;
      const now = Date.now();
      const remaining = Math.ceil((timerEndTimeRef.current - now) / 1000);

      if (remaining <= 0) {
        timerEndTimeRef.current = null;
        localStorage.removeItem('active_timer_end');
        setTimer(null);
        playAlarm();

        // Notificación del sistema si está afuera de la app
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification('¡Descanso terminado! 💪', {
              body: 'Terminó tu descanso. ¡A darle a la siguiente serie!',
              icon: '/logo.png',
              tag: 'workout-timer'
            });
          } catch (e) {
            console.error('Notification error:', e);
          }
        }
      } else {
        setTimer(remaining);
      }
    };

    // 1. Ticker continuo en primer plano
    const interval = window.setInterval(checkTimer, 500);

    // 2. Al volver de TikTok o de bloquear el teléfono, sincronizar inmediatamente
    const handleSync = () => {
      checkTimer();
    };

    document.addEventListener('visibilitychange', handleSync);
    window.addEventListener('focus', handleSync);
    window.addEventListener('pageshow', handleSync);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleSync);
      window.removeEventListener('focus', handleSync);
      window.removeEventListener('pageshow', handleSync);
    };
  }, [timer !== null]);

  // Save progress helper (local + Supabase)
  const saveProgress = async (syncToCloud = false) => {
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

    try {
      localStorage.setItem(`routine_progress_${routine.id}`, JSON.stringify(progressData));
      // También sincronizar con full_routine_cache para que una recarga mantenga el progreso
      const fullCacheKey = `full_routine_cache_${routine.id}`;
      const cached = localStorage.getItem(fullCacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        parsed.clientProgress = progressData;
        localStorage.setItem(fullCacheKey, JSON.stringify(parsed));
      }
    } catch (e) {
      console.error('Local progress storage error:', e);
    }

    if (syncToCloud) {
      try {
        const { error } = await supabase
          .from('routines')
          .update({ data: { ...routine, clientProgress: progressData } })
          .eq('id', routine.id);

        if (error) {
          console.warn('Supabase update returned error, attempting upsert fallback:', error);
          const { error: upsertErr } = await supabase
            .from('routines')
            .upsert({
              id: routine.id,
              name: routine.name,
              client_name: routine.clientName,
              data: { ...routine, clientProgress: progressData }
            });
          if (upsertErr) {
            console.error('Supabase upsert failed:', upsertErr);
            setSyncStatus('error');
            return;
          }
        }
        setSyncStatus('synced');
      } catch (err) {
        console.error('Error synchronizing progress to Supabase:', err);
        setSyncStatus('error');
      }
    }
  };

  // Immediate local save
  useEffect(() => {
    saveProgress(false);
  }, [completedSets, clientWeights, clientReps, feelings, activeWeekId, activeWorkoutId, language]);

  // Debounced cloud sync (1.5 sec)
  useEffect(() => {
    if (!isDirtyRef.current) return;
    const timeoutId = setTimeout(() => {
      saveProgress(true);
    }, 1500);
    return () => clearTimeout(timeoutId);
  }, [completedSets, clientWeights, clientReps, feelings, activeWeekId, activeWorkoutId, language]);

  // Set toggle and rest trigger
  const handleSetToggle = (setId: string, restTime: string) => {
    isDirtyRef.current = true;
    setSyncStatus('syncing');
    initAudio();

    const isNowCompleted = !completedSets[setId];
    const newCompleted = { ...completedSets, [setId]: isNowCompleted };
    setCompletedSets(newCompleted);

    // Guardado local síncrono inmediato para respuesta táctil instantánea
    try {
      const currentSaved = localStorage.getItem(`routine_progress_${routine.id}`);
      const parsed = currentSaved ? JSON.parse(currentSaved) : {};
      parsed.completedSets = newCompleted;
      localStorage.setItem(`routine_progress_${routine.id}`, JSON.stringify(parsed));
    } catch (e) {
      console.error('Error in instant local set toggle save:', e);
    }

    if (isNowCompleted && routine.enabledMetrics.rest) {
      let seconds = 0;
      if (restTime.includes(':')) {
        const parts = restTime.split(':');
        seconds = (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
      } else {
        seconds = parseInt(restTime, 10) || 0;
      }
      if (seconds > 0) {
        startTimer(seconds);
      }
    } else {
      stopTimer();
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
  const currentWorkoutIndex = currentWeek?.workouts.findIndex(wk => wk.id === activeWorkoutId) ?? 0;
  // Formateadores dinámicos según idioma
  const formatWorkoutTitle = (name: string, index: number) => {
    if (!name || !name.trim()) return `${t('day')} ${index + 1}`;
    const trimmed = name.trim();
    // Si el nombre fue escrito como "Día 1 · Chest Day" o similar, extrae solo "Chest Day"
    const match = trimmed.match(/^(?:d[ií]a|day|giorno)\s*\d*\s*(?:[·\-:]\s*(.*))?$/i);
    if (match && match[1]) {
      return match[1].trim();
    }
    return trimmed;
  };

  const formatWeekTitle = (name: string, index: number) => {
    if (!name) return `${t('week')} ${index + 1}`;
    const trimmed = name.trim();
    const match = trimmed.match(/^(?:semana|week|settimana)\s*(\d+)\s*(?:[·\-:]\s*(.*))?$/i);
    if (match) {
      const num = match[1];
      const rest = match[2];
      return rest ? `${t('week')} ${num} · ${rest}` : `${t('week')} ${num}`;
    }
    return trimmed;
  };

  const currentWorkoutDisplayTitle = currentWorkout
    ? formatWorkoutTitle(currentWorkout.name, currentWorkoutIndex)
    : '';

  // Calcula la duración estimada del entrenamiento sumando:
  // - 1.5 minutos (90 seg) por cada serie de trabajo (tiempo de ejecución)
  // - El tiempo de descanso configurado para cada serie
  const calculateWorkoutDuration = (wk?: Workout): string => {
    if (!wk || !wk.exercises || wk.exercises.length === 0) return '0 min';

    let totalSeconds = 0;
    wk.exercises.forEach(entry => {
      (entry.sets || []).forEach(set => {
        // 1 minuto y medio (90 seg) de ejecución por serie
        totalSeconds += 90;

        // Tiempo de descanso configurado entre series
        const restStr = (set.rest || '').trim();
        let restSec = 0;
        if (restStr.includes(':')) {
          const parts = restStr.split(':');
          restSec = (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
        } else if (restStr) {
          restSec = parseInt(restStr, 10) || 0;
        }
        totalSeconds += restSec > 0 ? restSec : 90;
      });
    });

    const totalMinutes = Math.round(totalSeconds / 60);
    if (totalMinutes < 5) return '5-10 min';

    const lower = Math.max(5, Math.floor(totalMinutes / 5) * 5);
    const upper = lower + 10;
    return `${lower}-${upper} min`;
  };

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
                  placeholder={
                    language === 'es'
                      ? 'Contanos qué tal las cargas, sensaciones...'
                      : language === 'it'
                      ? 'Raccontaci com’è andata con i carichi, sensazioni...'
                      : 'Leave any comments for your coach...'
                  }
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
                  clearExerciseOverrides();
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

      {/* Floating Rest Timer (Gym Tactical Style) */}
      {timer !== null && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-top-6 duration-300">
          <div className="bg-black/95 backdrop-blur-2xl border-2 border-yellow-400 text-white px-6 py-3 rounded-none shadow-[0_20px_50px_rgba(0,0,0,0.9)] flex items-center gap-5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-yellow-400 animate-ping"></span>
              <span className="text-xs font-bold tracking-widest uppercase text-yellow-400 font-display">{t('pause')}</span>
            </div>
            <span className="text-3xl font-display tabular-nums tracking-wider font-mono text-white">{formatTime(timer)}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => addTimerSeconds(30)}
                className="px-3 py-1 bg-white/10 hover:bg-yellow-400 hover:text-black rounded-none text-xs font-bold font-mono transition-colors"
              >
                +30s
              </button>
              <button
                onClick={stopTimer}
                className="p-1 hover:bg-white/10 rounded-none text-zinc-400 hover:text-white transition-colors"
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
          <div className="bg-[#0e0e11] border border-white/10 rounded-none max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display uppercase tracking-wide text-xl text-white">
                {library.find(l => l.id === historyExerciseId)?.name || 'Historial'}
              </h3>
              <button
                onClick={() => setHistoryExerciseId(null)}
                className="p-2 text-zinc-400 hover:text-white rounded-none bg-white/5"
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
                  <div key={week.id} className="flex items-center justify-between p-3.5 bg-zinc-900 rounded-none border border-white/5">
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

      {/* Modal de Ejercicios Alternativos / Máquina Ocupada */}
      {altModalExerciseEntry && (
        <div className="fixed inset-0 z-[260] bg-black/90 backdrop-blur-sm flex items-end sm:items-center justify-center animate-in fade-in duration-200">
          <div className="bg-[#0c0e12] rounded-none max-w-lg w-full shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200 flex flex-col max-h-[85vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-yellow-400/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-display font-black text-base text-white uppercase tracking-tight leading-tight">
                    {t('busyModalTitle')}
                  </h3>
                  <span className="text-[10px] text-yellow-400 font-bold uppercase tracking-widest">
                    {altModalExerciseEntry.originalExercise.name}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setAltModalExerciseEntry(null)}
                className="p-2 text-zinc-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Restore original button */}
            {altModalExerciseEntry.currentExercise.id !== altModalExerciseEntry.originalExercise.id && (
              <div className="px-5 pt-3 flex justify-end">
                <button
                  onClick={() => handleChooseAlternative(altModalExerciseEntry.entryId, null)}
                  className="text-[11px] text-yellow-400 hover:text-yellow-300 font-black uppercase tracking-widest flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {t('restoreOriginal')} — {altModalExerciseEntry.originalExercise.name}
                </button>
              </div>
            )}

            {/* Lista de alternativas */}
            <div className="overflow-y-auto flex-1">
              {altModalExerciseEntry.alternatives.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm text-zinc-500 font-semibold">{t('noAlternatives')}</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {altModalExerciseEntry.alternatives.map((alt) => {
                    const isCurrentlySelected = altModalExerciseEntry.currentExercise.id === alt.id;
                    const altCover = getExerciseCoverImage(alt);

                    return (
                      <div
                        key={alt.id}
                        className={`flex items-stretch justify-between transition-all ${
                          isCurrentlySelected ? 'bg-yellow-400/8' : 'bg-[#0c0e12] hover:bg-[#181b22]'
                        }`}
                      >
                        {/* Left: thumbnail + info */}
                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                          {/* 1:1 square thumbnail flush left */}
                          <div className="w-20 h-20 aspect-square rounded-none overflow-hidden shrink-0 bg-zinc-950">
                            {altCover ? (
                              <img
                                src={altCover}
                                alt={alt.name}
                                onLoad={onYTThumbLoad(alt.muscleImage || (alt.muscleGroup ? getMuscleGroupImage(alt.muscleGroup) : ''))}
                                onError={onYTThumbError(alt.muscleImage || (alt.muscleGroup ? getMuscleGroupImage(alt.muscleGroup) : ''))}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-zinc-950 text-zinc-500 font-bold text-xs">
                                {(alt.name || 'EX').substring(0, 2).toUpperCase()}
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 py-2">
                            <h4 className="font-display font-black text-sm sm:text-base text-white uppercase tracking-tight truncate leading-tight">
                              {alt.name}
                            </h4>
                            {alt.muscleGroup && (
                              <span className="text-[10px] uppercase font-bold text-zinc-500 block mt-0.5 tracking-widest">
                                {alt.muscleGroup}
                              </span>
                            )}
                            {isCurrentlySelected && (
                              <span className="text-[9px] font-black text-yellow-400 uppercase tracking-widest mt-1 block">
                                ● {t('inUse')}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Right: action button */}
                        <div className="flex items-center pr-4">
                          <button
                            onClick={() => handleChooseAlternative(altModalExerciseEntry.entryId, alt.id)}
                            disabled={isCurrentlySelected}
                            className={`px-3.5 py-2 text-xs font-black uppercase tracking-widest rounded-none transition-all ${
                              isCurrentlySelected
                                ? 'bg-yellow-400 text-black cursor-default'
                                : 'bg-white text-black hover:bg-yellow-400'
                            }`}
                          >
                            {isCurrentlySelected ? t('inUse') : t('useThis')}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Finish Workout Confirmation Modal */}
      {showFinishModal && (
        <div className="fixed inset-0 z-[220] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#0e0e11] border border-white/10 rounded-none max-w-md w-full p-6 shadow-2xl animate-in slide-in-from-bottom-10 duration-200 text-center">
            <h3 className="text-2xl font-display uppercase tracking-wide text-white mb-2">{t('finishTitle')}</h3>
            <p className="text-zinc-400 text-sm leading-relaxed mb-8">{t('finishDesc')}</p>
            <div className="space-y-3">
              <button
                onClick={() => setShowFinishModal(false)}
                className="w-full py-4 bg-yellow-400 hover:bg-yellow-300 text-black font-display text-lg uppercase tracking-wider rounded-none font-bold active:scale-95 transition-all shadow-md"
              >
                {t('keepTraining')}
              </button>
              <button
                onClick={() => {
                  setShowFinishModal(false);
                  setShowFeedbackScreen(true);
                }}
                className="w-full py-4 bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-white font-display text-lg uppercase tracking-wider rounded-none active:scale-95 transition-all"
              >
                {t('finishAnyway')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Tab Navigation */}
      {viewMode !== 'active' && (
        <div className="max-w-xl mx-auto px-4 pt-4 pb-0 flex items-center justify-start gap-0 border-b border-white/10">
          <button
            onClick={() => setActiveTab('training')}
            className={`px-5 py-3 font-black text-xs uppercase tracking-widest transition-all border-b-2 -mb-px ${
              activeTab === 'training'
                ? 'text-white border-yellow-400'
                : 'text-zinc-500 border-transparent hover:text-zinc-300'
            }`}
          >
            {t('training')}
          </button>
          <button
            onClick={() => setActiveTab('overload')}
            className={`px-5 py-3 font-black text-xs uppercase tracking-widest transition-all border-b-2 -mb-px ${
              activeTab === 'overload'
                ? 'text-white border-yellow-400'
                : 'text-zinc-500 border-transparent hover:text-zinc-300'
            }`}
          >
            {t('overload')}
          </button>
        </div>
      )}

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
              <div className="relative rounded-xl overflow-hidden bg-zinc-900 border border-white/10 aspect-[16/9] flex flex-col justify-end p-5 shadow-lg">
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
                <div className="absolute top-3.5 right-3.5 z-20 flex gap-1 bg-black/60 backdrop-blur-md p-1 rounded-lg border border-white/10">
                  {(['es', 'en', 'it'] as const).map(lang => (
                    <button
                      key={lang}
                      onClick={() => { isDirtyRef.current = true; setLanguage(lang); }}
                      className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-md transition-all ${
                        language === lang ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>

                <div className="relative z-10">
                  <h1 className="text-3xl sm:text-5xl font-display tracking-wide text-white uppercase leading-none drop-shadow-lg">{routine.name}</h1>
                  {routine.description && (
                    <p className="text-zinc-300 text-xs sm:text-sm mt-2 line-clamp-2 max-w-lg">{routine.description}</p>
                  )}
                </div>
              </div>

              {/* Stats Card: Weeks | Workouts | Completed % */}
              <div className="bg-[#181b22] border-0 rounded-none p-4 flex items-center justify-between shadow-md">
                <div className="flex-1 text-center border-r border-white/5">
                  <span className="text-2xl font-display font-black text-white leading-none block">{routine.weeks.length}</span>
                  <span className="text-[11px] font-bold text-zinc-400 mt-1 block uppercase tracking-wider">
                    {t('weeks')}
                  </span>
                </div>
                <div className="flex-1 text-center border-r border-white/5">
                  <span className="text-2xl font-display font-black text-white leading-none block">{totalWorkouts}</span>
                  <span className="text-[11px] font-bold text-zinc-400 mt-1 block uppercase tracking-wider">
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
                        className="text-yellow-400 transition-all duration-500 ease-out"
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

              {/* Selector de Semana tipo Dropbox / Menú desplegable estético */}
              <div className="relative">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 mb-2 block">
                  {t('weeks')}
                </label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none flex items-center gap-2">
                    <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <select
                    value={activeWeekId || ''}
                    onChange={(e) => {
                      setActiveWeekId(e.target.value);
                      clearExerciseOverrides();
                    }}
                    className="w-full bg-[#181b22] hover:bg-[#20242e] text-white pl-11 pr-10 py-3.5 rounded-none font-bold uppercase text-xs tracking-wider border-0 focus:ring-1 focus:ring-yellow-400 outline-none transition-all appearance-none cursor-pointer shadow-md"
                  >
                    {routine.weeks.map((week, idx) => (
                      <option key={week.id} value={week.id} className="bg-[#181b22] text-white py-2">
                        {formatWeekTitle(week.name, idx)}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Workouts / Focus List for Selected Week */}
              {/* Workouts / Focus List for Selected Week */}
              <div className="space-y-3">
                {currentWeek?.workouts && currentWeek.workouts.length > 0 ? (
                  currentWeek.workouts.map((workout, idx) => {
                    const displayTitle = formatWorkoutTitle(workout.name, idx);
                    const firstEx = workout.exercises[0] ? library.find(l => l.id === workout.exercises[0].libraryExerciseId) : undefined;
                    const dayCover = workout.image || getExerciseCoverImage(firstEx);
                    const isDayCoverShort = !workout.image && isYouTubeShort(firstEx?.videoUrl);
                    const totalWorkoutSets = workout.exercises.reduce((acc, e) => acc + (e.sets?.length || 0), 0);

                    return (
                      <div
                        key={workout.id}
                        onClick={() => {
                          setActiveWorkoutId(workout.id);
                          setViewMode('preview');
                        }}
                        className="bg-[#181b22] hover:bg-[#20242e] border-0 rounded-none overflow-hidden flex items-stretch justify-between cursor-pointer active:scale-[0.99] transition-all shadow-md group"
                      >
                        <div className="flex items-center gap-3.5 sm:gap-4 min-w-0 pr-2">
                          {/* Day Cover Photo 1:1 Cuadrado flush a la izquierda */}
                          <div className="w-24 sm:w-28 h-24 sm:h-28 aspect-square rounded-none overflow-hidden shrink-0 bg-zinc-950 relative">
                            {dayCover ? (
                              <img
                                src={dayCover}
                                alt={displayTitle}
                                onLoad={onYTThumbLoad(firstEx?.muscleImage || (firstEx?.muscleGroup ? getMuscleGroupImage(firstEx.muscleGroup) : ''))}
                                onError={onYTThumbError(firstEx?.muscleImage || (firstEx?.muscleGroup ? getMuscleGroupImage(firstEx.muscleGroup) : ''))}
                                className="w-full h-full object-cover rounded-none group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                                <svg className="w-7 h-7 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43 1.43 1.43 2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43 1.43-1.43zM4.57 5.57l1.43-1.43 1.43 1.43-1.43 1.43-1.43-1.43zm13.86 13.86l-1.43 1.43-1.43-1.43 1.43-1.43 1.43 1.43z" />
                                </svg>
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 py-2">
                            <h3 className="font-display font-black text-lg sm:text-xl text-white tracking-tight uppercase truncate group-hover:text-yellow-400 transition-colors leading-tight">
                              {displayTitle}
                            </h3>
                            <p className="text-zinc-400 text-xs font-semibold truncate mt-1.5 flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5 shrink-0 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="10" strokeWidth="2"/>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6l4 2"/>
                              </svg>
                              <span className="tracking-wide text-zinc-300 font-mono">{calculateWorkoutDuration(workout)}</span>
                            </p>
                          </div>
                        </div>

                        {/* Chevron right */}
                        <div className="text-zinc-500 group-hover:text-yellow-400 transition-colors shrink-0 pr-4 flex items-center">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-8 text-center text-zinc-500 bg-[#181b22] rounded-none border-0 text-sm">
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
                  {t('back')}
                </button>
              </div>

              {/* Day Cover Photo if available */}
              {currentWorkout.image && (
                <div className="relative rounded-none overflow-hidden bg-zinc-900 border-0 aspect-[21/9] sm:aspect-[16/7] flex flex-col justify-end p-4 shadow-lg">
                  <img
                    src={currentWorkout.image}
                    alt={currentWorkoutDisplayTitle}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                </div>
              )}

              {/* Title & Workout Instructions */}
              <div>
                <h1 className="text-3xl sm:text-4xl font-display font-black tracking-tight text-white uppercase leading-none">
                  {currentWorkoutDisplayTitle}
                </h1>
                <p className="text-xs text-zinc-400 font-semibold mt-1.5 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 shrink-0 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" strokeWidth="2"/>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6l4 2"/>
                  </svg>
                  <span className="tracking-wide text-zinc-300">{calculateWorkoutDuration(currentWorkout)}</span>
                </p>
                {currentWorkout.warmup && currentWorkout.warmup.trim() !== '' && (
                  <div className="mt-2.5 px-3.5 py-2.5 bg-[#181b22] border-0 rounded-none flex items-start gap-2.5">
                    <span className="text-[9px] font-black uppercase tracking-widest text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-none shrink-0 mt-px">
                      {t('warmup')}
                    </span>
                    <p className="text-xs text-zinc-300 font-medium leading-relaxed">{currentWorkout.warmup}</p>
                  </div>
                )}
              </div>

              {/* Start Workout Button with High Energy Gymbro Aesthetic */}
              <div>
                <button
                  onClick={() => {
                    initAudio();
                    setViewMode('active');
                  }}
                  className="w-full py-4 px-6 bg-white hover:bg-zinc-200 text-black font-display font-black text-xl tracking-wider uppercase rounded-none active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-white/10"
                >
                  <svg className="w-5 h-5 fill-black" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  {t('startWorkout')}
                </button>
              </div>

              {/* Exercises Preview List (Clicking ANY exercise also starts the workout!) */}
              <div className="space-y-2.5 pt-1">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block ml-1">
                  {t('exercisesTapToTrain')}
                </span>
                {currentWorkout.exercises.map((entry, idx) => {
                  const activeLibId = exerciseOverrides[entry.id] || entry.libraryExerciseId;
                  const originalEx = library.find(l => l.id === entry.libraryExerciseId);
                  const libEx = library.find(l => l.id === activeLibId) || originalEx;
                  const isReplaced = activeLibId !== entry.libraryExerciseId;
                  const coverImg = getExerciseCoverImage(libEx);
                  const isShort = isYouTubeShort(libEx?.videoUrl);
                  const repsList = entry.sets.map(s => s.reps || '10').join(', ');
                  const hasAlternatives = originalEx?.alternativeExerciseIds && originalEx.alternativeExerciseIds.length > 0;
                  const hasTip = Boolean(entry.customTip || libEx?.tip);

                  return (
                    <div
                      key={entry.id || idx}
                      className="bg-[#181b22] hover:bg-[#20242e] border-0 rounded-none overflow-hidden flex items-stretch justify-between transition-all group shadow-md"
                    >
                      {/* Left & Center: Click to train this exercise */}
                      <div
                        onClick={() => {
                          initAudio();
                          setViewMode('active');
                          setTimeout(() => {
                            const el = document.getElementById(`exercise-${entry.id}`);
                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }, 120);
                        }}
                        className="flex items-center gap-3.5 min-w-0 flex-1 cursor-pointer"
                      >
                        {/* 1:1 Square Thumbnail - Flush on left (clean, without overlay play button) */}
                        <div className="w-24 sm:w-28 h-24 sm:h-28 aspect-square rounded-none bg-zinc-950 overflow-hidden shrink-0 relative">
                          {coverImg ? (
                            <img
                              src={coverImg}
                              alt={libEx?.name}
                              onLoad={onYTThumbLoad(libEx?.muscleImage || (libEx?.muscleGroup ? getMuscleGroupImage(libEx.muscleGroup) : ''))}
                              onError={onYTThumbError(libEx?.muscleImage || (libEx?.muscleGroup ? getMuscleGroupImage(libEx.muscleGroup) : ''))}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-zinc-950 text-zinc-500 font-bold text-xs">
                              {(libEx?.name || 'EX').substring(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>

                        {/* Center Column: Title, SETS, REPS */}
                        <div className="min-w-0 flex-1 py-2 pr-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-display font-black text-base sm:text-lg text-white uppercase tracking-tight leading-tight truncate group-hover:text-yellow-400 transition-colors">
                              {libEx?.name || 'Ejercicio'}
                            </h4>
                            {isReplaced && (
                              <span className="text-[9px] bg-amber-500/20 text-amber-300 font-black px-1.5 py-0.5 rounded-none border border-amber-500/30 uppercase shrink-0">
                                {t('substitute')}
                              </span>
                            )}
                          </div>

                          <div className="mt-1.5 text-left">
                            <p className="text-[11px] font-bold text-zinc-400 tracking-wider uppercase">
                              SETS: <span className="text-yellow-400 font-mono font-bold text-xs">{entry.sets.length}</span>
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Right Column: Actions (Chevron, Swap/Replace, Tip) */}
                      <div className="flex flex-col items-center justify-between gap-1.5 shrink-0 pr-3 sm:pr-4 py-2 self-stretch">
                        {/* Chevron right */}
                        <button
                          type="button"
                          onClick={() => {
                            initAudio();
                            setViewMode('active');
                            setTimeout(() => {
                              const el = document.getElementById(`exercise-${entry.id}`);
                              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }, 120);
                          }}
                          className="p-1 text-zinc-500 group-hover:text-white transition-colors"
                          title="Entrenar ejercicio"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>

                        {/* Swap / Alternative icon */}
                        {hasAlternatives ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!originalEx) return;
                              const alts = (originalEx.alternativeExerciseIds || [])
                                .map(altId => library.find(l => l.id === altId))
                                .filter((l): l is Exercise => Boolean(l));

                              setAltModalExerciseEntry({
                                entryId: entry.id,
                                originalExercise: originalEx,
                                currentExercise: libEx || originalEx,
                                alternatives: alts
                              });
                            }}
                            className={`p-1 rounded-none transition-all ${
                              isReplaced
                                ? 'text-amber-400 bg-amber-500/20 hover:bg-amber-500/30'
                                : 'text-zinc-400 hover:text-amber-400 hover:bg-white/5'
                            }`}
                            title={t('busyMachine')}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </button>
                        ) : (
                          <div className="w-4 h-4" />
                        )}

                        {/* Tips icon */}
                        {hasTip ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              alert(`💡 Tip del coach:\n\n${entry.customTip || libEx?.tip}`);
                            }}
                            className="p-1 text-zinc-500 hover:text-yellow-400 transition-colors"
                            title="Ver tips del coach"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </button>
                        ) : (
                          <div className="w-4 h-4" />
                        )}
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
              {currentWorkout.warmup && currentWorkout.warmup.trim() !== '' && (
                <div className="px-3.5 py-2.5 bg-zinc-900 border border-white/5 rounded-lg flex items-start gap-2.5">
                  <span className="text-[9px] font-black uppercase tracking-widest text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded shrink-0 mt-px">
                    {t('warmup')}
                  </span>
                  <p className="text-xs text-zinc-300 font-medium leading-relaxed">{currentWorkout.warmup}</p>
                </div>
              )}

              {/* Exercise Cards */}
              <div className="space-y-6">
                {currentWorkout.exercises.map((entry, eIdx) => {
                  const activeLibId = exerciseOverrides[entry.id] || entry.libraryExerciseId;
                  const originalEx = library.find(l => l.id === entry.libraryExerciseId);
                  const libEx = library.find(l => l.id === activeLibId) || originalEx;
                  const isReplaced = activeLibId !== entry.libraryExerciseId;
                  const isCollapsed = !!collapsedExercises[entry.id];
                  const embed = getEmbedVideo(libEx?.videoUrl);
                  const tipText = entry.customTip || libEx?.tip;
                  const hasAlternatives = originalEx?.alternativeExerciseIds && originalEx.alternativeExerciseIds.length > 0;

                  return (
                    <div
                      id={`exercise-${entry.id}`}
                      key={entry.id || eIdx}
                      className="bg-[#181b22] border-0 rounded-none p-4 sm:p-5 shadow-lg transition-all scroll-mt-6"
                    >
                      {/* Exercise Header */}
                      <div className="mb-4">
                        {/* Top Action Row: Exercise Badge + Substitute & Action Buttons */}
                        <div className="flex items-center justify-between gap-2 mb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded-none">
                              {t('exercisePrefix')} {eIdx + 1}
                            </span>
                            {isReplaced && (
                              <span className="text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-none">
                                {t('substituteActive')}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Botón ¿Máquina ocupada? si tiene alternativas */}
                            {hasAlternatives && (
                              <button
                                onClick={() => {
                                  if (!originalEx) return;
                                  const alts = (originalEx.alternativeExerciseIds || [])
                                    .map(altId => library.find(l => l.id === altId))
                                    .filter((l): l is Exercise => Boolean(l));

                                  setAltModalExerciseEntry({
                                    entryId: entry.id,
                                    originalExercise: originalEx,
                                    currentExercise: libEx || originalEx,
                                    alternatives: alts
                                  });
                                }}
                                className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-none border transition-all ${
                                  isReplaced
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                                    : 'bg-zinc-800/80 text-amber-400 hover:text-amber-300 hover:bg-zinc-700/80 border-amber-500/25'
                                }`}
                                title={t('busyMachine')}
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                </svg>
                                <span>{isReplaced ? t('changeAlt') : t('busyShort')}</span>
                              </button>
                            )}

                            {/* View History Button */}
                            <button
                              onClick={() => setHistoryExerciseId(libEx?.id || entry.libraryExerciseId)}
                              className="flex items-center gap-1 text-[11px] font-semibold text-zinc-400 hover:text-white bg-zinc-800/80 hover:bg-zinc-700/80 px-2.5 py-1.5 rounded-none border border-white/5 transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {t('viewHistory')}
                            </button>

                            {/* Collapse Toggle */}
                            <button
                              onClick={() => setCollapsedExercises(prev => ({ ...prev, [entry.id]: !prev[entry.id] }))}
                              className="p-1.5 text-zinc-400 hover:text-white rounded-none bg-zinc-800/80 transition-colors"
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

                        {/* Full Width Exercise Title (Words Stay Together Horizontally) */}
                        <h3 className="text-2xl sm:text-3xl font-display font-black text-white tracking-tight uppercase leading-tight">
                          {libEx?.name || 'Ejercicio'}
                        </h3>
                        {isReplaced && originalEx && (
                          <span className="text-[11px] text-zinc-400 block mt-0.5">
                            {t('replaces')}: <strong className="text-zinc-300">{originalEx.name}</strong>
                          </span>
                        )}
                      </div>

                      {!isCollapsed && (
                        <div className="space-y-4">
                          {/* EMBEDDED VIDEO PLAYER (Morsia Custom Facade + Player) */}
                          {embed ? (
                            playingVideoId === entry.id ? (
                              <div className="relative w-full aspect-video rounded-none overflow-hidden bg-black border-0 shadow-lg">
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
                                    autoPlay
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
                                    <span className="text-xs font-semibold">{t('watchVideo')}</span>
                                  </a>
                                )}
                              </div>
                            ) : (
                              /* Native Morsia Video Card (Foto 3) */
                              <div
                                onClick={() => setPlayingVideoId(entry.id)}
                                className="relative w-full aspect-video rounded-none overflow-hidden bg-zinc-950 border-0 shadow-xl cursor-pointer group"
                              >
                                {embed.thumbnail || getExerciseCoverImage(libEx) ? (
                                  <img
                                    src={embed.thumbnail || getExerciseCoverImage(libEx)}
                                    alt={libEx?.name || 'Video'}
                                    onLoad={onYTThumbLoad(libEx?.muscleImage || (libEx?.muscleGroup ? getMuscleGroupImage(libEx.muscleGroup) : ''))}
                                    onError={onYTThumbError(libEx?.muscleImage || (libEx?.muscleGroup ? getMuscleGroupImage(libEx.muscleGroup) : ''))}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-zinc-500 font-bold text-sm">
                                    {libEx?.name}
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-black/35 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-black/60 backdrop-blur-md border border-white/40 flex items-center justify-center text-white shadow-2xl group-hover:scale-110 transition-transform">
                                    <svg className="w-7 h-7 sm:w-8 sm:h-8 fill-white ml-1" viewBox="0 0 24 24">
                                      <path d="M8 5v14l11-7z" />
                                    </svg>
                                  </div>
                                </div>
                              </div>
                            )
                          ) : (libEx?.muscleImage || (libEx?.muscleGroup ? getMuscleGroupImage(libEx.muscleGroup) : '')) ? (
                            <div className="relative w-full h-52 sm:h-64 rounded-none overflow-hidden bg-zinc-950/80 border-0 flex items-center justify-center p-3 shadow-lg">
                              <img
                                src={libEx?.muscleImage || getMuscleGroupImage(libEx?.muscleGroup)}
                                alt={libEx?.name}
                                className="w-full h-full object-contain"
                              />
                            </div>
                          ) : null}

                          {/* Coach Tip Box */}
                          {tipText && (
                            <div className="p-3.5 bg-[#101216] border-0 rounded-none flex items-start gap-2.5">
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

                          {/* Sets List (Separación clara Calentamiento / Efectivas) */}
                          <div className="space-y-4 pt-2">
                            {/* Table Header */}
                            <div className="grid grid-cols-12 gap-2 px-2 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                              <div className="col-span-1 text-center font-mono">#</div>
                              {routine.enabledMetrics.reps && <div className="col-span-3 text-center">{t('reps')}</div>}
                              {routine.enabledMetrics.kg && <div className="col-span-3 text-center">{t('kg')}</div>}
                              {routine.enabledMetrics.rir && <div className="col-span-2 text-center">{t('rir')}</div>}
                              <div className="col-span-3 text-center">{t('ok')}</div>
                            </div>

                            {(() => {
                              const warmupSets = entry.sets.filter(s => s.type === 'warmup');
                              const workingSets = entry.sets.filter(s => s.type !== 'warmup');

                              const renderSetRow = (set: TrainingSet, displayIdx: number, isWarmupSet: boolean) => {
                                const isDone = !!completedSets[set.id];
                                return (
                                  <React.Fragment key={set.id}>
                                    <div
                                      className={`grid grid-cols-12 gap-2 items-center p-2.5 rounded-none border-0 transition-all ${
                                        isDone
                                          ? 'bg-emerald-500/15'
                                          : isWarmupSet ? 'bg-[#121620]' : 'bg-[#101216]'
                                      }`}
                                    >
                                      {/* Set Index / Type */}
                                      <div className="col-span-1 text-center font-bold text-xs font-mono flex items-center justify-center">
                                        <span className={isWarmupSet ? 'text-blue-400 font-black' : 'text-zinc-300 font-bold'}>
                                          {displayIdx}
                                        </span>
                                      </div>

                                      {/* Reps Input */}
                                      {routine.enabledMetrics.reps && (
                                        <div className="col-span-3">
                                          <input
                                            type="text"
                                            value={clientReps[set.id] !== undefined ? clientReps[set.id] : set.reps}
                                            onChange={(e) => handleRepsChange(set.id, e.target.value)}
                                            placeholder={set.reps}
                                            className="w-full bg-[#0c0e12] border-0 rounded-none py-2 px-1 text-center font-bold text-sm text-white focus:outline-none focus:ring-1 focus:ring-yellow-400 font-mono"
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
                                            className="w-full bg-[#0c0e12] border-0 rounded-none py-2 px-1 text-center font-bold text-sm text-white focus:outline-none focus:ring-1 focus:ring-yellow-400 font-mono"
                                          />
                                        </div>
                                      )}

                                      {/* RIR badge if enabled */}
                                      {routine.enabledMetrics.rir && (
                                        <div className="col-span-2 text-center text-xs font-bold text-zinc-400">
                                          {set.rir || '-'}
                                        </div>
                                      )}

                                      {/* Checkbox (Circular Tactile Button) */}
                                      <div className="col-span-3 flex justify-center">
                                        <button
                                          onClick={() => handleSetToggle(set.id, set.rest)}
                                          className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all active:scale-90 ${
                                            isDone
                                              ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                                              : 'border-white/20 bg-zinc-800/40 text-transparent hover:border-yellow-400/50'
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
                                        <span className="text-[10px] font-bold uppercase text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-none">
                                          DS {dsIdx + 1}
                                        </span>
                                        <span className="font-mono">{ds.kg} kg × {ds.reps} reps</span>
                                      </div>
                                    ))}
                                  </React.Fragment>
                                );
                              };

                              return (
                                <>
                                  {/* SECCIÓN CALENTAMIENTO / ACERCAMIENTO */}
                                  {warmupSets.length > 0 && (
                                    <div className="space-y-1.5">
                                      <div className="flex items-center gap-2 px-1">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 bg-blue-500/15 border border-blue-500/30 px-2.5 py-1 rounded-none flex items-center gap-1.5">
                                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
                                          {t('warmupBadge')}
                                        </span>
                                      </div>
                                      <div className="space-y-1.5">
                                        {warmupSets.map((set, wIdx) => renderSetRow(set, wIdx + 1, true))}
                                      </div>
                                    </div>
                                  )}

                                  {/* SECCIÓN SERIES EFECTIVAS */}
                                  {workingSets.length > 0 && (
                                    <div className="space-y-1.5 pt-1">
                                      <div className="flex items-center gap-2 px-1">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 rounded-none flex items-center gap-1.5">
                                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                                          {t('workingBadge')}
                                        </span>
                                      </div>
                                      <div className="space-y-1.5">
                                        {workingSets.map((set, wkIdx) => renderSetRow(set, wkIdx + 1, false))}
                                      </div>
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>

                          {/* Exercise Notes */}
                          <div className="pt-2">
                            <textarea
                              placeholder={t('addNote')}
                              value={feelings[entry.id] || ''}
                              onChange={(e) => handleFeelingsChange(entry.id, e.target.value)}
                              className="w-full bg-[#101216] border-0 rounded-none p-3.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-yellow-400 resize-none h-20"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Floating Bottom Bar (Ergonomic Pill Bar) */}
              <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-md bg-black/95 backdrop-blur-2xl border-0 rounded-none p-2.5 flex items-center justify-between shadow-2xl z-40">
                {/* Sets Logged text */}
                <div className="pl-3">
                  <span className="text-xs font-bold text-zinc-300">
                    {activeWorkoutLoggedSets} {t('of')} {activeWorkoutTotalSets} {t('setsLogged')}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Timer box if running */}
                  {timer !== null && (
                    <div className="px-3 py-1.5 rounded-none bg-zinc-900 border border-yellow-400/40 text-xs font-mono font-bold text-yellow-400 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" strokeWidth="3" className="opacity-25" />
                        <path strokeLinecap="round" strokeWidth="3" d="M12 2a10 10 0 0110 10" />
                      </svg>
                      {formatTime(timer)}
                    </div>
                  )}

                  {/* Finish Button */}
                  <button
                    onClick={handleFinishClick}
                    className="py-2.5 px-6 bg-white hover:bg-zinc-200 text-black font-display font-black text-base tracking-wider uppercase rounded-none shadow-lg shadow-white/10 active:scale-95 transition-all flex items-center gap-2"
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
