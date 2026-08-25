import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import { Calendar, CheckCircle2, Clock, FileEdit, Plus, XCircle } from 'lucide-react';

const ESTADOS = {
  SOLICITADO: ['bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300', 'Solicitado'],
  EN_REVISION: ['bg-orange-100 text-orange-800', 'En revisión'],
  APROBADO: ['bg-green-100 text-green-800 dark:text-emerald-300', 'Aprobado'],
  RECHAZADO: ['bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-300', 'Rechazado'],
  CANCELADO: ['bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400', 'Cancelado'],
};

const inicial = { id: null, tipoPermisoId: '', fechaInicio: '', fechaFin: '', motivo: '', soporteRuta: '' };

const getReturnReason = (request) => {
    if (request.estado !== 'SOLICITADO' || !request.historial) return null;
    const devuelto = [...request.historial].reverse().find(
      (h) => h.estadoAnterior === 'EN_REVISION' && h.estadoNuevo === 'SOLICITADO'
    );
    return devuelto?.motivo || null;
  };

  // Motivo del rechazo: ultima transicion a RECHAZADO en el historial.
  const getRechazoMotivo = (request) => {
    if (request.estado !== 'RECHAZADO' || !request.historial) return null;
    const rechazo = [...request.historial].reverse().find((h) => h.estadoNuevo === 'RECHAZADO');
    return rechazo?.motivo || request.observacionRevision || null;
};

export default function EmployeeRequests() {
  const [requests, setRequests] = useState([]);
  const [types, setTypes] = useState([]);
  const [formData, setFormData] = useState(inicial);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [message, setMessage] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [requestsResponse, typesResponse] = await Promise.all([
        api.get('/employee/requests'),
        api.get('/employee/requests/types'),
      ]);
      setRequests(requestsResponse.data);
      setTypes(typesResponse.data);
      if (!formData.tipoPermisoId && typesResponse.data[0]) {
        setFormData((current) => ({ ...current, tipoPermisoId: String(typesResponse.data[0].id) }));
      }
    } catch {
      setMessage('No fue posible cargar el catálogo de permisos.');
    } finally {
      setLoading(false);
    }
  }, [formData.tipoPermisoId]);

  useEffect(() => {
    // La carga inicial actualiza estado despues del await; es intencional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const [guardando, setGuardando] = useState(false);
  const handleSubmit = async (event) => {
    event.preventDefault();
    setGuardando(true);
    try {
      const payload = {
        ...formData,
        tipoPermisoId: Number(formData.tipoPermisoId),
      };
      if (formData.id) {
        await api.put(`/employee/requests/${formData.id}`, payload);
        setShowModal(false);
        setFormData({ ...inicial, tipoPermisoId: formData.tipoPermisoId });
        setMessage('Solicitud actualizada correctamente.');
      } else {
        const created = await api.post('/employee/requests', payload);
        await api.post(`/employee/requests/${created.data.data.id}/enviar`, {});
        setShowModal(false);
        setFormData({ ...inicial, tipoPermisoId: formData.tipoPermisoId });
        setMessage('Solicitud enviada a revisión.');
      }
      fetchData();
    } catch (error) {
      setMessage(error.response?.data?.detail || 'No fue posible guardar la solicitud.');
    } finally {
      setGuardando(false);
    }
  };

  const handleSend = async (id) => {
    try {
      await api.post(`/employee/requests/${id}/enviar`, {});
      setMessage('Solicitud reenviada a revisión.');
      fetchData();
    } catch (error) {
      setMessage(error.response?.data?.detail || 'No fue posible reenviar la solicitud.');
    }
  };

  const openEditModal = (request) => {
    setFormData({
      id: request.id,
      tipoPermisoId: String(request.tipoPermisoId),
      fechaInicio: request.fechaInicio.slice(0, 10),
      fechaFin: request.fechaFin.slice(0, 10),
      motivo: request.motivo,
      soporteRuta: request.soporteRuta || '',
    });
    setShowModal(true);
  };

  const handleCancel = async (id) => {
    try {
      await api.post(`/employee/requests/${id}/cancelar`, {});
      setMessage('Solicitud cancelada.');
      fetchData();
    } catch (error) {
      setMessage(error.response?.data?.detail || 'No fue posible cancelar la solicitud.');
    }
  };

  const status = (estado) => {
    const [classes, label] = ESTADOS[estado] || ESTADOS.SOLICITADO;
    return <span className={`${classes} rounded-full px-2.5 py-0.5 text-xs font-medium`}>{label}</span>;
  };

  return (
    <div className="animate-in fade-in duration-500 space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Mis permisos</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">Solicita permisos especiales y consulta su seguimiento.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          disabled={!types.length}
          className="flex items-center rounded-lg bg-brand-blue px-4 py-2 font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="mr-1 h-5 w-5" /> Nuevo permiso
        </button>
      </div>

      {message && <div className="rounded-lg bg-blue-50 dark:bg-blue-500/10 p-4 text-sm font-medium text-blue-700 dark:text-blue-400">{message}</div>}

      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">Cargando...</div>
        ) : !requests.length ? (
          <div className="flex flex-col items-center p-12 text-center">
            <Calendar className="mb-4 h-12 w-12 text-slate-300" />
            <p className="text-lg text-slate-500 dark:text-slate-400">No tienes permisos registrados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
              <thead className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs uppercase text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-4">Folio</th>
                  <th className="px-6 py-4">Tipo</th>
                  <th className="px-6 py-4">Fechas</th>
                  <th className="px-6 py-4">Motivo</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.id} className="border-b border-slate-100 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">{request.folio}</td>
                    <td className="px-6 py-4">{request.tipoPermiso?.nombre || request.tipoPermiso?.codigo}</td>
                    <td className="px-6 py-4 text-xs">
                      {new Date(request.fechaInicio).toLocaleDateString()} — {new Date(request.fechaFin).toLocaleDateString()}
                    </td>
                    <td className="max-w-xs px-6 py-4">
                      <div className="truncate">{request.motivo}</div>
                      {getReturnReason(request) && (
                        <div className="mt-1 text-xs font-medium text-orange-600">Devuelto: {getReturnReason(request)}</div>
                      )}
                      {getRechazoMotivo(request) && (
                        <div className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">Motivo del rechazo: {getRechazoMotivo(request)}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">{status(request.estado)}</td>
                    <td className="px-6 py-4">
                      {request.estado === 'SOLICITADO' && (
                        <div className="flex flex-col gap-1">
                          <div className="flex flex-wrap gap-2">
                            <button onClick={() => handleSend(request.id)} className="text-xs font-medium text-green-600 hover:text-green-800">
                              Reenviar
                            </button>
                            <button onClick={() => openEditModal(request)} className="text-xs font-medium text-blue-600 hover:text-blue-800">
                              Editar
                            </button>
                            <button onClick={() => handleCancel(request.id)} className="text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-800">
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                      {request.estado === 'EN_REVISION' && <Clock className="h-4 w-4 text-orange-500" />}
                      {request.estado === 'APROBADO' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                      {request.estado === 'RECHAZADO' && <FileEdit className="h-4 w-4 text-red-500" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-xl bg-white dark:bg-slate-800 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/60 px-6 py-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{formData.id ? 'Editar permiso' : 'Nuevo permiso'}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600" aria-label="Cerrar">
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 p-6">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Tipo de permiso
                <select required value={formData.tipoPermisoId} onChange={(event) => setFormData({ ...formData, tipoPermisoId: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 p-2.5">
                  {types.map((type) => <option key={type.id} value={type.id}>{type.nombre}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Desde<input required type="date" value={formData.fechaInicio} onChange={(event) => setFormData({ ...formData, fechaInicio: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 p-2.5" /></label>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Hasta<input required type="date" value={formData.fechaFin} onChange={(event) => setFormData({ ...formData, fechaFin: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 p-2.5" /></label>
              </div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Motivo<textarea required rows="3" value={formData.motivo} onChange={(event) => setFormData({ ...formData, motivo: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 p-2.5" /></label>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Ruta del soporte (si aplica)<input value={formData.soporteRuta} onChange={(event) => setFormData({ ...formData, soporteRuta: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 p-2.5" /></label>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="rounded-lg px-4 py-2 font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">Cancelar</button>
                <button type="submit" disabled={guardando} className="rounded-lg bg-brand-blue px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">{guardando ? 'Guardando…' : formData.id ? 'Guardar cambios' : 'Enviar solicitud'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
