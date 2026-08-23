import { useState, useEffect } from 'react';
import api from '../services/api';
import { FileText, CheckCircle2, XCircle, Clock } from 'lucide-react';

export default function AdminRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('TODOS');
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const res = await api.get('/admin/requests');
      setRequests(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id, estado) => {
    try {
      await api.put(`/admin/requests/${id}/status`, { estado });
      setMessage({ type: 'success', text: `Solicitud ${estado.toLowerCase()} exitosamente` });
      fetchRequests();
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al actualizar solicitud' });
    }
  };

  const getStatusBadge = (estado) => {
    switch (estado) {
      case 'APROBADA': return <span className="bg-green-100 text-green-800 text-xs px-2.5 py-0.5 rounded-full font-medium">Aprobada</span>;
      case 'RECHAZADA': return <span className="bg-red-100 text-red-800 text-xs px-2.5 py-0.5 rounded-full font-medium">Rechazada</span>;
      default: return <span className="bg-orange-100 text-orange-800 text-xs px-2.5 py-0.5 rounded-full font-medium">Pendiente</span>;
    }
  };

  const filtered = filter === 'TODOS' ? requests : requests.filter(r => r.estado === filter);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Gestión de Solicitudes</h1>
        <p className="text-slate-500 mt-1">Aprueba o rechaza solicitudes de vacaciones y permisos</p>
      </div>

      {message.text && (
        <div className={`p-4 rounded-lg text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex space-x-2 border-b border-slate-200 pb-0">
        {['TODOS', 'PENDIENTE', 'APROBADA', 'RECHAZADA'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              filter === status
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {status === 'TODOS' ? 'Todas' : status.charAt(0) + status.slice(1).toLowerCase()}
            {status === 'PENDIENTE' && (
              <span className="ml-1.5 bg-orange-100 text-orange-700 text-xs px-1.5 py-0.5 rounded-full">
                {requests.filter(r => r.estado === 'PENDIENTE').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Cargando...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-600">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Empleado</th>
                  <th className="px-6 py-4">Tipo</th>
                  <th className="px-6 py-4">Fechas</th>
                  <th className="px-6 py-4">Motivo</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((req) => (
                  <tr key={req.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {req.empleado?.nombres} {req.empleado?.apellidos}
                    </td>
                    <td className="px-6 py-4">{req.tipo}</td>
                    <td className="px-6 py-4 text-xs">
                      {new Date(req.fecha_inicio).toLocaleDateString()} — {new Date(req.fecha_fin).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 min-w-[200px] whitespace-pre-wrap">{req.motivo}</td>
                    <td className="px-6 py-4">{getStatusBadge(req.estado)}</td>
                    <td className="px-6 py-4 text-right">
                      {req.estado === 'PENDIENTE' ? (
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => handleUpdateStatus(req.id, 'APROBADA')}
                            className="inline-flex items-center px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-xs font-medium transition-colors"
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1" /> Aprobar
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(req.id, 'RECHAZADA')}
                            className="inline-flex items-center px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-xs font-medium transition-colors"
                          >
                            <XCircle className="w-4 h-4 mr-1" /> Rechazar
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan="6" className="px-6 py-12 text-center text-slate-400">
                    <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    No hay solicitudes
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
