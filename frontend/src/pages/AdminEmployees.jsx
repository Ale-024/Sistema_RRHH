import { useState, useEffect } from 'react';
import api from '../services/api';
import { Plus, Search, UserCheck, UserX, Edit, XCircle } from 'lucide-react';

export default function AdminEmployees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [positions, setPositions] = useState([]);
  const [formData, setFormData] = useState({
    email: '', password: '', nombres: '', apellidos: '',
    dni: '', telefono: '', direccion: '',
    puesto_id: '', fecha_ingreso: '', salario: '',
    modalidad: 'PERMANENTE', periodicidad: 'MENSUAL'
  });
  const [message, setMessage] = useState({ type: '', text: '' });


  const fetchEmployees = async () => {
    try {
      const res = await api.get('/admin/employees');
      setEmployees(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPositions = async () => {
    try {
      const res = await api.get('/admin/positions');
      setPositions(res.data);
    } catch (error) { console.error(error); }
  };

    // La carga inicial actualiza estado solo despues del await; el aviso
    // react(set-state-in-effect) es un falso positivo en este patron.
    // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    // Falso positivo: el estado se actualiza tras el await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchEmployees();
        fetchPositions();
  }, []);

  const resetForm = () => {
    setFormData({
      email: '', password: '', nombres: '', apellidos: '',
      dni: '', telefono: '', direccion: '',
      puesto_id: '', fecha_ingreso: '', salario: '',
      modalidad: 'PERMANENTE', periodicidad: 'MENSUAL'
    });
    setEditingEmployee(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (emp) => {
    setEditingEmployee(emp);
    setFormData({
      email: emp.usuario?.email || '',
      password: '',
      nombres: emp.nombres,
      apellidos: emp.apellidos,
      dni: emp.dni,
      telefono: emp.telefono || '',
      direccion: emp.direccion || '',
      puesto_id: emp.puesto_id?.toString() || '',
      fecha_ingreso: emp.fecha_ingreso ? emp.fecha_ingreso.split('T')[0] : '',
      salario: emp.salario?.toString() || ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    try {
      const base = {
        email: formData.email,
        nombres: formData.nombres,
        apellidos: formData.apellidos,
        telefono: formData.telefono || undefined,
        direccion: formData.direccion || undefined,
        puesto_id: Number(formData.puesto_id),
      };
      if (editingEmployee) {
        await api.put(`/admin/employees/${editingEmployee.id}`, base);
        setMessage({ type: 'success', text: 'Empleado actualizado exitosamente' });
      } else {
        await api.post('/admin/employees', {
          ...base,
          password: formData.password,
          dni: formData.dni,
          fecha_ingreso: formData.fecha_ingreso,
          salario: Number(formData.salario),
          modalidad: formData.modalidad,
          periodicidad: formData.periodicidad,
        });
        setMessage({ type: 'success', text: 'Empleado creado exitosamente. La contraseña temporal debe entregarse por un canal seguro (ya no se envía por notificación).' });
      }
      setShowModal(false);
      resetForm();
      fetchEmployees();
    } catch (error) {
      // eslint-disable-next-line no-unused-vars -- se usa en la rama de detalle
      void error;
      setMessage({ type: 'error', text: error.response?.data?.message || 'Error al guardar' });
    }
  };

  const toggleActive = async (emp) => {
    const esActivo = emp.usuario?.estado === 'ACTIVO';
    try {
      await api.put(`/admin/employees/${emp.id}`, { activo: !esActivo });
      fetchEmployees();
    } catch {
      alert('Error al cambiar estado');
    }
  };

  const filtered = employees.filter(e =>
    `${e.nombres} ${e.apellidos} ${e.dni}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestión de Empleados</h1>
          <p className="text-slate-500 mt-1">Administra la información de todos los empleados</p>
        </div>
        <button onClick={openCreateModal} className="flex items-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors">
          <Plus className="w-5 h-5 mr-1" /> Nuevo Empleado
        </button>
      </div>

      {message.text && (
        <div className={`p-4 rounded-lg text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar por nombre o DNI..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
        />
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
                  <th className="px-6 py-4">Nombre</th>
                  <th className="px-6 py-4">DNI</th>
                  <th className="px-6 py-4">Puesto</th>
                  <th className="px-6 py-4">Departamento</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((emp) => (
                  <tr key={emp.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{emp.nombres} {emp.apellidos}</div>
                      <div className="text-xs text-slate-400">{emp.usuario?.email}</div>
                    </td>
                    <td className="px-6 py-4">{emp.dni}</td>
                    <td className="px-6 py-4">{emp.puesto?.titulo || '—'}</td>
                    <td className="px-6 py-4">{emp.puesto?.departamento?.nombre || '—'}</td>
                    <td className="px-6 py-4">
                      {emp.usuario?.estado === 'ACTIVO'
                        ? <span className="bg-green-100 text-green-800 text-xs px-2.5 py-0.5 rounded-full font-medium">Activo</span>
                        : <span className="bg-red-100 text-red-800 text-xs px-2.5 py-0.5 rounded-full font-medium">Inactivo</span>
                      }
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button onClick={() => openEditModal(emp)} className="inline-flex items-center p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Editar">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => toggleActive(emp)} className={`inline-flex items-center p-1.5 rounded-lg transition-colors ${emp.usuario?.estado === 'ACTIVO' ? 'text-slate-400 hover:text-red-600 hover:bg-red-50' : 'text-slate-400 hover:text-green-600 hover:bg-green-50'}`} title={emp.usuario?.estado === 'ACTIVO' ? 'Desactivar' : 'Activar'}>
                        {emp.usuario?.estado === 'ACTIVO' ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan="6" className="px-6 py-12 text-center text-slate-400">No se encontraron empleados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Crear/Editar */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 sticky top-0">
              <h3 className="text-lg font-bold text-slate-900">{editingEmployee ? 'Editar Empleado' : 'Nuevo Empleado'}</h3>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nombres</label>
                  <input type="text" required value={formData.nombres} onChange={(e) => setFormData({...formData, nombres: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Apellidos</label>
                  <input type="text" required value={formData.apellidos} onChange={(e) => setFormData({...formData, apellidos: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-lg" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input type="email" required value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{editingEmployee ? 'Nueva Contraseña (opcional)' : 'Contraseña'}</label>
                  <input type="password" required={!editingEmployee} value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-lg" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">DNI</label>
                  <input type="text" required value={formData.dni} onChange={(e) => setFormData({...formData, dni: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
                  <input type="text" value={formData.telefono} onChange={(e) => setFormData({...formData, telefono: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Dirección</label>
                <input type="text" value={formData.direccion} onChange={(e) => setFormData({...formData, direccion: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Puesto</label>
                  <select required value={formData.puesto_id} onChange={(e) => setFormData({...formData, puesto_id: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-lg">
                    <option value="">Seleccionar...</option>
                    {positions.map(p => <option key={p.id} value={p.id}>{p.titulo} — {p.departamento?.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Salario (L)</label>
                  <input type="number" step="0.01" required={!editingEmployee} value={formData.salario} onChange={(e) => setFormData({...formData, salario: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-lg" />
                </div>
              </div>
              {!editingEmployee && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Modalidad de contrato</label>
                    <select value={formData.modalidad} onChange={(e) => setFormData({...formData, modalidad: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-lg">
                      <option value="PERMANENTE">Permanente (planta)</option>
                      <option value="POR_PROYECTO">Por proyecto</option>
                      <option value="POR_DIA">Por día</option>
                      <option value="POR_HORA">Por hora</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Periodicidad de pago</label>
                    <select value={formData.periodicidad} onChange={(e) => setFormData({...formData, periodicidad: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-lg">
                      <option value="MENSUAL">Mensual</option>
                      <option value="QUINCENAL">Quincenal</option>
                      <option value="SEMANAL">Semanal</option>
                      <option value="POR_JORNADA">Por jornada</option>
                    </select>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fecha de Ingreso</label>
                <input type="date" required value={formData.fecha_ingreso} onChange={(e) => setFormData({...formData, fecha_ingreso: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-lg" />
              </div>
              <div className="pt-4 flex justify-end space-x-3">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg">Cancelar</button>
                <button type="submit" className="px-5 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700">
                  {editingEmployee ? 'Guardar Cambios' : 'Crear Empleado'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
