import React, { useState, useMemo } from 'react';
import { Routine, Workout, Exercise, TrainingSet } from '../types';
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
  onOpenClassicView: () => void;
  activeWeekId: string | null;
  onChangeWeek: (weekId: string) => void;
  onUpdateStartDate?: (newDate: string) => void;
}

const DAYS_OF_WEEK = [
  { shortName: 'L', fullName: 'Lunes', index: 0 },
  { shortName: 'M', fullName: 'Martes', index: 1 },
  { shortName: 'M', fullName: 'Miércoles', index: 2 },
  { shortName: 'J', fullName: 'Jueves', index: 3 },
  { shortName: 'V', fullName: 'Viernes', index: 4 },
  { shortName: 'S', fullName: 'Sábado', index: 5 },
  { shortName: 'D', fullName: 'Domingo', index: 6 },
];

export const ClientCalendarView: React.FC<ClientCalendarViewProps> = ({
  routine,
  library,
  completedSets,
  dayOverrides,
  onUpdateDayOverride,
  onSelectWorkout,
  onOpenClassicView,
  activeWeekId,
  onChangeWeek,
  onUpdateStartDate
}) => {
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
  // Si no hay startDate guardada en la rutina, usamos el lunes de la semana actual como base
  const baseStartDate = useMemo(() => {
    if (routine.startDate) {
      const parts = routine.startDate.split('-').map(Number);
      if (parts.length === 3) {
        return new Date(parts[0], parts[1] - 1, parts[2]);
      }
    }
    // Fallback: lunes de la semana actual
    const today = new Date();
    const day = today.getDay(); // 0 is Sunday, 1 is Monday...
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  }, [routine.startDate]);

  // Detección de qué día es hoy en relación al índice 0..6 (0=Lunes, 6=Domingo)
  const todayInfo = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const dayOfWeek = (now.getDay() + 6) % 7; // Convertir 0=Dom a 0=Lun, 6=Dom
    return {
      date: now,
      dayOfWeekIndex: dayOfWeek,
      formattedStr: now.toISOString().split('T')[0]
    };
  }, []);

  // 3. Día seleccionado actualmente en el calendario semanal (0 a 6)
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(() => {
    return todayInfo.dayOfWeekIndex;
  });

  // Modal para cambiar el entrenamiento del día
  const [showSwapModal, setShowSwapModal] = useState<boolean>(false);
  // Modal / selector de fecha de inicio
  const [showStartDateModal, setShowStartDateModal] = useState<boolean>(false);
  const [tempStartDate, setTempStartDate] = useState<string>(
    routine.startDate || todayInfo.formattedStr
  );

  // 4. Calcular las fechas de los 7 días de la semana activa
  const weekDaysData = useMemo(() => {
    if (!currentWeek) return [];

    return DAYS_OF_WEEK.map((d, index) => {
      // Fecha = baseStartDate + (currentWeekIndex * 7) + index
      const dayDate = new Date(baseStartDate);
      dayDate.setDate(baseStartDate.getDate() + (currentWeekIndex * 7) + index);

      const isToday =
        dayDate.getFullYear() === todayInfo.date.getFullYear() &&
        dayDate.getMonth() === todayInfo.date.getMonth() &&
        dayDate.getDate() === todayInfo.date.getDate();

      // Determinar qué entrenamiento corresponde a este día:
      // a) Revisar override específico del cliente
      const dayKey = `${currentWeek.id}_${index}`;
      const overrideVal = dayOverrides[dayKey];

      let assignedWorkout: Workout | null = null;
      let isExplicitRest = false;

      if (overrideVal === 'rest') {
        isExplicitRest = true;
      } else if (overrideVal) {
        // Encontrar el workout en la rutina
        assignedWorkout = currentWeek.workouts.find(w => w.id === overrideVal) ||
          routine.weeks.flatMap(w => w.workouts).find(w => w.id === overrideVal) || null;
      } else {
        // b) Si no hay override, buscar asignación por dayOfWeek
        const matchingWorkout = currentWeek.workouts.find(w => w.dayOfWeek === index);
        if (matchingWorkout) {
          assignedWorkout = matchingWorkout;
        } else {
          // c) Si los workouts no tienen dayOfWeek asignado, mapear secuencialmente los primeros workouts
          // Ej: Si hay 3 entrenamientos en la semana, ponerlos por defecto en Lunes (0), Miércoles (2), Viernes (4)
          // O si hay N entrenamientos, distribuirlos
          const unassignedWorkouts = currentWeek.workouts.filter(w => w.dayOfWeek === undefined);
          if (unassignedWorkouts.length > 0) {
            // Mapeo sugerido por cantidad de días
            let defaultIndexMap: number[] = [];
            if (unassignedWorkouts.length === 1) defaultIndexMap = [0]; // Lun
            else if (unassignedWorkouts.length === 2) defaultIndexMap = [1, 3]; // Mar, Jue
            else if (unassignedWorkouts.length === 3) defaultIndexMap = [0, 2, 4]; // Lun, Mie, Vie
            else if (unassignedWorkouts.length === 4) defaultIndexMap = [0, 1, 3, 5]; // Lun, Mar, Jue, Sab
            else if (unassignedWorkouts.length === 5) defaultIndexMap = [0, 1, 2, 3, 4]; // Lun a Vie
            else defaultIndexMap = [0, 1, 2, 3, 4, 5];

            const foundWkPos = defaultIndexMap.indexOf(index);
            if (foundWkPos !== -1 && foundWkPos < unassignedWorkouts.length) {
              assignedWorkout = unassignedWorkouts[foundWkPos];
            }
          }
        }
      }

      // Calcular si el entrenamiento está completado
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
        monthShort: dayDate.toLocaleDateString('es-ES', { month: 'short' }),
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

  // Datos del día seleccionado
  const selectedDayData = weekDaysData[selectedDayIndex] || weekDaysData[0];

  // 5. Estadísticas de progreso global de la rutina
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
    return { totalSets, completed, percent };
  }, [routine.weeks, completedSets]);

  // Imagen de portada del entrenamiento seleccionado
  const workoutCoverImage = useMemo(() => {
    if (!selectedDayData?.assignedWorkout) return null;
    const wk = selectedDayData.assignedWorkout;
    if (wk.image) return wk.image;
    // Buscar thumbnail del primer ejercicio con video o grupo muscular
    if (wk.exercises && wk.exercises.length > 0) {
      const firstLibEx = library.find(l => l.id === wk.exercises[0].libraryExerciseId);
      if (firstLibEx) {
        return getExerciseCoverImage(firstLibEx);
      }
    }
    return routine.image || null;
  }, [selectedDayData, library, routine.image]);

  const handleApplyStartDate = () => {
    if (onUpdateStartDate && tempStartDate) {
      onUpdateStartDate(tempStartDate);
    }
    setShowStartDateModal(false);
  };

  return (
    <div className="min-h-screen bg-black text-white pb-24 max-w-md mx-auto relative select-none">
      
      {/* 1. TOP HEADER: Saludo + Selector de Semana + Vista Clásica */}
      <div className="pt-6 px-4 pb-3 flex items-center justify-between">
        <div>
          <span className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">
            Plan de Entrenamiento
          </span>
          <h1 className="text-2xl font-black tracking-tight text-white">
            ¡Hola, {routine.clientName ? routine.clientName.split(' ')[0] : 'Atleta'}! 👋
          </h1>
        </div>

        {/* Botón para alternar a vista de lista clásica */}
        <button
          onClick={onOpenClassicView}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300 border border-white/10 transition-colors shadow-sm"
          title="Ver vista lista tradicional"
        >
          <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
          </svg>
          <span>Lista</span>
        </button>
      </div>

      {/* 2. SELECTOR DE SEMANA (Chips deslizables) */}
      {routine.weeks.length > 1 && (
        <div className="px-4 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar">
          {routine.weeks.map((w, idx) => {
            const isWeekActive = currentWeek?.id === w.id;
            return (
              <button
                key={w.id}
                onClick={() => onChangeWeek(w.id)}
                className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                  isWeekActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 border border-white/5'
                }`}
              >
                {w.name || `Semana ${idx + 1}`}
              </button>
            );
          })}
        </div>
      )}

      {/* 3. TIRA DE CALENDARIO SEMANAL (L M M J V S D) */}
      <div className="px-4 py-3">
        <div className="bg-zinc-900/90 border border-white/10 rounded-2xl p-3 shadow-xl backdrop-blur-sm">
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
                  className={`flex flex-col items-center py-2.5 px-1 rounded-xl transition-all relative ${
                    isSelected
                      ? 'bg-white text-black shadow-lg scale-105 font-bold z-10'
                      : isToday
                      ? 'bg-zinc-800 text-white border border-blue-500/60'
                      : 'text-zinc-400 hover:bg-zinc-800/60'
                  }`}
                >
                  {/* Letra del día (L, M, M, J, V, S, D) */}
                  <span className={`text-[11px] font-bold uppercase mb-1 ${
                    isSelected ? 'text-zinc-700' : isToday ? 'text-blue-400 font-extrabold' : 'text-zinc-500'
                  }`}>
                    {dayItem.shortName}
                  </span>

                  {/* Círculo con número o Checkmark de completado */}
                  <div className="w-8 h-8 flex items-center justify-center rounded-full transition-transform">
                    {isDone ? (
                      <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-sm">
                        <svg className="w-4 h-4 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    ) : (
                      <span className={`text-sm ${isSelected ? 'font-black text-black' : 'font-semibold text-zinc-200'}`}>
                        {dayItem.dayNumber}
                      </span>
                    )}
                  </div>

                  {/* Dot indicador debajo */}
                  <div className="h-1.5 flex items-center justify-center mt-1">
                    {hasWk ? (
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        isDone
                          ? 'bg-blue-500'
                          : isSelected
                          ? 'bg-blue-600'
                          : isToday
                          ? 'bg-blue-400 animate-pulse'
                          : 'bg-zinc-500'
                      }`} />
                    ) : (
                      <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-zinc-400' : 'bg-transparent'}`} />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Subtítulo con fecha seleccionada y botón de configurar fecha de inicio */}
          <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-400">
            <span className="capitalize font-medium">
              {selectedDayData.fullName} {selectedDayData.dayNumber} de {selectedDayData.monthShort}
              {selectedDayData.isToday && (
                <span className="ml-1.5 text-blue-400 font-bold bg-blue-500/10 px-1.5 py-0.5 rounded text-[10px]">
                  HOY
                </span>
              )}
            </span>

            <button
              onClick={() => setShowStartDateModal(true)}
              className="text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
              title="Ajustar fecha de inicio del programa"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>Ajustar fecha</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. BANNER DE PROGRESO DEL PROGRAMA */}
      <div className="px-4 py-2">
        <div className="bg-gradient-to-r from-zinc-900 to-zinc-900/80 border border-white/10 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-[10px] uppercase tracking-wider font-extrabold text-blue-400">
                {routine.name || 'Programa Activo'}
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-black text-white">
                  {globalProgress.percent}%
                </span>
                <span className="text-xs text-zinc-400 font-medium">
                  {currentWeek?.name || `Semana ${currentWeekIndex + 1}`} de {routine.weeks.length}
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs font-semibold text-zinc-300">
                {globalProgress.completed} de {globalProgress.totalSets} series
              </span>
              <p className="text-[10px] text-zinc-500">¡Gran ritmo de progreso!</p>
            </div>
          </div>

          {/* Barra de progreso visual */}
          <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-600 h-full rounded-full transition-all duration-500 shadow-sm shadow-blue-500/50"
              style={{ width: `${Math.max(globalProgress.percent, 3)}%` }}
            />
          </div>
        </div>
      </div>

      {/* 5. SECCIÓN DE ENTRENAMIENTO DEL DÍA / DÍA DE DESCANSO */}
      <div className="px-4 py-3 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs uppercase font-extrabold tracking-wider text-zinc-400">
            {selectedDayData.hasWorkout ? 'Entrenamiento Programado' : 'Día de Recuperación'}
          </h2>

          {/* Botón de opciones (...) para cambiar de entrenamiento */}
          <button
            onClick={() => setShowSwapModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-xs font-semibold text-zinc-300 border border-white/10 transition-colors"
          >
            <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            <span>Cambiar sesión</span>
          </button>
        </div>

        {/* CASO A: TIENE ENTRENAMIENTO PROGRAMADO */}
        {selectedDayData.hasWorkout && selectedDayData.assignedWorkout ? (
          <div className="bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl relative group">
            
            {/* Foto de portada del entrenamiento */}
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
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-950">
                  <svg className="w-16 h-16 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
              )}

              {/* Degradado para legibilidad */}
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />

              {/* Badges superiores: Estado (Completado / Por hacer) */}
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                {selectedDayData.isCompleted ? (
                  <span className="px-3 py-1 rounded-full bg-blue-600/90 text-white text-[11px] font-black uppercase tracking-wider backdrop-blur-md shadow-md flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Completado
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full bg-black/60 text-zinc-300 text-[11px] font-bold uppercase tracking-wider backdrop-blur-md border border-white/10">
                    {selectedDayData.isToday ? 'Programado para hoy' : 'Próxima sesión'}
                  </span>
                )}

                {/* Botón de 3 puntos */}
                <button
                  onClick={() => setShowSwapModal(true)}
                  className="w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md flex items-center justify-center text-white border border-white/10 transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="2" />
                    <circle cx="19" cy="12" r="2" />
                    <circle cx="5" cy="12" r="2" />
                  </svg>
                </button>
              </div>

              {/* Datos en la base de la imagen */}
              <div className="absolute bottom-3 left-3 right-3">
                <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider">
                  {selectedDayData.fullName} · {selectedDayData.assignedWorkout.exercises?.length || 0} ejercicios
                </span>
                <h3 className="text-xl font-black text-white tracking-tight">
                  {selectedDayData.assignedWorkout.name || 'Sesión de Entrenamiento'}
                </h3>
              </div>
            </div>

            {/* Contenido de la tarjeta */}
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <span>{selectedDayData.totalSets} series programadas</span>
                </div>

                {selectedDayData.doneSets > 0 && (
                  <span className="font-semibold text-blue-400">
                    {selectedDayData.doneSets} / {selectedDayData.totalSets} completadas
                  </span>
                )}
              </div>

              {/* Botón principal de acción: Iniciar / Continuar / Revisar */}
              <button
                onClick={() => onSelectWorkout(selectedDayData.assignedWorkout!.id)}
                className={`w-full py-3.5 px-6 rounded-xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl transition-all active:scale-[0.98] ${
                  selectedDayData.isCompleted
                    ? 'bg-zinc-800 hover:bg-zinc-700 text-white border border-white/10'
                    : 'bg-white hover:bg-zinc-200 text-black shadow-white/10'
                }`}
              >
                <span>
                  {selectedDayData.isCompleted
                    ? 'Ver Resumen de la Sesión'
                    : selectedDayData.doneSets > 0
                    ? 'Continuar Entrenamiento'
                    : 'Iniciar Entrenamiento'}
                </span>
                <svg className="w-4 h-4 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>
          </div>
        ) : (
          /* CASO B: DÍA DE DESCANSO AUTOMÁTICO O EXPLICITO */
          <div className="bg-gradient-to-b from-zinc-900 to-zinc-950 border border-white/10 rounded-2xl p-6 text-center space-y-4 shadow-xl">
            <div className="w-16 h-16 mx-auto rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shadow-inner">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            </div>

            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">
                Recuperación Activa
              </span>
              <h3 className="text-xl font-black text-white mt-0.5">
                Hoy toca Descanso
              </h3>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed max-w-xs mx-auto">
                El descanso es fundamental para la hipertrofia y recuperación muscular. Hidratate bien, descansá y preparate para romperla en tu próxima sesión.
              </p>
            </div>

            <div className="pt-2 border-t border-white/5">
              <button
                onClick={() => setShowSwapModal(true)}
                className="w-full py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition-all border border-white/10 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>¿Vas a entrenar hoy? Elegir entrenamiento</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 6. MODAL INTERACTIVO: CAMBIAR / MOVER ENTRENAMIENTO DEL DÍA */}
      {showSwapModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-white/10 rounded-t-3xl sm:rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
            
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div>
                <span className="text-[10px] uppercase font-extrabold text-blue-400 tracking-wider">
                  Mover / Ajustar Calendario
                </span>
                <h3 className="text-lg font-black text-white">
                  ¿Qué querés hacer este {selectedDayData.fullName}?
                </h3>
              </div>
              <button
                onClick={() => setShowSwapModal(false)}
                className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              Podés mover una sesión de esta semana a hoy si tenés disponibilidad, o marcar este día como descanso.
            </p>

            {/* Opciones de entrenamientos disponibles */}
            <div className="space-y-2 pt-1">
              <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                Sesiones disponibles de la semana:
              </span>

              {currentWeek?.workouts.map(wk => {
                const isCurrentlyAssigned = selectedDayData.assignedWorkout?.id === wk.id;
                return (
                  <button
                    key={wk.id}
                    onClick={() => {
                      const dayKey = `${currentWeek.id}_${selectedDayIndex}`;
                      onUpdateDayOverride(dayKey, wk.id);
                      setShowSwapModal(false);
                    }}
                    className={`w-full p-3.5 rounded-xl border flex items-center justify-between text-left transition-all ${
                      isCurrentlyAssigned
                        ? 'bg-blue-600/20 border-blue-500 text-white'
                        : 'bg-zinc-800/80 hover:bg-zinc-700/80 border-white/10 text-zinc-200'
                    }`}
                  >
                    <div>
                      <h4 className="text-sm font-bold text-white">{wk.name}</h4>
                      <span className="text-[11px] text-zinc-400">
                        {wk.exercises?.length || 0} ejercicios programados
                      </span>
                    </div>

                    {isCurrentlyAssigned ? (
                      <span className="text-xs font-bold text-blue-400 bg-blue-500/20 px-2 py-0.5 rounded">
                        Asignado hoy
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-zinc-400 group-hover:text-white">
                        Seleccionar →
                      </span>
                    )}
                  </button>
                );
              })}

              {/* Opción de Marcar como Descanso */}
              <button
                onClick={() => {
                  const dayKey = `${currentWeek?.id}_${selectedDayIndex}`;
                  onUpdateDayOverride(dayKey, 'rest');
                  setShowSwapModal(false);
                }}
                className={`w-full p-3.5 rounded-xl border flex items-center justify-between text-left transition-all ${
                  !selectedDayData.hasWorkout
                    ? 'bg-blue-600/20 border-blue-500 text-white'
                    : 'bg-zinc-800/50 hover:bg-zinc-800 border-white/5 text-zinc-400'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-base">🛌</span>
                  <div>
                    <h4 className="text-sm font-bold text-white">Marcar como Día de Descanso</h4>
                    <span className="text-[11px] text-zinc-400">No entrenar en esta fecha</span>
                  </div>
                </div>

                {!selectedDayData.hasWorkout && (
                  <span className="text-xs font-bold text-blue-400">Activo</span>
                )}
              </button>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setShowSwapModal(false)}
                className="w-full py-2.5 rounded-xl bg-zinc-800 text-zinc-300 font-bold text-xs hover:bg-zinc-700 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL: AJUSTAR FECHA DE INICIO DE LA RUTINA */}
      {showStartDateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div>
              <span className="text-[10px] uppercase font-extrabold text-blue-400 tracking-wider">
                Configuración del Calendario
              </span>
              <h3 className="text-lg font-black text-white mt-0.5">
                Fecha de Inicio del Plan
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Elegí qué día comenzó (o comienza) la Semana 1 de esta rutina para sincronizar las fechas reales.
              </p>
            </div>

            <div>
              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                Fecha (Día de inicio)
              </label>
              <input
                type="date"
                value={tempStartDate}
                onChange={e => setTempStartDate(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500 font-medium"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setShowStartDateModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 font-bold text-xs hover:bg-zinc-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleApplyStartDate}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/20"
              >
                Guardar Fecha
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
