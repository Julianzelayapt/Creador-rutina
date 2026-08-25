
import React, { useState } from 'react';
import { Routine } from '../types';

const SAMPLE_IMAGES = [
  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=800',
  'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&q=80&w=800',
  'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&q=80&w=800',
  'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&q=80&w=800'
];

interface RoutineSetupProps {
  onRoutineCreated: (routine: Routine) => void;
}

const compressImage = (file: File, maxWidth = 800, maxHeight = 600, quality = 0.6): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(event.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Error al cargar imagen'));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Error al leer archivo'));
    reader.readAsDataURL(file);
  });
};

const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const RoutineSetup: React.FC<RoutineSetupProps> = ({ onRoutineCreated }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    clientName: '',
    image: SAMPLE_IMAGES[0]
  });
  const [customImageUrl, setCustomImageUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Por favor, ingresa un nombre para la rutina.');
      return;
    }
    if (!formData.clientName.trim()) {
      alert('Por favor, ingresa el nombre del asesorado.');
      return;
    }

    const newRoutine: Routine = {
      id: generateUUID(),
      ...formData,
      weeks: [],
      enabledMetrics: {
        reps: true,
        kg: true,
        rir: true,
        rmPercentage: false,
        rest: true,
        tempo: false
      }
    };

    onRoutineCreated(newRoutine);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressedBase64 = await compressImage(file, 800, 600, 0.6);
        setFormData({ ...formData, image: compressedBase64 });
      } catch (err) {
        console.error('Error al comprimir la imagen:', err);
        // Fallback en caso de error
        const reader = new FileReader();
        reader.onloadend = () => {
          setFormData({ ...formData, image: reader.result as string });
        };
        reader.readAsDataURL(file);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-white dark:bg-darkCard rounded-2xl shadow-2xl p-8 md:p-12 border border-slate-100 dark:border-slate-800">
        <div className="text-center mb-10">
          <div className="inline-block p-4 bg-yellow-500 text-black shadow-lg shadow-yellow-500/20">
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <h1 className="text-3xl font-['Oswald'] font-black text-slate-900 dark:text-white tracking-tighter uppercase">Generador de Rutinas</h1>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-2">Completa los campos para empezar</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Nombre de la Rutina</label>
            <input
              type="text"
              placeholder="Ej: Hipertrofia Full Body"
              className="w-full px-6 py-5 bg-slate-50 dark:bg-black border-2 border-transparent rounded-[1.5rem] focus:border-yellow-600 outline-none transition-all font-bold text-slate-800 dark:text-white"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Descripción</label>
            <textarea
              placeholder="Escribe los objetivos o detalles..."
              rows={2}
              className="w-full px-6 py-5 bg-slate-50 dark:bg-black border-2 border-transparent rounded-[1.5rem] focus:border-yellow-600 outline-none transition-all font-medium text-slate-600 dark:text-slate-400 resize-none"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Nombre del Asesorado</label>
            <input
              type="text"
              placeholder="¿A quién va dirigida?"
              className="w-full px-6 py-5 bg-slate-50 dark:bg-black border-2 border-transparent rounded-[1.5rem] focus:border-yellow-600 outline-none transition-all font-bold text-slate-800 dark:text-white"
              value={formData.clientName}
              onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
            />
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Selecciona una Foto de Portada</label>
            <div className="grid grid-cols-4 gap-3">
              {SAMPLE_IMAGES.map((img, idx) => (
                <div
                  key={idx}
                  className={`relative cursor-pointer rounded-2xl overflow-hidden h-16 border-4 transition-all ${formData.image === img ? 'border-yellow-500 scale-105 shadow-xl' : 'border-transparent opacity-60 hover:opacity-100'}`}
                  onClick={() => setFormData({ ...formData, image: img })}
                >
                  <img src={img} alt="Preview" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">O sube tu propia imagen</p>
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Pegar URL de imagen..."
                  className="flex-1 px-4 py-3 bg-slate-50 dark:bg-black border-2 border-transparent rounded-xl focus:border-yellow-600 outline-none text-xs font-medium text-slate-800 dark:text-white"
                  value={customImageUrl}
                  onChange={(e) => {
                    setCustomImageUrl(e.target.value);
                    if (e.target.value) setFormData({ ...formData, image: e.target.value });
                  }}
                />
                <label className="cursor-pointer px-4 py-3 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-xl transition-colors flex items-center gap-2">
                  <svg className="w-5 h-5 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  <span className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">Subir</span>
                  <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                </label>
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-6 bg-yellow-400 text-black rounded-2xl font-['Oswald'] font-black text-lg uppercase tracking-widest hover:bg-yellow-500 active:scale-95 transition-all shadow-2xl shadow-yellow-500/20 mt-4"
          >
            Crear Rutina
          </button>
        </form>
      </div>
    </div>
  );
};

export default RoutineSetup;
