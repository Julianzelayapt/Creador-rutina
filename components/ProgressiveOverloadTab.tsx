import React, { useState, useEffect } from 'react';
import { Routine, Exercise } from '../types';
import { getMuscleGroupImage } from '../muscleGroups';
import { getExerciseCoverImage, isYouTubeShort } from './ClientView';

interface ProgressiveOverloadTabProps {
  routine: Routine;
  library: Exercise[];
  weeklySnapshots: Record<string, Record<string, number>>;
  language: 'es' | 'en' | 'it';
}

const ProgressiveOverloadTab: React.FC<ProgressiveOverloadTabProps> = ({ routine, library, weeklySnapshots, language }) => {
  const t = (key: string) => {
    const translations: Record<string, Record<string, string>> = {
      es: {
        week: 'Semana',
        avgKg: 'MÁX KG',
        delta: 'Δ KG',
        change: '% CAMBIO',
        progress: 'PROGRESO',
        noData: 'Completá las series con peso para ver el progreso histórico',
        selectExercise: 'Seleccionar Ejercicio',
        weeklyProgress: 'Progreso por semana',
      },
      en: {
        week: 'Week',
        avgKg: 'MAX KG',
        delta: 'Δ KG',
        change: '% CHANGE',
        progress: 'PROGRESS',
        noData: 'Complete sets with weight to view progress history',
        selectExercise: 'Select Exercise',
        weeklyProgress: 'Weekly progress',
      },
      it: {
        week: 'Settimana',
        avgKg: 'MAX KG',
        delta: 'Δ KG',
        change: '% CAMBIO',
        progress: 'PROGRESSO',
        noData: 'Completa le serie con peso per vedere i progressi',
        selectExercise: 'Seleziona Esercizio',
        weeklyProgress: 'Progresso settimanale',
      }
    };
    return translations[language][key] || key;
  };

  // Extraer ejercicios únicos de la rutina
  const uniqueExerciseIds = Array.from(new Set(
    routine.weeks.flatMap(week =>
      week.workouts.flatMap(workout =>
        workout.exercises.map(entry => entry.libraryExerciseId)
      )
    )
  ));

  const [selectedExId, setSelectedExId] = useState<string>(uniqueExerciseIds[0] || '');

  useEffect(() => {
    if (!selectedExId && uniqueExerciseIds.length > 0) {
      setSelectedExId(uniqueExerciseIds[0]);
    }
  }, [uniqueExerciseIds, selectedExId]);

  const getTranslatedWeekName = (name: string, fallbackIdx?: number) => {
    if (!name) return `${t('week')} ${(fallbackIdx ?? 0) + 1}`;
    const trimmed = name.trim();
    const match = trimmed.match(/^(?:semana|week|settimana)\s*(\d+)\s*(?:[·\-:]\s*(.*))?$/i);
    if (match) {
      const num = match[1];
      const rest = match[2];
      return rest ? `${t('week')} ${num} · ${rest}` : `${t('week')} ${num}`;
    }
    return trimmed;
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300 font-['Inter']">

      {/* Selector de Ejercicio Minimalista */}
      <div className="relative group max-w-md mx-auto">
        <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider ml-1 mb-1.5 block">
          {t('selectExercise')}
        </label>
        <div className="relative">
          <select
            value={selectedExId}
            onChange={(e) => setSelectedExId(e.target.value)}
            className="w-full bg-[#18181b] border border-white/10 px-4 py-3 rounded-xl font-semibold text-sm text-white appearance-none cursor-pointer focus:outline-none focus:border-white/30 transition-all shadow-sm"
          >
            {uniqueExerciseIds.map(exId => {
              const libEx = library.find(l => l.id === exId);
              return (
                <option key={exId} value={exId} className="bg-zinc-900 text-white">
                  {libEx?.name || '...'}
                </option>
              );
            })}
          </select>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {selectedExId && (() => {
        const exId = selectedExId;
        const libEx = library.find(l => l.id === exId);
        if (!libEx) return null;

        let previousAvg = 0;
        let hasData = false;

        return (
          <div key={exId} className="bg-[#18181b] border border-white/5 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">

            {/* Header: Thumbnail al lado del texto del ejercicio */}
            <div className="flex items-center gap-3.5 pb-3 border-b border-white/5">
              {/* Thumbnail 16:9 con miniatura de YouTube */}
              <div className="w-24 h-14 rounded-lg overflow-hidden shrink-0 bg-zinc-900 border border-white/10 relative shadow-md">
                {getExerciseCoverImage(libEx) ? (
                  <img
                    src={getExerciseCoverImage(libEx)}
                    alt={libEx.name}
                    className={`w-full h-full object-cover ${isYouTubeShort(libEx.videoUrl) ? 'scale-[1.8]' : ''}`}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="font-bold text-xs text-zinc-400">
                      {(libEx.name || 'EX').substring(0, 2).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug truncate">
                  {libEx.name}
                </h3>
                <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mt-0.5">
                  {t('weeklyProgress')}
                </p>
              </div>
            </div>

            {/* Tabla de Sobrecarga Progresiva */}
            <div className="overflow-x-auto">
              <table className="w-full text-center">
                <thead>
                  <tr className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider border-b border-white/5">
                    <th className="py-2.5 text-left pl-2">{t('week')}</th>
                    <th className="py-2.5">{t('avgKg')}</th>
                    <th className="py-2.5">{t('delta')}</th>
                    <th className="py-2.5">{t('change')}</th>
                    <th className="py-2.5 text-right pr-2">{t('progress')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {routine.weeks.map((week, wIdx) => {
                    const avgKg = weeklySnapshots[week.id]?.[exId];
                    if (avgKg === undefined) return null;

                    hasData = true;

                    const delta = previousAvg > 0 ? Number((avgKg - previousAvg).toFixed(1)) : null;
                    const percentChange = previousAvg > 0 ? Number(((delta! / previousAvg) * 100).toFixed(1)) : null;

                    previousAvg = avgKg;

                    const radius = 12;
                    const circumference = 2 * Math.PI * radius;
                    let strokeDashoffset = circumference;
                    let colorClass = 'text-zinc-400';

                    if (percentChange !== null) {
                      const fillPercentage = Math.min(Math.max(Math.abs(percentChange), 0), 100);
                      strokeDashoffset = circumference - (fillPercentage / 100) * circumference;
                      colorClass = percentChange > 0 ? 'text-emerald-400' : 'text-rose-400';
                    }

                    return (
                      <tr key={week.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3.5 text-left pl-2 font-medium text-xs text-zinc-200">
                          {getTranslatedWeekName(week.name, wIdx)}
                        </td>
                        <td className="py-3.5 font-bold text-sm text-white font-mono">
                          {avgKg} <span className="text-[10px] font-normal text-zinc-400">kg</span>
                        </td>
                        <td className="py-3.5">
                          {delta !== null ? (
                            <span className={`inline-block font-mono font-bold text-xs px-2 py-0.5 rounded-lg ${
                              delta > 0
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : delta < 0
                                ? 'bg-rose-500/10 text-rose-400'
                                : 'bg-zinc-800 text-zinc-400'
                            }`}>
                              {delta > 0 ? `+${delta}` : delta}
                            </span>
                          ) : (
                            <span className="text-zinc-600">—</span>
                          )}
                        </td>
                        <td className="py-3.5 font-mono text-xs font-semibold">
                          {percentChange !== null ? (
                            <span className={percentChange > 0 ? 'text-emerald-400' : percentChange < 0 ? 'text-rose-400' : 'text-zinc-400'}>
                              {percentChange > 0 ? `+${percentChange}%` : `${percentChange}%`}
                            </span>
                          ) : (
                            <span className="text-zinc-600">—</span>
                          )}
                        </td>
                        <td className="py-3.5 text-right pr-2">
                          {delta !== null ? (
                            <div className="flex justify-end ml-auto">
                              <div className="relative w-8 h-8 flex items-center justify-center">
                                <svg className="w-full h-full transform -rotate-90">
                                  <circle
                                    cx="16"
                                    cy="16"
                                    r={radius}
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    fill="transparent"
                                    className="text-zinc-800"
                                  />
                                  <circle
                                    cx="16"
                                    cy="16"
                                    r={radius}
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    fill="transparent"
                                    strokeDasharray={circumference}
                                    strokeDashoffset={strokeDashoffset}
                                    className={`${colorClass} transition-all duration-700 ease-out`}
                                    strokeLinecap="round"
                                  />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                  {percentChange! > 0 ? (
                                    <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                                    </svg>
                                  ) : (
                                    <svg className="w-3 h-3 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                    </svg>
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <span className="text-zinc-600 font-bold">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {!hasData && (
                <div className="text-center py-6">
                  <p className="text-zinc-400 text-xs font-medium">{t('noData')}</p>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default ProgressiveOverloadTab;
