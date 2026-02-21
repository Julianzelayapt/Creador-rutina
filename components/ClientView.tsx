
import React, { useState, useEffect, useRef } from 'react';
import { Routine, Exercise } from '../types';
import { supabase } from '../supabase';

interface ClientViewProps {
  routine: Routine;
  library: Exercise[];
}

const ClientView: React.FC<ClientViewProps> = ({ routine, library }) => {
  const [completedSets, setCompletedSets] = useState<Record<string, boolean>>({});
  const [clientWeights, setClientWeights] = useState<Record<string, string>>({});
  const [clientReps, setClientReps] = useState<Record<string, string>>({});
  const [feelings, setFeelings] = useState<Record<string, string>>({});
  const [timer, setTimer] = useState<number | null>(null);
  const [language, setLanguage] = useState<'es' | 'en' | 'it'>('es');

  const t = (key: string) => {
    const translations: Record<string, Record<string, string>> = {
      es: {
        week: 'Week',
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
        set: 'SET',
        reps: 'REPS',
        kg: 'KG',
        rir: 'RIR',
        rm: '% RM',
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

  const [activeWeekId, setActiveWeekId] = useState<string | null>(routine.weeks[0]?.id || null);
  const [activeWorkoutId, setActiveWorkoutId] = useState<string | null>(null);

  // Estados para el Feedback Final
  const [showFeedbackScreen, setShowFeedbackScreen] = useState(false);
  const [rating, setRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (activeWeekId) {
      const week = routine.weeks.find(w => w.id === activeWeekId);
      if (week && week.workouts.length > 0) {
        if (!activeWorkoutId || !week.workouts.find(wk => wk.id === activeWorkoutId)) {
          setActiveWorkoutId(week.workouts[0].id);
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

  // Persistence Logic
  const saveProgress = () => {
    if (!activeWorkoutId) return;

    const progressData = {
      completedSets,
      clientWeights,
      clientReps,
      feelings,
      activeWeekId,
      activeWorkoutId
    };

    localStorage.setItem(`routine_progress_${routine.id}`, JSON.stringify(progressData));
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

  // Load initial state from localStorage
  useEffect(() => {
    const savedProgress = localStorage.getItem(`routine_progress_${routine.id}`);
    if (savedProgress) {
      try {
        const state = JSON.parse(savedProgress);
        if (state.completedSets) setCompletedSets(state.completedSets);
        if (state.clientWeights) setClientWeights(state.clientWeights);
        if (state.clientReps) setClientReps(state.clientReps);
        if (state.feelings) setFeelings(state.feelings);
        if (state.activeWeekId) setActiveWeekId(state.activeWeekId);
        if (state.activeWorkoutId) setActiveWorkoutId(state.activeWorkoutId);
      } catch (e) {
        console.error('Error parsing saved progress:', e);
      }
    }
  }, [routine.id]);

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

  const handleSubmitFeedback = () => {
    if (rating === 0) {
      alert(language === 'es' ? 'Por favor selecciona una puntuación con las estrellas.' : language === 'en' ? 'Please select a rating.' : 'Per favore seleziona un punteggio.');
      return;
    }

    // Al usar localStorage, simplemente nos aseguramos de que todo esté guardado localmente
    saveProgress();
    console.log("Feedback:", { rating, feedbackText, workoutId: activeWorkoutId });
    setIsSubmitted(true);
  };

  // Pantalla de Feedback / Finalización
  if (showFeedbackScreen) {
    return (
      <div className="max-w-xl mx-auto px-6 py-20 min-h-screen flex flex-col justify-center animate-in fade-in duration-500">
        <div className="bg-white dark:bg-darkCard rounded-[3rem] p-10 shadow-2xl border border-slate-100 dark:border-slate-800 text-center">
          {!isSubmitted ? (
            <>
              <div className="w-20 h-20 bg-blue-600 text-white rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-xl shadow-blue-500/30">
                <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              </div>
              <h2 className="text-4xl font-black text-slate-900 dark:text-white mb-4 tracking-tighter uppercase italic">{t('dayCompleted')}</h2>
              <p className="text-slate-500 dark:text-slate-400 font-bold mb-10">{t('howWasWorkout')}</p>

              {/* Estrellas */}
              <div className="flex justify-center gap-3 mb-12">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    className={`transition-all transform hover:scale-110 active:scale-90 ${rating >= star ? 'text-yellow-400' : 'text-slate-200 dark:text-slate-700'}`}
                  >
                    <svg className="w-12 h-12 fill-current" viewBox="0 0 24 24">
                      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                    </svg>
                  </button>
                ))}
              </div>

              <div className="space-y-6">
                <div className="text-left space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">{t('comments')}</label>
                  <textarea
                    placeholder={t('feedbackPlaceholder')}
                    className="w-full bg-slate-50 dark:bg-black p-6 rounded-[2rem] border-2 border-transparent focus:border-blue-500 outline-none transition-all h-36 text-slate-800 dark:text-slate-200 font-medium italic shadow-inner"
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                  />
                </div>
                <button
                  onClick={handleSubmitFeedback}
                  className="w-full py-6 bg-blue-600 text-white rounded-[2rem] font-black uppercase tracking-widest italic shadow-xl hover:bg-blue-700 transition-all active:scale-95"
                >
                  {t('sendSummary')}
                </button>
                <button
                  onClick={() => setShowFeedbackScreen(false)}
                  className="w-full py-2 text-slate-400 font-black uppercase text-[10px] tracking-[0.2em] hover:text-slate-600 transition-all"
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
              <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-4 uppercase italic tracking-tighter">{t('feedbackSent')}</h2>
              <p className="text-slate-500 dark:text-slate-400 font-bold mb-10 leading-relaxed italic">{t('feedbackDesc')}</p>
              <button
                onClick={() => {
                  setShowFeedbackScreen(false);
                  setIsSubmitted(false);
                  setRating(0);
                  setFeedbackText('');
                }}
                className="px-12 py-5 bg-slate-900 dark:bg-white dark:text-black text-white rounded-2xl font-black uppercase tracking-widest italic shadow-lg hover:scale-105 transition-all"
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
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-8 py-5 rounded-[3rem] shadow-[0_20px_50px_rgba(59,130,246,0.6)] z-[150] flex items-center gap-8 border border-white/20 backdrop-blur-md animate-in slide-in-from-bottom-12 duration-500">
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
              <button onClick={() => setLanguage('es')} className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-[10px] transition-all ${language === 'es' ? 'bg-white text-black scale-110 shadow-lg' : 'bg-black/40 text-white backdrop-blur-sm'}`}>ES</button>
              <button onClick={() => setLanguage('en')} className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-[10px] transition-all ${language === 'en' ? 'bg-white text-black scale-110 shadow-lg' : 'bg-black/40 text-white backdrop-blur-sm'}`}>EN</button>
              <button onClick={() => setLanguage('it')} className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-[10px] transition-all ${language === 'it' ? 'bg-white text-black scale-110 shadow-lg' : 'bg-black/40 text-white backdrop-blur-sm'}`}>IT</button>
            </div>

            <h1 className="text-3xl lg:text-5xl font-black text-white mb-2 tracking-tighter uppercase italic">{routine.name}</h1>
            <p className="text-blue-400 font-black text-[10px] lg:text-xs uppercase tracking-widest italic">{t('hello')}, {routine.clientName}</p>
          </div>
        </div>
        <div className="p-6 lg:p-8">
          <p className="text-slate-500 dark:text-slate-400 font-bold text-base lg:text-lg italic leading-relaxed">"{routine.description}"</p>
        </div>
      </div>

      {/* Navegación Semanas (Pestañas) */}
      <div className="mb-6 flex items-center gap-3 overflow-x-auto pb-4 scrollbar-hide">
        {routine.weeks.map(week => (
          <button
            key={week.id}
            onClick={() => setActiveWeekId(week.id)}
            className={`px-8 py-5 rounded-[2rem] font-black uppercase italic text-xs tracking-widest transition-all shrink-0 ${activeWeekId === week.id ? 'bg-blue-600 text-white shadow-xl scale-105' : 'bg-white dark:bg-darkCard text-slate-400 border border-slate-100 dark:border-slate-800'}`}
          >
            {week.name}
          </button>
        ))}
      </div>

      {currentWeek ? (
        <div className="space-y-8 lg:space-y-10 animate-in fade-in slide-in-from-left-4 duration-300">
          <h2 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white border-l-8 border-blue-600 pl-6 lg:pl-8 italic uppercase tracking-tighter">{currentWeek.name}</h2>

          {/* Navegación Días (Botones al lado) */}
          <div className="flex items-center gap-3 flex-wrap">
            {currentWeek.workouts.map(workout => (
              <button
                key={workout.id}
                onClick={() => setActiveWorkoutId(workout.id)}
                className={`flex-1 min-w-[130px] px-6 py-5 rounded-[2.5rem] font-black uppercase italic text-sm tracking-widest transition-all ${activeWorkoutId === workout.id ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-black shadow-lg scale-[1.02]' : 'bg-white dark:bg-darkCard text-slate-400 border border-slate-100 dark:border-slate-800 hover:border-blue-300'}`}
              >
                {workout.name}
              </button>
            ))}
          </div>

          {currentWorkout ? (
            <div className="space-y-12">
              <div className="bg-white dark:bg-darkCard rounded-[2.5rem] lg:rounded-[3.5rem] p-5 lg:p-10 shadow-lg border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
                <h3 className="text-2xl lg:text-3xl font-black text-slate-800 dark:text-slate-100 mb-6 lg:mb-10 border-b-2 border-slate-50 dark:border-slate-800 pb-4 tracking-tight uppercase italic">{currentWorkout.name}</h3>

                {currentWorkout.warmup && (
                  <div className="mb-10 bg-orange-50 dark:bg-orange-900/10 rounded-[2.5rem] p-8 border border-orange-100/30 dark:border-orange-500/10 flex gap-6 items-start italic">
                    <div className="w-12 h-12 bg-orange-500 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-lg">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" /></svg>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 font-bold leading-relaxed">{currentWorkout.warmup}</p>
                  </div>
                )}

                <div className="space-y-20">
                  {currentWorkout.exercises.map(entry => {
                    const libEx = library.find(l => l.id === entry.libraryExerciseId);
                    return (
                      <div key={entry.id} className="relative">
                        <div className="flex flex-col gap-6 lg:gap-8">
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
                              <h4 className="text-xl lg:text-3xl font-black text-slate-800 dark:text-white tracking-tighter uppercase italic pr-4">{libEx?.name}</h4>
                              {libEx?.muscleImage && (
                                <div className="h-10 w-auto rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-white p-1">
                                  <img
                                    src={libEx.muscleImage}
                                    alt="Muscle"
                                    className="h-full w-auto object-contain"
                                  />
                                </div>
                              )}
                            </div>

                            <div className="mb-8 p-6 bg-slate-50 dark:bg-black/30 rounded-[2.5rem] border-l-[8px] border-blue-500">
                              <p className="text-slate-600 dark:text-slate-400 font-bold italic text-base">💡 {t('tip')}: {libEx?.tip || '...'}</p>
                            </div>

                            <div className="overflow-x-auto mb-8">
                              <table className="w-full text-center">
                                <thead>
                                  <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 dark:border-slate-800">
                                    <th className="py-4 w-16">{t('set')}</th>
                                    {routine.enabledMetrics.reps && <th className="py-4">{t('reps')}</th>}
                                    {routine.enabledMetrics.kg && <th className="py-4">{t('kg')}</th>}
                                    {routine.enabledMetrics.rir && <th className="py-4">{t('rir')}</th>}
                                    {routine.enabledMetrics.rmPercentage && <th className="py-2 lg:py-4">{t('rm')}</th>}
                                    <th className="py-2 lg:py-4 w-12 lg:w-20">{t('ok')}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {entry.sets.map((set, idx) => (
                                    <tr key={set.id} className={`transition-all border-b border-slate-50 dark:border-slate-900 last:border-0 ${completedSets[set.id] ? 'bg-green-500/10 dark:bg-green-500/5' : ''}`}>
                                      <td className="py-4 lg:py-6">
                                        <div className={`w-8 h-8 lg:w-10 lg:h-10 rounded-xl flex items-center justify-center text-xs lg:text-sm font-black mx-auto transition-all ${completedSets[set.id] ? 'bg-green-600 text-white shadow-xl' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                          {idx + 1}
                                        </div>
                                      </td>
                                      {routine.enabledMetrics.reps && (
                                        <td className="py-4 lg:py-6">
                                          <input
                                            type="text"
                                            className="w-16 lg:w-24 py-2 lg:py-4 text-center bg-white dark:bg-black border-[3px] border-slate-200 dark:border-slate-700 rounded-2xl font-black text-slate-900 dark:text-white outline-none focus:border-blue-600 transition-all text-lg lg:text-xl"
                                            value={clientReps[set.id] !== undefined ? clientReps[set.id] : set.reps}
                                            onChange={(e) => setClientReps(prev => ({ ...prev, [set.id]: e.target.value }))}
                                          />
                                        </td>
                                      )}
                                      {routine.enabledMetrics.kg && (
                                        <td className="py-4 lg:py-6">
                                          <input
                                            type="text"
                                            className="w-16 lg:w-24 py-2 lg:py-4 text-center bg-white dark:bg-black border-[3px] border-slate-200 dark:border-slate-700 rounded-2xl font-black text-slate-900 dark:text-white outline-none focus:border-blue-600 transition-all text-lg lg:text-xl"
                                            value={clientWeights[set.id] !== undefined ? clientWeights[set.id] : set.kg}
                                            onChange={(e) => setClientWeights(prev => ({ ...prev, [set.id]: e.target.value }))}
                                          />
                                        </td>
                                      )}
                                      {routine.enabledMetrics.rir && <td className="py-4 lg:py-6 font-black text-slate-400 dark:text-slate-600 italic text-lg">{set.rir}</td>}
                                      {routine.enabledMetrics.rmPercentage && <td className="py-4 lg:py-6 font-black text-slate-400 dark:text-slate-600 text-lg">{set.rmPercentage}%</td>}
                                      <td className="py-4 lg:py-6">
                                        <button
                                          onClick={() => handleSetToggle(set.id, set.rest)}
                                          className={`w-10 h-10 lg:w-16 lg:h-16 rounded-xl lg:rounded-[1.8rem] border-[3px] lg:border-4 flex items-center justify-center transition-all active:scale-90 ${completedSets[set.id] ? 'bg-green-500 border-green-500 text-white shadow-2xl scale-110' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-transparent hover:border-green-400'}`}
                                        >
                                          <svg className="w-5 h-5 lg:w-10 lg:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" d="M5 13l4 4L19 7" /></svg>
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            <div className="p-8 bg-slate-50 dark:bg-black/40 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
                              <textarea
                                placeholder={t('notesPlaceholder')}
                                className="w-full bg-white dark:bg-darkCard p-6 rounded-[1.5rem] border-2 border-transparent focus:border-blue-500 outline-none transition-all h-28 text-slate-800 dark:text-slate-200 font-medium italic shadow-inner"
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
                  })}
                </div>
              </div>

              {/* Botón Finalizar Entrenamiento */}
              <div className="pt-10 flex justify-center">
                <button
                  onClick={() => {
                    initAudio();
                    setShowFeedbackScreen(true);
                  }}
                  className="w-full max-w-md py-8 bg-slate-900 dark:bg-white text-white dark:text-black rounded-[2.5rem] font-black uppercase tracking-[0.2em] italic text-xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] dark:shadow-[0_20px_50px_rgba(255,255,255,0.05)] hover:scale-105 active:scale-95 transition-all animate-bounce-slow"
                >
                  {t('finishWorkout')}
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-24 bg-white dark:bg-darkCard rounded-[3rem] border-2 border-dashed border-slate-200 dark:border-slate-800 italic">
              <p className="font-bold text-slate-400 uppercase tracking-widest text-sm">{t('selectDay')}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-20 italic">
          <p className="font-black text-slate-300 dark:text-slate-700 uppercase tracking-widest text-xl">{t('noContent')}</p>
        </div>
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
