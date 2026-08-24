import { useState, useEffect } from 'react';
import api from '../services/api';
import { Receipt, Plus, Edit, Trash2, XCircle } from 'lucide-react';

export default function AdminPayroll() {
  const [payrolls, setPayrolls] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPayroll, setEditingPayroll] = useState(null);
  const [formData, setFormData] = useState({
    empleado_id: '', periodo: '', salario_bruto: '', deducciones: '', fecha_pago: ''
  });
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchPayrolls();
    fetchEmployees();
  }, []);

  const fetchPayrolls = async () => {
    try {
      const res = await api.get('/admin/payroll');
      setPayrolls(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await api.get('/admin/employees');
      setEmployees(res.data.filter(e => e.usuario?.activo));
    } catch (error) { console.error(error); }
  };

  const resetForm = () => {
    setFormData({ empleado_id: '', periodo: '', salario_bruto: '', deducciones: '', fecha_pago: '' });
    setEditingPayroll(null);
  };

  const openEditModal = (p) => {
    setEditingPayroll(p);
    setFormData({
      empleado_id: p.empleado_id?.toString() || '',
      periodo: p.periodo || '',
      salario_bruto: p.salario_bruto?.toString() || '',
      deducciones: p.deducciones?.toString() || '',
      fecha_pago: p.fecha_pago ? p.fecha_pago.split('T')[0] : ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    try {
      const payload = {
        ...formData,
        empleado_id: Number(formData.empleado_id),
        salario_bruto: Number(formData.salario_bruto),
        deducciones: Number(formData.deducciones)
      };
      if (editingPayroll) {
        await api.put(`/admin/payroll/${editingPayroll.id}`, payload);
        setMessage({ type: 'success', text: 'Nómina actualizada' });
      } else {
        await api.post('/admin/payroll', payload);
        setMessage({ type: 'success', text: 'Nómina creada exitosamente' });
      }
      setShowModal(false);
      resetForm();
      fetchPayrolls();
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Error al guardar' });
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Estás seguro de eliminar este registro de nómina?')) return;
    try {
      await api.delete(`/admin/payroll/${id}`);
      fetchPayrolls();
      setMessage({ type: 'success', text: 'Registro eliminado' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al eliminar' });
    }
  };

  const salarioNeto = Number(formData.salario_bruto || 0) - Number(formData.deducciones || 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestión de Nómina</h1>
          <p className="text-slate-500 mt-1">Administra los recibos de pago de los empleados</p>
        </div>
        <button onClick={() => { resetForm(); setShowModal(true); }} className="flex items-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors">
          <Plus className="w-5 h-5 mr-1" /> Nuevo Recibo
        </button>
      </div>

      {message.text && (
        <div className={`p-4 rounded-lg text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

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
                  <th className="px-6 py-4">Período</th>
                  <th className="px-6 py-4 text-right">Salario Bruto</th>
                  <th className="px-6 py-4 text-right">Deducciones</th>
                  <th className="px-6 py-4 text-right">Salario Neto</th>
                  <th className="px-6 py-4">Fecha Pago</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {payrolls.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {p.empleado?.nombres} {p.empleado?.apellidos}
                    </td>
                    <td className="px-6 py-4">{p.periodo}</td>
                    <td className="px-6 py-4 text-right font-mono">L {Number(p.salario_bruto).toLocaleString('es-HN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-6 py-4 text-right font-mono text-red-600">- L {Number(p.deducciones).toLocaleString('es-HN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-6 py-4 text-right font-mono font-semibold text-green-700">L {Number(p.salario_neto).toLocaleString('es-HN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-6 py-4">{p.fecha_pago ? new Date(p.fecha_pago).toLocaleDateString() : '—'}</td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button onClick={() => openEditModal(p)} className="inline-flex items-center p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(p.id)} className="inline-flex items-center p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {payrolls.length === 0 && (
                  <tr><td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                    <Receipt className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    No hay registros de nómina
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-900">{editingPayroll ? 'Editar Nómina' : 'Nuevo Recibo de Nómina'}</h3>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Empleado</label>
                <select required value={formData.empleado_id} onChange={(e) => setFormData({...formData, empleado_id: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-lg">
                  <option value="">Seleccionar empleado...</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.nombres} {e.apellidos}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Período</label>
                  <input type="text" required placeholder="Ej: Agosto 2026" value={formData.periodo} onChange={(e) => setFormData({...formData, periodo: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fecha de Pago</label>
                  <input type="date" required value={formData.fecha_pago} onChange={(e) => setFormData({...formData, fecha_pago: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-lg" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Salario Bruto (L)</label>
                  <input type="number" step="0.01" required value={formData.salario_bruto} onChange={(e) => setFormData({...formData, salario_bruto: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Deducciones (L)</label>
                  <input type="number" step="0.01" required value={formData.deducciones} onChange={(e) => setFormData({...formData, deducciones: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-lg" />
                </div>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg text-center border border-slate-200">
                <p className="text-sm text-slate-500">Salario Neto</p>
                <p className={`text-2xl font-bold ${salarioNeto >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  L {salarioNeto.toLocaleString('es-HN', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="pt-4 flex justify-end space-x-3">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg">Cancelar</button>
                <button type="submit" className="px-5 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700">
                  {editingPayroll ? 'Guardar Cambios' : 'Crear Recibo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
