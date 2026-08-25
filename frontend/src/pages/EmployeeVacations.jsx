import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock, Plus, XCircle } from 'lucide-react';
import api from '../services/api';

const ESTADOS = {
  SOLICITADO: ['bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300', 'Solicitado'],
  EN_REVISION: ['bg-orange-100 text-orange-800', 'En revisión'],
  APROBADO: ['bg-green-100 text-green-800 dark:text-emerald-300', 'Aprobado'],
  RECHAZADO: ['bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-300', 'Rechazado'],
  CANCELADO: ['bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400', 'Cancelado'],
};

const getReturnReason = (request) => {
if (request.estado !== 'SOLICITADO' || !request.historial) return null;
const devuelto = [...request.historial].reverse().find(
(h) => h.estadoAnterior === 'EN_REVISION' && h.estadoNuevo === 'SOLICITADO'
);
return devuelto?.motivo || null;
};
const getRechazoMotivo = (request) => {
if (request.estado !== 'RECHAZADO' || !request.historial) return null;
const rechazo = [...request.historial].reverse().find((h) => h.estadoNuevo === 'RECHAZADO');
return rechazo?.motivo || null;
};

export default function EmployeeVacations() {
  const [periodos, setPeriodos] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [form, setForm] = useState({ periodoId: '', fechaInicio: '', fechaFin: '', suplenteId: '' });
  const [modal, setModal] = useState(false);
  const [message, setMessage] = useState('');

  const cargar = useCallback(async () => {
    try {
      const [saldos, lista] = await Promise.all([api.get('/employee/vacaciones/saldos'), api.get('/employee/vacaciones/solicitudes')]);
      setPeriodos(saldos.data);
      setSolicitudes(lista.data);
      if (!form.periodoId && saldos.data[0]) setForm((actual) => ({ ...actual, periodoId: String(saldos.data[0].id) }));
    } catch { setMessage('No fue posible cargar tus vacaciones.'); }
  }, [form.periodoId]);

  useEffect(() => {
    // react(set-state-in-effect) es intencional: carga datos remotos al montar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
  }, [cargar]);

  const enviar = async (event) => {
    event.preventDefault();
    try {
      const creada = await api.post('/employee/vacaciones/solicitudes', { ...form, periodoId: Number(form.periodoId), ...(form.suplenteId ? { suplenteId: Number(form.suplenteId) } : {}) });
      await api.post(`/employee/vacaciones/solicitudes/${creada.data.data.id}/enviar`, {});
      setModal(false);
      setMessage('Solicitud de vacaciones enviada a revisión.');
      await cargar();
    } catch (error) { setMessage(error.response?.data?.detail || 'No fue posible enviar la solicitud.'); }
  };

  const cancelar = async (id) => {
    try { await api.post(`/employee/vacaciones/solicitudes/${id}/cancelar`, {}); setMessage('Solicitud cancelada.'); await cargar(); }
    catch (error) { setMessage(error.response?.data?.detail || 'No fue posible cancelar la solicitud.'); }
  };

  const handleSend = async (id) => {
    try {
      await api.post(`/employee/vacaciones/solicitudes/${id}/enviar`, {});
      setMessage('Solicitud reenviada a revisión.');
      await cargar();
    } catch (error) {
      setMessage(error.response?.data?.detail || 'No fue posible reenviar la solicitud.');
    }
  };

  const periodoSeleccionado = periodos.find((periodo) => String(periodo.id) === form.periodoId);

  return (
    <div className="animate-in fade-in duration-500 space-y-6">
      <div className="flex items-end justify-between">
        <div><h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Mis vacaciones</h1><p className="mt-1 text-slate-500 dark:text-slate-400">Consulta tu saldo y solicita fechas de descanso.</p></div>
        <button onClick={() => setModal(true)} disabled={!periodos.length} className="flex items-center rounded-lg bg-brand-blue px-4 py-2 font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"><Plus className="mr-1 h-5 w-5" /> Nueva solicitud</button>
      </div>
      {message && <div className="rounded-lg bg-blue-50 dark:bg-blue-500/10 p-4 text-sm font-medium text-blue-700 dark:text-blue-400">{message}</div>}
      <div className="grid gap-4 md:grid-cols-3">
        {periodos.map((periodo) => <div key={periodo.id} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm"><p className="text-sm text-slate-500 dark:text-slate-400">Año de servicio {periodo.anioServicio}</p><p className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">{periodo.saldo} <span className="text-base font-normal text-slate-500 dark:text-slate-400">días disponibles</span></p><p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Derecho: {periodo.diasDerecho} · Gozados: {periodo.diasGozados}</p></div>)}
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
        <div className="border-b border-slate-100 dark:border-slate-700/60 px-6 py-4"><h2 className="font-semibold text-slate-900 dark:text-slate-100">Historial de solicitudes</h2></div>
        {!solicitudes.length ? <div className="p-12 text-center text-slate-500 dark:text-slate-400"><CalendarDays className="mx-auto mb-3 h-10 w-10 text-slate-300" />No tienes solicitudes registradas.</div> : <div className="overflow-x-auto"><table className="w-full text-left text-sm text-slate-600 dark:text-slate-400"><thead className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs uppercase text-slate-500 dark:text-slate-400"><tr><th className="px-6 py-4">Folio</th><th className="px-6 py-4">Fechas</th><th className="px-6 py-4">Días</th><th className="px-6 py-4">Estado</th><th className="px-6 py-4">Acciones</th></tr></thead><tbody>{solicitudes.map((solicitud) => { 
          const [clases, etiqueta] = ESTADOS[solicitud.estado] || ESTADOS.SOLICITADO;

          return (
            <tr key={solicitud.id} className="border-b border-slate-100 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-700/50">
              <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                <div className="truncate">{solicitud.folio}</div>
                {getReturnReason(solicitud) && (
                  <div className="mt-1 text-xs font-medium text-orange-600">Devuelto: {getReturnReason(solicitud)}</div>
                )}
                {getRechazoMotivo(solicitud) && (
                  <div className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">Motivo del rechazo: {getRechazoMotivo(solicitud)}</div>
                )}
              </td>
              <td className="px-6 py-4 text-xs">{new Date(solicitud.fechaInicio).toLocaleDateString()} — {new Date(solicitud.fechaFin).toLocaleDateString()}</td>
              <td className="px-6 py-4">{solicitud.diasHabiles}</td>
              <td className="px-6 py-4"><span className={`${clases} rounded-full px-2.5 py-0.5 text-xs font-medium`}>{etiqueta}</span></td>
              <td className="px-6 py-4">
                {solicitud.estado === 'SOLICITADO' && (
                  <div className="flex gap-2">
                    <button onClick={() => handleSend(solicitud.id)} className="text-xs font-medium text-green-600 hover:text-green-800">Reenviar</button>
                    <button onClick={() => cancelar(solicitud.id)} className="text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-800">Cancelar</button>
                  </div>
                )}
                {solicitud.estado === 'EN_REVISION' && <Clock className="h-4 w-4 text-orange-500" />}
                {solicitud.estado === 'APROBADO' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
              </td>
            </tr>
          ); 
        })}</tbody></table></div>}
      </div>
      {modal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"><div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-800 shadow-xl"><div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 px-6 py-4"><h3 className="font-bold text-slate-900 dark:text-slate-100">Nueva solicitud</h3><button onClick={() => setModal(false)} aria-label="Cerrar"><XCircle className="h-6 w-6 text-slate-400" /></button></div><form onSubmit={enviar} className="space-y-4 p-6"><label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Periodo<select required value={form.periodoId} onChange={(event) => setForm({ ...form, periodoId: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 p-2.5">{periodos.map((periodo) => <option key={periodo.id} value={periodo.id}>Año {periodo.anioServicio} — {periodo.saldo} días (del {new Date(periodo.desde).toLocaleDateString()} al {new Date(periodo.hasta).toLocaleDateString()})</option>)}</select><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Las fechas deben caer dentro de la ventana del periodo seleccionado.</p></label><div className="grid grid-cols-2 gap-4"><label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Desde<input required type="date" value={form.fechaInicio} min={periodoSeleccionado ? periodoSeleccionado.desde.slice(0, 10) : undefined} max={periodoSeleccionado ? periodoSeleccionado.hasta.slice(0, 10) : undefined} onChange={(event) => setForm({ ...form, fechaInicio: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 p-2.5" /></label><label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Hasta<input required type="date" value={form.fechaFin} min={form.fechaInicio || (periodoSeleccionado ? periodoSeleccionado.desde.slice(0, 10) : undefined)} max={periodoSeleccionado ? periodoSeleccionado.hasta.slice(0, 10) : undefined} onChange={(event) => setForm({ ...form, fechaFin: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 p-2.5" /></label></div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300">ID del suplente (opcional)<input type="number" min="1" value={form.suplenteId} onChange={(event) => setForm({ ...form, suplenteId: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 p-2.5" /></label><div className="flex justify-end gap-3"><button type="button" onClick={() => setModal(false)} className="rounded-lg px-4 py-2 font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">Cancelar</button><button type="submit" className="rounded-lg bg-brand-blue px-4 py-2 font-medium text-white hover:bg-blue-700">Enviar</button></div></form></div></div>}
    </div>
  );
}
