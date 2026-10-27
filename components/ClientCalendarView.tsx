import React, { useState, useMemo } from 'react';
import { Routine, Workout, Exercise } from '../types';
import { getExerciseCoverImage, onYTThumbLoad, onYTThumbError } from './ClientView';

interface ClientCalendarViewProps {
  routine: Routine;
  library: Exercise[];
  completedSets: Record<string, boolean>;
  clientWeights: Record<string, string>;
  clientReps: Record<string, string>;
  dayOverrides: Record<string, string>; // { "weekId_dayIndex": workoutId | 'rest' }
  onUpdateDayOverride: (dayKey: string, workoutIdOrRest: string) => void;
  onSelectWorkout: (workoutId: string) => void;
  language: 'es' | 'en' | 'it';
  onLanguageChange: (lang: 'es' | 'en' | 'it') => void;
  activeWeekId: string | null;
  onChangeWeek: (weekId: string) => void;
  onUpdateStartDate?: (newDate: string) => void;
}

const CAL_TRANSLATIONS = {
  es: {
    hello: '¡HOLA',
    week: 'SEMANA',
    of: 'DE',
    today: 'HOY',
    rest: 'HOY TOCA DESCANSO',
    recovery: 'RECUPERACIÓN ACTIVA',
    recoveryShort: 'RECUPERACIÓN',
    restDesc: 'Día de recuperación muscular. Si querés entrenar hoy, podés pasar una sesión de otro día a esta fecha.',
    moveDay: 'MOVER DE DÍA',
    bringHere: 'TRAER SESIÓN A HOY',
    moveSessionToday: 'MOVER UNA SESIÓN A HOY',
    programWorkouts: 'PROGRAM WORKOUTS',
    moveCalendar: 'MOVER CALENDARIO',
    cancel: 'CANCELAR',
    save: 'GUARDAR',
    currentDay: 'DÍA ACTUAL DE ESTA SESIÓN',
    moveHere: 'MOVER ACÁ →',
    exercises: 'EJERCICIOS',
    completed: 'COMPLETED',
    scheduled: 'PROGRAMADO',
    moveModalDescMove: 'Elegí a qué día de la semana querés mover este entrenamiento. Si el día de destino ya tenía otra sesión, se intercambiarán automáticamente.',
    moveModalDescBring: 'Elegí qué sesión de la semana querés traer para realizar este día:',
    moveModalTitlePass: 'PASAR',
    moveModalTitleTo: 'A OTRO DÍA',
    moveModalTitleBring: 'MOVER UNA SESIÓN A ESTE',
    currently: 'Actualmente:',
    rest_label: 'DESCANSO',
    trainingSession: 'SESIÓN DE ENTRENAMIENTO',
    days: {
      short: ['L', 'M', 'M', 'J', 'V', 'S', 'D'],
      full: ['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO', 'DOMINGO'],
      month: 'es-ES'
    }
  },
  en: {
    hello: 'HI',
    week: 'WEEK',
    of: 'OF',
    today: 'TODAY',
    rest: 'REST DAY',
    recovery: 'ACTIVE RECOVERY',
    recoveryShort: 'RECOVERY',
    restDesc: 'Recovery day. If you want to train today, you can bring a session from another day.',
    moveDay: 'MOVE DAY',
    bringHere: 'BRING SESSION HERE',
    moveSessionToday: 'MOVE A SESSION TO TODAY',
    programWorkouts: 'PROGRAM WORKOUTS',
    moveCalendar: 'MOVE CALENDAR',
    cancel: 'CANCEL',
    save: 'SAVE',
    currentDay: 'CURRENT DAY FOR THIS SESSION',
    moveHere: 'MOVE HERE →',
    exercises: 'EXERCISES',
    completed: 'COMPLETED',
    scheduled: 'SCHEDULED',
    moveModalDescMove: 'Choose which day of the week you want to move this workout to. If the target day already has a session, they will swap automatically.',
    moveModalDescBring: 'Choose which session of the week you want to bring to this day:',
    moveModalTitlePass: 'MOVE',
    moveModalTitleTo: 'TO ANOTHER DAY',
    moveModalTitleBring: 'BRING A SESSION TO',
    currently: 'Currently:',
    rest_label: 'REST',
    trainingSession: 'TRAINING SESSION',
    days: {
      short: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
      full: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'],
      month: 'en-US'
    }
  },
  it: {
    hello: 'CIAO',
    week: 'SETTIMANA',
    of: 'DI',
    today: 'OGGI',
    rest: 'RIPOSO OGGI',
    recovery: 'RECUPERO ATTIVO',
    recoveryShort: 'RECUPERO',
    restDesc: 'Giorno di recupero muscolare. Se vuoi allenarti oggi, puoi spostare una sessione da un altro giorno.',
    moveDay: 'SPOSTA GIORNO',
    bringHere: 'PORTA SESSIONE QUI',
    moveSessionToday: 'SPOSTA UNA SESSIONE A OGGI',
    programWorkouts: 'ALLENAMENTI',
    moveCalendar: 'SPOSTA CALENDARIO',
    cancel: 'ANNULLA',
    save: 'SALVA',
    currentDay: 'GIORNO CORRENTE PER QUESTA SESSIONE',
    moveHere: 'SPOSTA QUI →',
    exercises: 'ESERCIZI',
    completed: 'COMPLETATO',
    scheduled: 'PROGRAMMATO',
    moveModalDescMove: 'Scegli in quale giorno della settimana vuoi spostare questo allenamento. Se il giorno di destinazione ha già una sessione, si scambieranno automaticamente.',
    moveModalDescBring: 'Scegli quale sessione della settimana vuoi portare in questo giorno:',
    moveModalTitlePass: 'SPOSTA',
    moveModalTitleTo: 'IN UN ALTRO GIORNO',
    moveModalTitleBring: 'PORTA UNA SESSIONE A',
    currently: 'Attualmente:',
    rest_label: 'RIPOSO',
    trainingSession: 'SESSIONE DI ALLENAMENTO',
    days: {
      short: ['L', 'M', 'M', 'G', 'V', 'S', 'D'],
      full: ['LUNEDÌ', 'MARTEDÌ', 'MERCOLEDÌ', 'GIOVEDÌ', 'VENERDÌ', 'SABATO', 'DOMENICA'],
      month: 'it-IT'
    }
  }
};

export const ClientCalendarView: React.FC<ClientCalendarViewProps> = ({
  routine,
  library,
  completedSets,
  dayOverrides,
  onUpdateDayOverride,
  onSelectWorkout,
  language,
  onLanguageChange,
  activeWeekId,
  onChangeWeek,
  onUpdateStartDate
}) => {
  const cal = CAL_TRANSLATIONS[language] || CAL_TRANSLATIONS.es;

  // Days of week built dynamically from language
  const DAYS_OF_WEEK = cal.days.full.map((fullName, index) => ({
    shortName: cal.days.short[index],
    fullName,
    index
  }));

  // 1. Identificar la semana activa
  const currentWeek = useMemo(() => {
    if (activeWeekId) {
      const found = routine.weeks.find(w => w.id === activeWeekId);
      if (found) return found;
    }
    return routine.weeks[0] || null;
  }, [routine.weeks, activeWeekId]);

  const currentWeekIndex = useMemo(() => {
    if (!currentWeek) return 0;
    const idx = routine.weeks.findIndex(w => w.id === currentWeek.id);
    return idx >= 0 ? idx : 0;
  }, [routine.weeks, currentWeek]);

  // 2. Cálculo de fechas a partir de startDate
  const baseStartDate = useMemo(() => {
    if (routine.startDate) {
      const parts = routine.startDate.split('-').map(Number);
      if (parts.length === 3) {
        return new Date(parts[0], parts[1] - 1, parts[2]);
      }
    }
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  }, [routine.startDate]);

  // Detección del día actual
  const todayInfo = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const dayOfWeek = (now.getDay() + 6) % 7; // 0=Lunes, 6=Domingo
    return {
      date: now,
      dayOfWeekIndex: dayOfWeek,
      formattedStr: now.toISOString().split('T')[0]
    };
  }, []);

  // Día seleccionado actualmente (0 a 6)
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(() => {
    return todayInfo.dayOfWeekIndex;
  });

  // Modal para MOVER DE DÍA la sesión
  const [showMoveModal, setShowMoveModal] = useState<boolean>(false);

  // 3. Mapeo de entrenamientos para los 7 días de la semana activa
  const weekDaysData = useMemo(() => {
    if (!currentWeek) return [];

    return DAYS_OF_WEEK.map((d, index) => {
      const dayDate = new Date(baseStartDate);
      dayDate.setDate(baseStartDate.getDate() + (currentWeekIndex * 7) + index);

      const isToday =
        dayDate.getFullYear() === todayInfo.date.getFullYear() &&
        dayDate.getMonth() === todayInfo.date.getMonth() &&
        dayDate.getDate() === todayInfo.date.getDate();

      const dayKey = `${currentWeek.id}_${index}`;
      const overrideVal = dayOverrides[dayKey];

      let assignedWorkout: Workout | null = null;
      let isExplicitRest = false;

      if (overrideVal === 'rest') {
        isExplicitRest = true;
      } else if (overrideVal) {
        assignedWorkout =
          currentWeek.workouts.find(w => w.id === overrideVal) ||
          routine.weeks.flatMap(w => w.workouts).find(w => w.id === overrideVal) ||
          null;
      } else {
        const matchingWorkout = currentWeek.workouts.find(w => w.dayOfWeek === index);
        if (matchingWorkout) {
          assignedWorkout = matchingWorkout;
        } else {
          const unassignedWorkouts = currentWeek.workouts.filter(w => w.dayOfWeek === undefined);
          if (unassignedWorkouts.length > 0) {
            let defaultIndexMap: number[] = [];
            if (unassignedWorkouts.length === 1) defaultIndexMap = [0];
            else if (unassignedWorkouts.length === 2) defaultIndexMap = [1, 3];
            else if (unassignedWorkouts.length === 3) defaultIndexMap = [0, 2, 4];
            else if (unassignedWorkouts.length === 4) defaultIndexMap = [0, 1, 3, 5];
            else if (unassignedWorkouts.length === 5) defaultIndexMap = [0, 1, 2, 3, 4];
            else defaultIndexMap = [0, 1, 2, 3, 4, 5];

            const foundWkPos = defaultIndexMap.indexOf(index);
            if (foundWkPos !== -1 && foundWkPos < unassignedWorkouts.length) {
              assignedWorkout = unassignedWorkouts[foundWkPos];
            }
          }
        }
      }

      // Cálculo de completado
      let isCompleted = false;
      let totalSets = 0;
      let doneSets = 0;

      if (assignedWorkout && assignedWorkout.exercises) {
        assignedWorkout.exercises.forEach(ex => {
          if (ex.sets) {
            totalSets += ex.sets.length;
            doneSets += ex.sets.filter(s => completedSets[s.id]).length;
          }
        });
        isCompleted = totalSets > 0 && doneSets === totalSets;
      }

      return {
        ...d,
        dateObj: dayDate,
        dayNumber: dayDate.getDate(),
        monthShort: dayDate.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase(),
        isToday,
        isExplicitRest,
        assignedWorkout,
        isCompleted,
        totalSets,
        doneSets,
        hasWorkout: !!assignedWorkout && !isExplicitRest
      };
    });
  }, [currentWeek, baseStartDate, currentWeekIndex, todayInfo, dayOverrides, routine.weeks, completedSets]);

  const selectedDayData = weekDaysData[selectedDayIndex] || weekDaysData[0];

  // 4. Progreso global limpio
  const globalProgress = useMemo(() => {
    let totalSets = 0;
    let completed = 0;
    routine.weeks.forEach(w => {
      w.workouts?.forEach(wk => {
        wk.exercises?.forEach(ex => {
          if (ex.sets) {
            totalSets += ex.sets.length;
            completed += ex.sets.filter(s => completedSets[s.id]).length;
          }
        });
      });
    });
    const percent = totalSets > 0 ? Math.round((completed / totalSets) * 100) : 0;
    return { percent };
  }, [routine.weeks, completedSets]);

  // Imagen de portada del entrenamiento
  const workoutCoverImage = useMemo(() => {
    if (!selectedDayData?.assignedWorkout) return null;
    const wk = selectedDayData.assignedWorkout;
    if (wk.image) return wk.image;
    if (wk.exercises && wk.exercises.length > 0) {
      const firstLibEx = library.find(l => l.id === wk.exercises[0].libraryExerciseId);
      if (firstLibEx) {
        return getExerciseCoverImage(firstLibEx);
      }
    }
    return routine.image || null;
  }, [selectedDayData, library, routine.image]);

  // Función para mover la sesión a otro día o intercambiarla
  const handleMoveWorkoutToDay = (targetDayIndex: number) => {
    if (!currentWeek) return;

    const sourceDayIndex = selectedDayIndex;
    if (sourceDayIndex === targetDayIndex) {
      setShowMoveModal(false);
      return;
    }

    const sourceDayKey = `${currentWeek.id}_${sourceDayIndex}`;
    const targetDayKey = `${currentWeek.id}_${targetDayIndex}`;

    const sourceWorkout = selectedDayData.assignedWorkout;
    const targetDayData = weekDaysData[targetDayIndex];
    const targetWorkout = targetDayData.assignedWorkout;

    if (sourceWorkout) {
      onUpdateDayOverride(targetDayKey, sourceWorkout.id);
      if (targetWorkout) {
        onUpdateDayOverride(sourceDayKey, targetWorkout.id);
      } else {
        onUpdateDayOverride(sourceDayKey, 'rest');
      }
    } else {
      if (targetWorkout) {
        onUpdateDayOverride(sourceDayKey, targetWorkout.id);
        onUpdateDayOverride(targetDayKey, 'rest');
      }
    }

    setSelectedDayIndex(targetDayIndex);
    setShowMoveModal(false);
  };

  const clientFirstName = routine.clientName ? routine.clientName.trim().split(' ')[0].toUpperCase() : 'ATLETA';

  return (
    <div className="min-h-screen bg-black text-white pb-24 max-w-md mx-auto relative select-none">
      
      {/* 1. TOP HEADER: SALUDO + NOMBRE + SELECTOR DE IDIOMA */}
      <div className="pt-6 px-4 pb-2 flex items-center justify-between">
        <h1 className="text-2xl sm:text-3xl font-display font-black tracking-tight text-white uppercase">
          {cal.hello}, {clientFirstName}!
        </h1>

        {/* Selector de idioma (ES / EN / IT) */}
        <div className="flex items-center bg-[#181b22] p-1 border border-white/10 rounded-none">
          {(['es', 'en', 'it'] as const).map(lang => (
            <button
              key={lang}
              onClick={() => onLanguageChange(lang)}
              className={`px-2 py-0.5 text-[10px] font-display font-black uppercase transition-all rounded-none ${
                language === lang
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {lang}
            </button>
          ))}
        </div>
      </div>

      {/* 3. TIRA DE CALENDARIO SEMANAL (L M M J V S D) - Filosa y limpia */}
      <div className="px-4 py-2">
        <div className="bg-[#181b22] rounded-none p-2.5">
          <div className="grid grid-cols-7 gap-1">
            {weekDaysData.map((dayItem, idx) => {
              const isSelected = selectedDayIndex === idx;
              const isToday = dayItem.isToday;
              const isDone = dayItem.isCompleted;
              const hasWk = dayItem.hasWorkout;

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDayIndex(idx)}
                  className={`flex flex-col items-center py-2.5 px-0.5 rounded-none transition-all relative ${
                    isSelected
                      ? 'bg-white text-black font-black'
                      : isToday
                      ? 'bg-[#20242e] text-blue-400 font-bold'
                      : 'text-zinc-400 hover:bg-zinc-900'
                  }`}
                >
                  {/* Letra del día */}
                  <span className={`text-[10px] font-display font-black uppercase mb-1 ${
                    isSelected ? 'text-zinc-700' : isToday ? 'text-blue-400' : 'text-zinc-500'
                  }`}>
                    {dayItem.shortName}
                  </span>

                  {/* Número de día o Tilde si completó */}
                  <div className="w-7 h-7 flex items-center justify-center">
                    {isDone ? (
                      <div className="w-6 h-6 bg-blue-600 flex items-center justify-center text-white">
                        <svg className="w-3.5 h-3.5 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    ) : (
                      <span className={`text-sm ${isSelected ? 'font-black text-black' : 'font-bold text-zinc-200'}`}>
                        {dayItem.dayNumber}
                      </span>
                    )}
                  </div>

                  {/* Dot debajo */}
                  <div className="h-1 flex items-center justify-center mt-1">
                    {hasWk ? (
                      <div className={`w-1.5 h-1.5 ${
                        isDone
                          ? 'bg-blue-500'
                          : isSelected
                          ? 'bg-blue-600'
                          : isToday
                          ? 'bg-blue-400'
                          : 'bg-zinc-500'
                      }`} />
                    ) : (
                      <div className="w-1.5 h-1.5 bg-transparent" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Subtítulo limpio: Fecha del día seleccionado */}
          <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-display uppercase tracking-wider text-zinc-400">
            <span>
              {selectedDayData.fullName} {selectedDayData.dayNumber} {cal.of} {selectedDayData.monthShort}
            </span>
            {selectedDayData.isToday && (
              <span className="text-blue-400 font-black">
                {cal.today}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 4. BANNER DE PROGRESO DEL PROGRAMA: Limpio, mayúsculas, sin texto innecesario */}
      <div className="px-4 py-2">
        <div className="bg-[#181b22] rounded-none p-4">
          <div className="text-[10px] font-display font-black text-blue-500 uppercase tracking-widest">
            {routine.name ? routine.name.toUpperCase() : 'RUTINA'}
          </div>

          <div className="flex items-baseline gap-2.5 mt-1 mb-2.5">
            <span className="text-3xl font-display font-black text-white">
              {globalProgress.percent}%
            </span>
            <span className="text-xs font-display font-black text-zinc-400 uppercase tracking-wider">
              {cal.week} {currentWeekIndex + 1} {cal.of} {routine.weeks.length}
            </span>
          </div>

          {/* Barra de progreso azul limpia */}
          <div className="w-full bg-[#121212] h-2 rounded-none overflow-hidden">
            <div
              className="bg-blue-600 h-full rounded-none transition-all duration-500"
              style={{ width: `${Math.max(globalProgress.percent, 3)}%` }}
            />
          </div>
        </div>
      </div>

      {/* 5. TARJETA DEL DÍA: ESTILO DE LA FOTO (BADGE COMPLETED + FLECHA A LA DERECHA) */}
      <div className="px-4 py-3 space-y-2">
        
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-display font-black uppercase tracking-wider text-zinc-400">
            {selectedDayData.hasWorkout ? cal.programWorkouts : cal.recoveryShort}
          </h2>

          <button
            onClick={() => setShowMoveModal(true)}
            className="flex items-center gap-1.5 px-3 py-1 bg-[#181b22] hover:bg-[#20242e] text-[11px] font-display font-black uppercase tracking-wider text-zinc-300 rounded-none transition-colors"
          >
            <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            <span>{selectedDayData.hasWorkout ? cal.moveDay : cal.bringHere}</span>
          </button>
        </div>

        {/* CASO A: DÍA CON ENTRENAMIENTO (DISEÑO IDÉNTICO A LA FOTO) */}
        {selectedDayData.hasWorkout && selectedDayData.assignedWorkout ? (
          <div
            onClick={() => onSelectWorkout(selectedDayData.assignedWorkout!.id)}
            className="bg-[#181b22] rounded-none overflow-hidden cursor-pointer active:scale-[0.99] transition-all group shadow-xl"
          >
            {/* Foto de portada */}
            <div className="relative aspect-[16/10] w-full bg-zinc-950 overflow-hidden">
              {workoutCoverImage ? (
                <img
                  src={workoutCoverImage}
                  alt={selectedDayData.assignedWorkout.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  onLoad={onYTThumbLoad()}
                  onError={onYTThumbError()}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                  <svg className="w-14 h-14 text-zinc-700" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43 1.43 1.43 2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43 1.43-1.43zM4.57 5.57l1.43-1.43 1.43 1.43-1.43 1.43-1.43-1.43zm13.86 13.86l-1.43 1.43-1.43-1.43 1.43-1.43 1.43 1.43z" />
                  </svg>
                </div>
              )}

              {/* Degradado para contraste */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30" />

              {/* Badge superior izquierdo: COMPLETED en azul cuando está terminado */}
              <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between z-10">
                {selectedDayData.isCompleted ? (
                  <span className="px-3.5 py-1.5 bg-blue-600 text-white text-[11px] font-display font-black uppercase tracking-wider rounded-none shadow-md">
                    {cal.completed}
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-black/70 backdrop-blur-md text-zinc-300 text-[10px] font-display font-black uppercase tracking-wider rounded-none">
                    {selectedDayData.isToday ? cal.today : cal.scheduled}
                  </span>
                )}

                {/* Botón de 3 puntos (...) para opciones / mover */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMoveModal(true);
                  }}
                  className="w-9 h-9 bg-black/70 hover:bg-black/90 backdrop-blur-md flex items-center justify-center text-white rounded-none transition-colors"
                  title={cal.moveDay}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="2" />
                    <circle cx="19" cy="12" r="2" />
                    <circle cx="5" cy="12" r="2" />
                  </svg>
                </button>
              </div>

              {/* Botón circular con flecha a la derecha (→) EXACTO COMO EN LA FOTO */}
              <div className="absolute bottom-3.5 right-3.5 z-10">
                <div className="w-10 h-10 bg-white group-hover:bg-zinc-200 text-black flex items-center justify-center rounded-none shadow-xl transition-transform group-hover:scale-105">
                  <svg className="w-5 h-5 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Texto inferior de la carta (Título y detalle) */}
            <div className="p-4">
              <h3 className="text-xl sm:text-2xl font-display font-black text-white tracking-tight uppercase group-hover:text-blue-400 transition-colors">
                {selectedDayData.assignedWorkout.name || cal.trainingSession}
              </h3>
              <p className="text-xs text-zinc-400 font-display font-bold uppercase tracking-wider mt-1">
                {selectedDayData.fullName} • {selectedDayData.dayNumber} {cal.of} {selectedDayData.monthShort} • {selectedDayData.assignedWorkout.exercises?.length || 0} {cal.exercises}
              </p>
            </div>
          </div>
        ) : (
          /* CASO B: DÍA DE DESCANSO */
          <div className="bg-[#181b22] rounded-none p-6 text-center space-y-3">
            <div className="w-12 h-12 mx-auto bg-zinc-900 flex items-center justify-center text-blue-400">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            </div>

            <div>
              <span className="text-[10px] font-display font-black uppercase tracking-widest text-blue-400">
                {cal.recovery}
              </span>
              <h3 className="text-lg font-display font-black text-white uppercase mt-0.5">
                {cal.rest}
              </h3>
              <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto">
                {cal.restDesc}
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setShowMoveModal(true)}
                className="w-full py-3 px-4 bg-[#20242e] hover:bg-zinc-800 text-white font-display font-black text-xs uppercase tracking-wider rounded-none transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                <span>{cal.moveSessionToday}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 6. MODAL: MOVER SESIÓN DE DÍA (Filoso, rounded-none) */}
      {showMoveModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-[#181b22] rounded-none max-w-md w-full p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <span className="text-[10px] font-display font-black text-blue-400 uppercase tracking-widest">
                  {cal.moveCalendar}
                </span>
                <h3 className="text-base sm:text-lg font-display font-black text-white uppercase">
                  {selectedDayData.hasWorkout
                    ? `${cal.moveModalTitlePass} ${selectedDayData.assignedWorkout?.name?.toUpperCase()} ${cal.moveModalTitleTo}`
                    : `${cal.moveModalTitleBring} ${selectedDayData.fullName}`}
                </h3>
              </div>
              <button
                onClick={() => setShowMoveModal(false)}
                className="w-8 h-8 bg-zinc-900 flex items-center justify-center text-zinc-400 hover:text-white rounded-none"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              {selectedDayData.hasWorkout
                ? cal.moveModalDescMove
                : cal.moveModalDescBring}
            </p>

            {/* Lista de los 7 días para mover */}
            <div className="space-y-1.5 pt-1">
              {weekDaysData.map((targetDay) => {
                const isCurrent = targetDay.index === selectedDayIndex;
                const targetWkName = targetDay.hasWorkout && targetDay.assignedWorkout
                  ? targetDay.assignedWorkout.name.toUpperCase()
                  : cal.rest_label;

                return (
                  <button
                    key={targetDay.index}
                    disabled={isCurrent}
                    onClick={() => handleMoveWorkoutToDay(targetDay.index)}
                    className={`w-full p-3 rounded-none flex items-center justify-between text-left transition-all ${
                      isCurrent
                        ? 'bg-zinc-900/40 text-zinc-600 cursor-not-allowed'
                        : 'bg-[#20242e] hover:bg-zinc-800 text-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-display font-black text-sm text-white uppercase">
                          {targetDay.fullName} {targetDay.dayNumber}
                        </span>
                        {targetDay.isToday && (
                          <span className="text-[9px] font-display font-black text-blue-400 bg-blue-500/20 px-1 py-0.2 rounded-none">
                            {cal.today}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-zinc-400 font-display uppercase tracking-wide block mt-0.5">
                        {isCurrent ? cal.currentDay : `${cal.currently} ${targetWkName}`}
                      </span>
                    </div>

                    {!isCurrent && (
                      <span className="text-xs font-display font-black text-blue-400 uppercase">
                        {cal.moveHere}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="pt-2">
              <button
                onClick={() => setShowMoveModal(false)}
                className="w-full py-3 bg-zinc-900 text-zinc-400 font-display font-black text-xs uppercase tracking-wider rounded-none hover:bg-zinc-800 transition-colors"
              >
                {cal.cancel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FIN MODAL MOVER SESIÓN */}

    </div>
  );
};
