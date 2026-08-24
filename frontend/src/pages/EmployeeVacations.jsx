import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock, Plus, XCircle } from 'lucide-react';
import api from '../services/api';

const ESTADOS = {
  SOLICITADO: ['bg-slate-100 text-slate-700', 'Solicitado'],
  EN_REVISION: ['bg-orange-100 text-orange-800', 'En revisión'],
  APROBADO: ['bg-green-100 text-green-800', 'Aprobado'],
  RECHAZADO: ['bg-red-100 text-red-800', 'Rechazado'],
  CANCELADO: ['bg-slate-100 text-slate-500', 'Cancelado'],
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

  return (
    <div className="animate-in fade-in duration-500 space-y-6">
      <div className="flex items-end justify-between">
        <div><h1 className="text-2xl font-bold text-slate-900">Mis vacaciones</h1><p className="mt-1 text-slate-500">Consulta tu saldo y solicita fechas de descanso.</p></div>
        <button onClick={() => setModal(true)} disabled={!periodos.length} className="flex items-center rounded-lg bg-brand-blue px-4 py-2 font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"><Plus className="mr-1 h-5 w-5" /> Nueva solicitud</button>
      </div>
      {message && <div className="rounded-lg bg-blue-50 p-4 text-sm font-medium text-blue-700">{message}</div>}
      <div className="grid gap-4 md:grid-cols-3">
        {periodos.map((periodo) => <div key={periodo.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Año de servicio {periodo.anioServicio}</p><p className="mt-2 text-3xl font-bold text-slate-900">{periodo.saldo} <span className="text-base font-normal text-slate-500">días disponibles</span></p><p className="mt-2 text-xs text-slate-500">Derecho: {periodo.diasDerecho} · Gozados: {periodo.diasGozados}</p></div>)}
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4"><h2 className="font-semibold text-slate-900">Historial de solicitudes</h2></div>
        {!solicitudes.length ? <div className="p-12 text-center text-slate-500"><CalendarDays className="mx-auto mb-3 h-10 w-10 text-slate-300" />No tienes solicitudes registradas.</div> : <div className="overflow-x-auto"><table className="w-full text-left text-sm text-slate-600"><thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-6 py-4">Folio</th><th className="px-6 py-4">Fechas</th><th className="px-6 py-4">Días</th><th className="px-6 py-4">Estado</th><th className="px-6 py-4">Acciones</th></tr></thead><tbody>{solicitudes.map((solicitud) => { const [clases, etiqueta] = ESTADOS[solicitud.estado] || ESTADOS.SOLICITADO; return <tr key={solicitud.id} className="border-b border-slate-100"><td className="px-6 py-4 font-medium text-slate-900">{solicitud.folio}</td><td className="px-6 py-4 text-xs">{new Date(solicitud.fechaInicio).toLocaleDateString()} — {new Date(solicitud.fechaFin).toLocaleDateString()}</td><td className="px-6 py-4">{solicitud.diasHabiles}</td><td className="px-6 py-4"><span className={`${clases} rounded-full px-2.5 py-0.5 text-xs font-medium`}>{etiqueta}</span></td><td className="px-6 py-4">{solicitud.estado === 'SOLICITADO' && <button onClick={() => cancelar(solicitud.id)} className="text-xs font-medium text-red-600">Cancelar</button>}{solicitud.estado === 'EN_REVISION' && <Clock className="h-4 w-4 text-orange-500" />}{solicitud.estado === 'APROBADO' && <CheckCircle2 className="h-4 w-4 text-green-500" />}</td></tr>; })}</tbody></table></div>}
      </div>
      {modal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"><div className="w-full max-w-md rounded-xl bg-white shadow-xl"><div className="flex items-center justify-between border-b border-slate-100 px-6 py-4"><h3 className="font-bold text-slate-900">Nueva solicitud</h3><button onClick={() => setModal(false)} aria-label="Cerrar"><XCircle className="h-6 w-6 text-slate-400" /></button></div><form onSubmit={enviar} className="space-y-4 p-6"><label className="block text-sm font-medium text-slate-700">Periodo<select required value={form.periodoId} onChange={(event) => setForm({ ...form, periodoId: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5">{periodos.map((periodo) => <option key={periodo.id} value={periodo.id}>Año {periodo.anioServicio} — {periodo.saldo} días</option>)}</select></label><div className="grid grid-cols-2 gap-4"><label className="block text-sm font-medium text-slate-700">Desde<input required type="date" value={form.fechaInicio} onChange={(event) => setForm({ ...form, fechaInicio: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" /></label><label className="block text-sm font-medium text-slate-700">Hasta<input required type="date" value={form.fechaFin} onChange={(event) => setForm({ ...form, fechaFin: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" /></label></div><label className="block text-sm font-medium text-slate-700">ID del suplente (opcional)<input type="number" min="1" value={form.suplenteId} onChange={(event) => setForm({ ...form, suplenteId: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" /></label><div className="flex justify-end gap-3"><button type="button" onClick={() => setModal(false)} className="rounded-lg px-4 py-2 font-medium text-slate-600 hover:bg-slate-100">Cancelar</button><button type="submit" className="rounded-lg bg-brand-blue px-4 py-2 font-medium text-white hover:bg-blue-700">Enviar</button></div></form></div></div>}
    </div>
  );
}
