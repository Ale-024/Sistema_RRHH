import { useState, useEffect } from 'react';
import api from '../services/api';
import { Calendar, Plus, Clock, CheckCircle2, XCircle } from 'lucide-react';

export default function EmployeeRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    tipo: 'VACACIONES',
    fecha_inicio: '',
    fecha_fin: '',
    motivo: ''
  });

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const res = await api.get('/employee/requests');
      setRequests(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/employee/requests', formData);
      setShowModal(false);
      setFormData({ tipo: 'VACACIONES', fecha_inicio: '', fecha_fin: '', motivo: '' });
      fetchRequests();
    } catch (error) {
      alert('Error al crear solicitud');
    }
  };

  const getStatusIcon = (estado) => {
    switch (estado) {
      case 'APROBADA': return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'RECHAZADA': return <XCircle className="w-5 h-5 text-red-500" />;
      default: return <Clock className="w-5 h-5 text-orange-500" />;
    }
  };

  const getStatusBadge = (estado) => {
    switch (estado) {
      case 'APROBADA': return <span className="bg-green-100 text-green-800 text-xs px-2.5 py-0.5 rounded-full font-medium">Aprobada</span>;
      case 'RECHAZADA': return <span className="bg-red-100 text-red-800 text-xs px-2.5 py-0.5 rounded-full font-medium">Rechazada</span>;
      default: return <span className="bg-orange-100 text-orange-800 text-xs px-2.5 py-0.5 rounded-full font-medium">Pendiente</span>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mis Solicitudes</h1>
          <p className="text-slate-500 mt-1">Gestiona tus vacaciones y permisos especiales</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center px-4 py-2 bg-brand-blue hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors"
        >
          <Plus className="w-5 h-5 mr-1" /> Nueva Solicitud
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Cargando...</div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <Calendar className="w-12 h-12 text-slate-300 mb-4" />
            <p className="text-slate-500 text-lg">No tienes solicitudes registradas.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-600">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Tipo</th>
                  <th className="px-6 py-4">Fechas</th>
                  <th className="px-6 py-4">Motivo</th>
                  <th className="px-6 py-4">Fecha Solicitud</th>
                  <th className="px-6 py-4">Estado</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => (
                  <tr key={req.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">{req.tipo}</td>
                    <td className="px-6 py-4">
                      {new Date(req.fecha_inicio).toLocaleDateString()} al {new Date(req.fecha_fin).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 truncate max-w-xs">{req.motivo}</td>
                    <td className="px-6 py-4">{new Date(req.fecha_solicitud).toLocaleDateString()}</td>
                    <td className="px-6 py-4 flex items-center space-x-2">
                      {getStatusIcon(req.estado)}
                      {getStatusBadge(req.estado)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Nueva Solicitud */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-900">Nueva Solicitud</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Solicitud</label>
                <select
                  value={formData.tipo}
                  onChange={(e) => setFormData({...formData, tipo: e.target.value})}
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-brand-blue"
                >
                  <option value="VACACIONES">Vacaciones</option>
                  <option value="PERMISO">Permiso Especial</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Desde</label>
                  <input
                    type="date"
                    required
                    value={formData.fecha_inicio}
                    onChange={(e) => setFormData({...formData, fecha_inicio: e.target.value})}
                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-brand-blue"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Hasta</label>
                  <input
                    type="date"
                    required
                    value={formData.fecha_fin}
                    onChange={(e) => setFormData({...formData, fecha_fin: e.target.value})}
                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-brand-blue"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Motivo / Descripción</label>
                <textarea
                  required
                  rows="3"
                  value={formData.motivo}
                  onChange={(e) => setFormData({...formData, motivo: e.target.value})}
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-brand-blue"
                  placeholder="Detalla el motivo de tu solicitud..."
                ></textarea>
              </div>
              <div className="pt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-blue text-white font-medium rounded-lg hover:bg-blue-700"
                >
                  Enviar Solicitud
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
