import React, { useState, useEffect } from 'react';
import { Routine, Exercise } from '../types';

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
                avgKg: 'MAX KG',
                delta: 'Δ KG',
                change: '% CAMBIO',
                progress: 'PROGRESO',
                noData: 'Completá sets con peso para ver el progreso',
                selectExercise: 'Seleccioná un ejercicio para ver su historia',
            },
            en: {
                week: 'Week',
                avgKg: 'MAX KG',
                delta: 'Δ KG',
                change: '% CHANGE',
                progress: 'PROGRESS',
                noData: 'Complete sets with weight to see progress',
                selectExercise: 'Select an exercise to view history',
            },
            it: {
                week: 'Settimana',
                avgKg: 'MAX KG',
                delta: 'Δ KG',
                change: '% CAMBIO',
                progress: 'PROGRESSO',
                noData: 'Completa le serie con peso per vedere il progresso',
                selectExercise: 'Seleziona un esercizio per vedere la cronologia',
            }
        };
        return translations[language][key] || key;
    };

    // Extraer todos los ejercicios únicos de la rutina
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

    const getTranslatedWeekName = (name: string) => {
        const numMatch = name.match(/\d+/);
        if (numMatch && name.toLowerCase().includes('week')) {
            return `${t('week')} ${numMatch[0]}`;
        }
        return name;
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">

            {/* Selector de Ejercicio */}
            <div className="relative group max-w-md mx-auto mb-10">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-2 block">{t('selectExercise')}</label>
                <select
                    value={selectedExId}
                    onChange={(e) => setSelectedExId(e.target.value)}
                    className="w-full bg-white dark:bg-darkCard px-6 py-5 rounded-[2rem] font-black uppercase italic text-sm tracking-widest border border-slate-100 dark:border-slate-800 shadow-lg appearance-none cursor-pointer focus:border-blue-500 transition-all outline-none text-slate-900 dark:text-white"
                >
                    {uniqueExerciseIds.map(exId => {
                        const libEx = library.find(l => l.id === exId);
                        return (
                            <option key={exId} value={exId}>{libEx?.name || '...'}</option>
                        );
                    })}
                </select>
                <div className="absolute right-6 bottom-5 pointer-events-none text-blue-600">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z" /></svg>
                </div>
            </div>

            {selectedExId && (() => {
                const exId = selectedExId;
                const libEx = library.find(l => l.id === exId);
                if (!libEx) return null;

                let previousAvg = 0;
                let hasData = false;

                return (
                    <div key={exId} className="bg-white dark:bg-darkCard rounded-[2.5rem] lg:rounded-[3.5rem] p-5 lg:p-10 shadow-lg border border-slate-100 dark:border-slate-800">
                        {/* Header: Name and Muscle Image in a Card */}
                        <div className="flex flex-col md:flex-row md:items-center gap-8 mb-10 bg-[#0F1115] dark:bg-[#0F1115] p-6 lg:p-8 rounded-[2rem] border border-slate-800 shadow-2xl">
                            {libEx.muscleImage && (
                                <div className="h-40 w-40 lg:h-48 lg:w-48 shrink-0 rounded-[1.5rem] border-2 border-slate-700 bg-[#0F1115] flex items-center justify-center p-2 relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                                    <img
                                        src={libEx.muscleImage}
                                        alt="Muscle"
                                        className="h-full w-full object-contain drop-shadow-lg transition-transform duration-500 group-hover:scale-110"
                                    />
                                </div>
                            )}
                            <div className="flex flex-col justify-center">
                                <h4 className="text-3xl lg:text-5xl font-black text-white tracking-tighter uppercase italic drop-shadow-md">{libEx.name}</h4>
                                <p className="text-blue-500 font-black text-sm uppercase tracking-[0.3em] mt-3 opacity-80">{t('avgKg')}</p>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-center">
                                <thead>
                                    <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 dark:border-slate-800">
                                        <th className="py-4 text-left pl-4">{t('week')}</th>
                                        <th className="py-4">{t('avgKg')}</th>
                                        <th className="py-4">{t('delta')}</th>
                                        <th className="py-4">{t('change')}</th>
                                        <th className="py-4 text-right pr-4">{t('progress')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {routine.weeks.map((week, index) => {
                                        const avgKg = weeklySnapshots[week.id]?.[exId];
                                        if (avgKg === undefined) return null;

                                        hasData = true;

                                        const delta = previousAvg > 0 ? Number((avgKg - previousAvg).toFixed(1)) : null;
                                        const percentChange = previousAvg > 0 ? Number(((delta! / previousAvg) * 100).toFixed(1)) : null;

                                        previousAvg = avgKg;

                                        // Circular Progress Calculation
                                        const radius = 16;
                                        const circumference = 2 * Math.PI * radius;
                                        let strokeDashoffset = circumference;
                                        let colorClass = 'text-slate-300 dark:text-slate-700';

                                        if (percentChange !== null) {
                                            // Cap percentage between 0 and 100 for the circle fill
                                            const fillPercentage = Math.min(Math.max(Math.abs(percentChange), 0), 100);
                                            strokeDashoffset = circumference - (fillPercentage / 100) * circumference;
                                            colorClass = percentChange > 0 ? 'text-green-500' : 'text-red-500';
                                        }

                                        return (
                                            <tr key={week.id} className="border-b border-slate-50 dark:border-slate-900 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                                                <td className="py-6 text-left pl-4 font-bold text-slate-700 dark:text-slate-300">
                                                    {getTranslatedWeekName(week.name)}
                                                </td>
                                                <td className="py-6 font-black text-xl text-slate-900 dark:text-white">
                                                    {avgKg} <span className="text-xs text-slate-400">kg</span>
                                                </td>
                                                <td className="py-6">
                                                    {delta !== null ? (
                                                        <span className={`font-black text-sm px-3 py-1 rounded-full ${delta > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : delta < 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                                                            {delta > 0 ? '+' : ''}{delta}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-300 dark:text-slate-700">—</span>
                                                    )}
                                                </td>
                                                <td className="py-6 font-bold text-slate-600 dark:text-slate-400">
                                                    {percentChange !== null ? (
                                                        <span className={percentChange > 0 ? 'text-green-500' : percentChange < 0 ? 'text-red-500' : ''}>
                                                            {percentChange > 0 ? '+' : ''}{percentChange}%
                                                        </span>
                                                    ) : (
                                                        <span>—</span>
                                                    )}
                                                </td>
                                                <td className="py-6 text-right pr-4">
                                                    {delta !== null ? (
                                                        <div className="flex justify-end ml-auto">
                                                            <div className="relative w-12 h-12 flex items-center justify-center">
                                                                {/* Background Circle */}
                                                                <svg className="w-full h-full transform -rotate-90">
                                                                    <circle
                                                                        cx="24"
                                                                        cy="24"
                                                                        r={radius}
                                                                        stroke="currentColor"
                                                                        strokeWidth="4"
                                                                        fill="transparent"
                                                                        className="text-slate-100 dark:text-slate-800"
                                                                    />
                                                                    {/* Progress Circle */}
                                                                    <circle
                                                                        cx="24"
                                                                        cy="24"
                                                                        r={radius}
                                                                        stroke="currentColor"
                                                                        strokeWidth="4"
                                                                        fill="transparent"
                                                                        strokeDasharray={circumference}
                                                                        strokeDashoffset={strokeDashoffset}
                                                                        className={`${colorClass} transition-all duration-1000 ease-out`}
                                                                        strokeLinecap="round"
                                                                    />
                                                                </svg>
                                                                {/* Icon inside */}
                                                                <div className="absolute inset-0 flex items-center justify-center">
                                                                    {percentChange! > 0 ? (
                                                                        <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                                                                    ) : (
                                                                        <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-300 dark:text-slate-700 font-bold">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {!hasData && (
                                <div className="text-center py-6">
                                    <p className="text-slate-400 text-sm font-bold italic">{t('noData')}</p>
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
