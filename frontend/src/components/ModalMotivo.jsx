import { useState } from 'react';
import { X } from 'lucide-react';

/**
 * Modal de decision con motivo. Reemplaza window.prompt: los navegadores
 * pueden bloquear los dialogos nativos y dejar los botones sin respuesta.
 * onConfirm(motivo) recibe el texto recortado (vacio si es opcional).
 */
export default function ModalMotivo({
  titulo,
  etiqueta = 'Motivo',
  requerido = false,
  textoBoton = 'Confirmar',
  color = 'blue',
  placeholder = '',
  procesando = false,
  onConfirm,
  onCerrar,
}) {
  const [valor, setValor] = useState('');

  const colores = {
    blue: 'bg-blue-600 hover:bg-blue-700',
    green: 'bg-emerald-600 hover:bg-emerald-700',
    red: 'bg-red-600 hover:bg-red-700',
    amber: 'bg-amber-600 hover:bg-amber-700',
  };

  const submit = (evento) => {
    evento.preventDefault();
    const limpio = valor.trim();
    if (requerido && !limpio) return;
    onConfirm(limpio);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 dark:bg-black/60 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-xl bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700/60">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">{titulo}</h3>
          <button
            type="button"
            onClick={onCerrar}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {etiqueta}
            <span className="text-slate-400 font-normal"> ({requerido ? 'obligatorio' : 'opcional'})</span>
          </label>
          <textarea
            rows={3}
            autoFocus
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder={placeholder}
            className="w-full p-2.5 bg-white dark:bg-slate-900/40 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-800 dark:text-slate-100"
          />
        </div>
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700/60 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCerrar}
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={procesando || (requerido && !valor.trim())}
            className={`px-4 py-2 text-white text-sm font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${colores[color]}`}
          >
            {procesando ? 'Procesando…' : textoBoton}
          </button>
        </div>
      </form>
    </div>
  );
}
