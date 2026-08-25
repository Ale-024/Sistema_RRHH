import { useEffect, useState } from 'react';
import api from '../services/api';
import { CheckCircle2, FileText, MessageSquareReply, XCircle } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { tienePermiso } from '../shared/roles';

const filtros = [
  ['TODOS', 'Todas'],
  ['EN_REVISION', 'En revisión'],
  ['SOLICITADO', 'Solicitado'],
  ['APROBADO', 'Aprobado'],
  ['RECHAZADO', 'Rechazado'],
];

const etiquetas = {
  SOLICITADO: 'Solicitado',
  EN_REVISION: 'En revisión',
  APROBADO: 'Aprobado',
  RECHAZADO: 'Rechazado',
  CANCELADO: 'Cancelado',
};

function estadoBadge(estado) {
  const colores = {
    SOLICITADO: 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300',
    EN_REVISION: 'bg-orange-100 text-orange-800',
    APROBADO: 'bg-green-100 text-green-800 dark:text-emerald-300',
    RECHAZADO: 'bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-300',
    CANCELADO: 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400',
  };
  return <span className={`${colores[estado] || colores.SOLICITADO} rounded-full px-2.5 py-0.5 text-xs font-medium`}>{etiquetas[estado] || estado}</span>;
}

export default function AdminRequests() {
  const { user } = useAuthStore();
  const puedeAprobar = tienePermiso(user, 'permisos:aprobar');
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState('TODOS');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  const fetchRequests = async () => {
    try {
      const response = await api.get('/admin/requests');
      setRequests(response.data);
    } catch {
      setMessage({ type: 'error', text: 'No fue posible cargar la bandeja de permisos.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // La carga inicial actualiza estado despues del await; es intencional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRequests();
  }, []);

  const updateRequest = async (request, action) => {
    const motivo = action === 'rechazar' || action === 'solicitar-correccion'
      ? window.prompt(action === 'rechazar' ? 'Motivo del rechazo:' : 'Observación para la corrección:')
      : window.prompt('Observación (opcional):') || undefined;
    if ((action === 'rechazar' || action === 'solicitar-correccion') && !motivo) return;
    try {
      await api.post(`/admin/requests/${request.id}/${action}`, motivo ? { motivo } : {});
      setMessage({ type: 'success', text: `Solicitud ${request.folio} actualizada.` });
      fetchRequests();
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.detail || 'No fue posible actualizar la solicitud.' });
    }
  };

  const filtered = filter === 'TODOS' ? requests : requests.filter((request) => request.estado === filter);

  return (
    <div className="animate-in fade-in duration-500 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Bandeja de permisos</h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">Revisa, devuelve, aprueba o rechaza solicitudes dentro de tu alcance.</p>
      </div>

      {message.text && <div className={`${message.type === 'success' ? 'bg-green-50 dark:bg-emerald-500/10 text-green-700 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400'} rounded-lg p-4 text-sm font-medium`}>{message.text}</div>}

      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-700 pb-0">
        {filtros.map(([value, label]) => (
          <button key={value} onClick={() => setFilter(value)} className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${filter === value ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}>
            {label}
            {value === 'EN_REVISION' && <span className="ml-1.5 rounded-full bg-orange-100 px-1.5 py-0.5 text-xs text-orange-700">{requests.filter((request) => request.estado === value).length}</span>}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
        {loading ? <div className="p-8 text-center text-slate-500 dark:text-slate-400">Cargando...</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
              <thead className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs uppercase text-slate-500 dark:text-slate-400">
                <tr><th className="px-6 py-4">Empleado</th><th className="px-6 py-4">Folio / tipo</th><th className="px-6 py-4">Fechas</th><th className="px-6 py-4">Motivo</th><th className="px-6 py-4">Estado</th><th className="px-6 py-4 text-right">Acciones</th></tr>
              </thead>
              <tbody>
                {filtered.map((request) => (
                  <tr key={request.id} className="border-b border-slate-100 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">{request.empleado?.nombres} {request.empleado?.apellidos}</td>
                    <td className="px-6 py-4"><div className="font-medium text-slate-900 dark:text-slate-100">{request.folio}</div><div className="text-xs text-slate-500 dark:text-slate-400">{request.tipoPermiso?.nombre}</div></td>
                    <td className="px-6 py-4 text-xs">{new Date(request.fechaInicio).toLocaleDateString()} — {new Date(request.fechaFin).toLocaleDateString()}</td>
                    <td className="min-w-[210px] whitespace-pre-wrap px-6 py-4">{request.motivo}</td>
                    <td className="px-6 py-4">{estadoBadge(request.estado)}</td>
                    <td className="px-6 py-4 text-right">
                      {request.estado === 'EN_REVISION' && puedeAprobar ? (
                        <div className="flex justify-end gap-2">
                          <button onClick={() => updateRequest(request, 'solicitar-correccion')} className="inline-flex items-center rounded-lg bg-amber-50 dark:bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-100"><MessageSquareReply className="mr-1 h-4 w-4" /> Devolver</button>
                          <button onClick={() => updateRequest(request, 'aprobar')} className="inline-flex items-center rounded-lg bg-green-50 dark:bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-green-700 dark:text-emerald-400 hover:bg-green-100"><CheckCircle2 className="mr-1 h-4 w-4" /> Aprobar</button>
                          <button onClick={() => updateRequest(request, 'rechazar')} className="inline-flex items-center rounded-lg bg-red-50 dark:bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-400 hover:bg-red-100"><XCircle className="mr-1 h-4 w-4" /> Rechazar</button>
                        </div>
                      ) : <span className="text-xs text-slate-400">—</span>}
                    </td>
                  </tr>
                ))}
                {!filtered.length && <tr><td colSpan="6" className="p-12 text-center text-slate-400"><FileText className="mx-auto mb-2 h-10 w-10 text-slate-300" />No hay solicitudes en este filtro.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
