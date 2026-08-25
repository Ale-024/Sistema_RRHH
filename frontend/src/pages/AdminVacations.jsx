import { useEffect, useState } from 'react';
import { CalendarDays, FileText, MessageSquareReply, XCircle, CheckCircle2 } from 'lucide-react';
import api from '../services/api';
import ModalMotivo from '../components/ModalMotivo';
import { useAuthStore } from '../store/useAuthStore';
import { tienePermiso } from '../shared/roles';

const estados = { SOLICITADO: 'Solicitado', EN_REVISION: 'En revisión', APROBADO: 'Aprobado', RECHAZADO: 'Rechazado', CANCELADO: 'Cancelado' };
const filtros = [['TODOS', 'Todas'], ['EN_REVISION', 'En revisión'], ['SOLICITADO', 'Solicitado'], ['APROBADO', 'Aprobado'], ['RECHAZADO', 'Rechazado']];

export default function AdminVacations() {
  const { user } = useAuthStore();
  const puedeAprobar = tienePermiso(user, 'vacaciones:aprobar');
  const [items, setItems] = useState([]); const [filtro, setFiltro] = useState('TODOS'); const [mensaje, setMensaje] = useState('');
  const cargar = async () => { try { const respuesta = await api.get('/admin/vacaciones/solicitudes'); setItems(respuesta.data); } catch { setMensaje('No fue posible cargar la bandeja de vacaciones.'); } };
  useEffect(() => {
    // react(set-state-in-effect) es intencional: carga datos remotos al montar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
  }, []);
  const [decision, setDecision] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const confirmar = async (motivo) => {
    setProcesando(true);
    try {
      await api.post(`/admin/vacaciones/solicitudes/${decision.item.id}/${decision.accion}`, motivo ? { motivo } : {});
      setMensaje(`Solicitud ${decision.item.folio} actualizada.`);
      setDecision(null);
      cargar();
    } catch (error) {
      setMensaje(error.response?.data?.detail || 'No fue posible actualizar la solicitud.');
    } finally {
      setProcesando(false);
    }
  };
  const visibles = filtro === 'TODOS' ? items : items.filter((item) => item.estado === filtro);
  return <div className="animate-in fade-in duration-500 space-y-6"><div><h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Bandeja de vacaciones</h1><p className="mt-1 text-slate-500 dark:text-slate-400">Revisa solicitudes dentro de tu alcance departamental.</p></div>{mensaje && <div className="rounded-lg bg-blue-50 dark:bg-blue-500/10 p-4 text-sm font-medium text-blue-700 dark:text-blue-400">{mensaje}</div>}<div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-700">{filtros.map(([valor, etiqueta]) => <button key={valor} onClick={() => setFiltro(valor)} className={`border-b-2 px-4 py-2 text-sm font-medium ${filtro === valor ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 dark:text-slate-400'}`}>{etiqueta}</button>)}</div><div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm"><div className="overflow-x-auto"><table className="w-full text-left text-sm text-slate-600 dark:text-slate-400"><thead className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs uppercase text-slate-500 dark:text-slate-400"><tr><th className="px-6 py-4">Empleado</th><th className="px-6 py-4">Folio</th><th className="px-6 py-4">Fechas / días</th><th className="px-6 py-4">Estado</th><th className="px-6 py-4 text-right">Acciones</th></tr></thead><tbody>{visibles.map((item) => <tr key={item.id} className="border-b border-slate-100 dark:border-slate-700/60"><td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">{item.empleado?.nombres} {item.empleado?.apellidos}</td><td className="px-6 py-4">{item.folio}</td><td className="px-6 py-4 text-xs">{new Date(item.fechaInicio).toLocaleDateString()} — {new Date(item.fechaFin).toLocaleDateString()} ({item.diasHabiles})</td><td className="px-6 py-4"><span className="rounded-full bg-slate-100 dark:bg-slate-700 px-2.5 py-0.5 text-xs font-medium">{estados[item.estado] || item.estado}</span></td><td className="px-6 py-4 text-right">{item.estado === 'EN_REVISION' && puedeAprobar ? <div className="flex justify-end gap-2"><button onClick={() => setDecision({ item, accion: 'solicitar-correccion' })} className="inline-flex items-center rounded-lg bg-amber-50 dark:bg-amber-500/10 px-3 py-1.5 text-xs text-amber-700 dark:text-amber-400"><MessageSquareReply className="mr-1 h-4 w-4" /> Devolver</button><button onClick={() => setDecision({ item, accion: 'aprobar' })} className="inline-flex items-center rounded-lg bg-green-50 dark:bg-emerald-500/10 px-3 py-1.5 text-xs text-green-700 dark:text-emerald-400"><CheckCircle2 className="mr-1 h-4 w-4" /> Aprobar</button><button onClick={() => setDecision({ item, accion: 'rechazar' })} className="inline-flex items-center rounded-lg bg-red-50 dark:bg-red-500/10 px-3 py-1.5 text-xs text-red-700 dark:text-red-400"><XCircle className="mr-1 h-4 w-4" /> Rechazar</button></div> : <span className="text-xs text-slate-400">—</span>}</td></tr>)}{!visibles.length && <tr><td colSpan="5" className="p-12 text-center text-slate-400"><FileText className="mx-auto mb-2 h-10 w-10 text-slate-300" />No hay solicitudes.</td></tr>}</tbody></table></div></div>
  {decision && (
    <ModalMotivo
      titulo={decision.accion === 'aprobar' ? `Aprobar ${decision.item.folio}` : decision.accion === 'rechazar' ? `Rechazar ${decision.item.folio}` : `Devolver ${decision.item.folio} para corrección`}
      etiqueta="Motivo"
      requerido={decision.accion !== 'aprobar'}
      textoBoton={decision.accion === 'aprobar' ? 'Aprobar' : decision.accion === 'rechazar' ? 'Rechazar' : 'Devolver'}
      color={decision.accion === 'aprobar' ? 'green' : decision.accion === 'rechazar' ? 'red' : 'amber'}
      placeholder={decision.accion === 'aprobar' ? 'Observación opcional' : 'Indica el motivo'}
      procesando={procesando}
      onConfirm={confirmar}
      onCerrar={() => setDecision(null)}
    />
  )}
  </div>;
}
