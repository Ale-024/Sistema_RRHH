import { useCallback, useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, Settings, XCircle } from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import { tienePermiso } from '../shared/roles';

const inicial = { clave: '', valor: '', unidad: 'MONTO_CENT', vigenciaDesde: '', descripcion: '', baseLegal: '' };

export default function AdminParameters() {
  const { user } = useAuthStore();
  const puedeAdministrar = tienePermiso(user, 'parametros:administrar');
  const [items, setItems] = useState([]);
  const [modalCrear, setModalCrear] = useState(false);
  const [form, setForm] = useState(inicial);
  const [mensaje, setMensaje] = useState('');
  const [procesando, setProcesando] = useState(false);

  // Estado de edicion
  const [edicion, setEdicion] = useState(null); // { item, valor, descripcion, baseLegal, motivo }
  const [confirmado, setConfirmado] = useState(false);
  const [errorEdicion, setErrorEdicion] = useState('');

  const cargar = useCallback(async () => {
    try {
      setItems((await api.get('/admin/parametros-legales')).data);
    } catch {
      setMensaje('No fue posible cargar los parámetros.');
    }
  }, []);

  useEffect(() => {
    // react(set-state-in-effect) intencional: sincroniza datos remotos al montar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
  }, [cargar]);

  const crear = async (event) => {
    event.preventDefault();
    setProcesando(true);
    try {
      await api.post('/admin/parametros-legales', form);
      setModalCrear(false);
      setMensaje('Nueva vigencia guardada.');
      setForm(inicial);
      await cargar();
    } catch (error) {
      setMensaje(error.response?.data?.detail || error.response?.data?.message || 'No fue posible guardar el parámetro.');
    } finally {
      setProcesando(false);
    }
  };

  const abrirEdicion = (item) => {
    setEdicion({
      item,
      valor: item.valor,
      descripcion: item.descripcion ?? '',
      baseLegal: item.baseLegal ?? '',
      motivo: '',
    });
    setConfirmado(false);
    setErrorEdicion('');
  };

  const guardarEdicion = async () => {
    if (!edicion) return;
    if (edicion.motivo.trim().length < 10) {
      setErrorEdicion('Describe el motivo con al menos 10 caracteres.');
      return;
    }
    if (!confirmado) {
      setErrorEdicion('Marca la casilla de confirmación para continuar.');
      return;
    }
    setProcesando(true);
    setErrorEdicion('');
    try {
      const cuerpo = {};
      if (edicion.valor !== edicion.item.valor) cuerpo.valor = edicion.valor;
      if ((edicion.descripcion ?? '') !== (edicion.item.descripcion ?? '')) cuerpo.descripcion = edicion.descripcion;
      if ((edicion.baseLegal ?? '') !== (edicion.item.baseLegal ?? '')) cuerpo.baseLegal = edicion.baseLegal;
      if (!Object.keys(cuerpo).length) {
        setErrorEdicion('No hay cambios por guardar.');
        return;
      }
      cuerpo.motivo = edicion.motivo.trim();
      await api.patch(`/admin/parametros-legales/${edicion.item.id}`, cuerpo);
      setMensaje(`Parámetro "${edicion.item.clave}" actualizado. El cambio quedó registrado en auditoría.`);
      setEdicion(null);
      await cargar();
    } catch (error) {
      setErrorEdicion(error.response?.data?.message || 'No fue posible actualizar el parámetro.');
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Parámetros legales</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">Las nuevas vigencias afectan únicamente cálculos futuros.</p>
        </div>
        {puedeAdministrar && (
          <button onClick={() => setModalCrear(true)} className="flex items-center rounded-lg bg-brand-blue px-4 py-2 font-medium text-white hover:bg-brand-DEFAULT">
            <Plus className="mr-1 h-5 w-5" /> Nueva vigencia
          </button>
        )}
      </div>

      {mensaje && <div className="rounded-lg border-l-4 border-green-600 bg-green-50 dark:bg-emerald-500/10 p-4 text-sm text-green-700 dark:text-emerald-400">{mensaje}</div>}

      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
        <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
          <thead className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs uppercase text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-6 py-4">Clave</th>
              <th className="px-6 py-4">Valor</th>
              <th className="px-6 py-4">Unidad</th>
              <th className="px-6 py-4">Vigencia</th>
              {puedeAdministrar && <th className="px-6 py-4 text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const vencida = item.vigenciaHasta && new Date(item.vigenciaHasta) < new Date();
              return (
                <tr key={item.id} className="border-b border-slate-100 dark:border-slate-700/60">
                  <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">{item.clave}</td>
                  <td className="px-6 py-4">{item.valor}</td>
                  <td className="px-6 py-4">{item.unidad || '—'}</td>
                  <td className="px-6 py-4 text-xs">
                    {new Date(item.vigenciaDesde).toLocaleDateString()} — {item.vigenciaHasta ? new Date(item.vigenciaHasta).toLocaleDateString() : 'abierta'}
                    {vencida && <span className="ml-2 rounded bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 text-[10px] uppercase text-slate-400">histórico</span>}
                  </td>
                  {puedeAdministrar && (
                    <td className="px-6 py-4 text-right">
                      {!vencida ? (
                        <button onClick={() => abrirEdicion(item)} className="inline-flex items-center rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-800 hover:bg-brand-100">
                          <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {!items.length && (
              <tr><td colSpan={puedeAdministrar ? 5 : 4} className="p-12 text-center text-slate-400"><Settings className="mx-auto mb-2 h-10 w-10 text-slate-300" />No hay parámetros.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de creacion */}
      {modalCrear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white dark:bg-slate-800 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 px-6 py-4">
              <h3 className="font-bold text-slate-900 dark:text-slate-100">Nueva vigencia</h3>
              <button type="button" onClick={() => setModalCrear(false)} aria-label="Cerrar"><XCircle className="h-6 w-6 text-slate-400" /></button>
            </div>
            <form onSubmit={crear} className="grid gap-4 p-6">
              <input required placeholder="Clave (ej. SALARIO_MINIMO)" value={form.clave} onChange={(e) => setForm({ ...form, clave: e.target.value.toUpperCase() })} className="rounded-lg border border-slate-300 dark:border-slate-600 p-2.5" />
              <div className="grid grid-cols-2 gap-4">
                <input required placeholder="Valor" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} className="rounded-lg border border-slate-300 dark:border-slate-600 p-2.5" />
                <input placeholder="Unidad (MONTO_CENT, PORCENTAJE…)" value={form.unidad} onChange={(e) => setForm({ ...form, unidad: e.target.value })} className="rounded-lg border border-slate-300 dark:border-slate-600 p-2.5" />
              </div>
              <label className="text-sm text-slate-600 dark:text-slate-400">
                Vigencia desde
                <input required type="date" value={form.vigenciaDesde} onChange={(e) => setForm({ ...form, vigenciaDesde: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 p-2.5" />
              </label>
              <input placeholder="Descripción" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} className="rounded-lg border border-slate-300 dark:border-slate-600 p-2.5" />
              <input placeholder="Base legal" value={form.baseLegal} onChange={(e) => setForm({ ...form, baseLegal: e.target.value })} className="rounded-lg border border-slate-300 dark:border-slate-600 p-2.5" />
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setModalCrear(false)} className="rounded-lg px-4 py-2 text-slate-600 dark:text-slate-400">Cancelar</button>
                <button type="submit" disabled={procesando} className="flex items-center rounded-lg bg-brand-blue px-4 py-2 font-medium text-white disabled:opacity-60">
                  {procesando && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de edicion con confirmacion */}
      {edicion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white dark:bg-slate-800 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 px-6 py-4">
              <h3 className="font-bold text-slate-900 dark:text-slate-100">Editar «{edicion.item.clave}»</h3>
              <button type="button" onClick={() => setEdicion(null)} aria-label="Cerrar"><XCircle className="h-6 w-6 text-slate-400" /></button>
            </div>
            <div className="space-y-4 p-6">
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3 text-sm">
                <p className="text-slate-500 dark:text-slate-400">Valor actual</p>
                <p className="font-mono text-base font-semibold text-slate-800 dark:text-slate-100">{edicion.item.valor}</p>
              </div>
              <label className="block text-sm text-slate-600 dark:text-slate-400">
                Nuevo valor
                <input value={edicion.valor} onChange={(e) => setEdicion({ ...edicion, valor: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 p-2.5 font-mono" />
              </label>
              <label className="block text-sm text-slate-600 dark:text-slate-400">
                Descripción
                <input value={edicion.descripcion} onChange={(e) => setEdicion({ ...edicion, descripcion: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 p-2.5" />
              </label>
              <label className="block text-sm text-slate-600 dark:text-slate-400">
                Base legal
                <input value={edicion.baseLegal} onChange={(e) => setEdicion({ ...edicion, baseLegal: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 p-2.5" />
              </label>
              <label className="block text-sm text-slate-600 dark:text-slate-400">
                Motivo del cambio <span className="text-red-500">*</span>
                <textarea
                  rows={2}
                  value={edicion.motivo}
                  onChange={(e) => setEdicion({ ...edicion, motivo: e.target.value })}
                  placeholder="Ej.: Ajuste según acuerdo ministerial publicado el…"
                  className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 p-2.5"
                />
              </label>
              <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
                <input
                  type="checkbox"
                  checked={confirmado}
                  onChange={(e) => setConfirmado(e.target.checked)}
                  className="mt-0.5"
                />
                Entiendo que este cambio afecta los cálculos de planilla futuros y quedará registrado en auditoría con mi usuario.
              </label>
              {errorEdicion && <p className="text-sm text-red-600 dark:text-red-400">{errorEdicion}</p>}
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setEdicion(null)} className="rounded-lg px-4 py-2 text-slate-600 dark:text-slate-400">Cancelar</button>
                <button
                  type="button"
                  onClick={guardarEdicion}
                  disabled={procesando || !confirmado || edicion.motivo.trim().length < 10}
                  className="flex items-center rounded-lg bg-brand-blue px-4 py-2 font-medium text-white hover:bg-brand-DEFAULT disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {procesando && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Confirmar cambio
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
