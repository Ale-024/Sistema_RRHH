import { useState, useEffect } from 'react';
import api from '../services/api';
import { Shield, UserCog } from 'lucide-react';

const ESTADOS = ['ACTIVO', 'INACTIVO', 'BLOQUEADO'];

export default function AdminUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [asignacion, setAsignacion] = useState({});

  useEffect(() => {
    cargar();
  }, []);

  const cargar = async () => {
    try {
      const [resUsuarios, resRoles] = await Promise.all([
        api.get('/admin/usuarios'),
        api.get('/admin/roles'),
      ]);
      setUsuarios(resUsuarios.data);
      setRoles(resRoles.data);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Error al cargar usuarios y roles.',
      });
    } finally {
      setLoading(false);
    }
  };

  const notificar = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  const asignarRol = async (usuarioId) => {
    const eleccion = asignacion[usuarioId];
    if (!eleccion) return;
    try {
      await api.put(`/admin/usuarios/${usuarioId}/roles`, { rolCodigo: eleccion });
      notificar('success', 'Rol asignado.');
      setAsignacion((a) => ({ ...a, [usuarioId]: '' }));
      cargar();
    } catch (error) {
      notificar('error', error.response?.data?.message || 'No se pudo asignar el rol.');
    }
  };

  const quitarRol = async (usuarioId, rolCodigo) => {
    const usuario = usuarios.find((u) => u.id === usuarioId);
    const relacion = usuario?.roles.find((r) => r.rol.codigo === rolCodigo);
    if (!relacion) return;
    try {
      await api.delete(`/admin/usuarios/${usuarioId}/roles/${relacion.rol.id}`);
      notificar('success', 'Rol retirado.');
      cargar();
    } catch (error) {
      notificar('error', error.response?.data?.message || 'No se pudo retirar el rol.');
    }
  };

  const cambiarEstado = async (usuarioId, estado) => {
    try {
      await api.put(`/admin/usuarios/${usuarioId}/estado`, { estado });
      notificar('success', `Estado cambiado a ${estado}.`);
      cargar();
    } catch (error) {
      notificar('error', error.response?.data?.message || 'No se pudo cambiar el estado.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Shield className="w-6 h-6 text-blue-600" /> Usuarios y roles
        </h1>
        <p className="text-slate-500 mt-1">
          Administra cuentas de acceso y sus permisos según el catálogo de roles.
        </p>
      </div>

      {message.text && (
        <div className={`p-4 rounded-lg text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Cargando...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-600">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Usuario</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4">Roles</th>
                  <th className="px-6 py-4 w-72">Asignar rol</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900 flex items-center gap-1.5">
                        <UserCog className="w-4 h-4 text-slate-400" />
                        {u.email}
                      </div>
                      <div className="text-xs text-slate-400">
                        {u.empleado ? `${u.empleado.nombres} ${u.empleado.apellidos}` : 'Sin expediente'}
                        {' · último acceso: '}
                        {u.ultimoAcceso ? new Date(u.ultimoAcceso).toLocaleString('es-HN') : 'nunca'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={u.estado}
                        onChange={(e) => cambiarEstado(u.id, e.target.value)}
                        className={`p-1.5 rounded-lg border text-xs font-medium ${
                          u.estado === 'ACTIVO'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`}
                      >
                        {ESTADOS.map((e) => (
                          <option key={e} value={e}>{e}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4 space-y-1">
                      {u.roles.length === 0 && (
                        <span className="text-slate-400 text-xs">Sin roles</span>
                      )}
                      {u.roles.map((r) => (
                        <span
                          key={r.rol.codigo}
                          className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded-full mr-1"
                        >
                          {r.rol.nombre}
                          <button
                            onClick={() => quitarRol(u.id, r.rol.codigo)}
                            className="text-slate-400 hover:text-red-600"
                            title="Retirar rol"
                          >
                            ×
                          </button>
                          {r.scopeDepartamentoId && (
                            <span className="text-[10px] text-slate-400">(depto. {r.scopeDepartamentoId})</span>
                          )}
                        </span>
                      ))}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <select
                          value={asignacion[u.id] || ''}
                          onChange={(e) => setAsignacion((a) => ({ ...a, [u.id]: e.target.value }))}
                          className="p-1.5 border border-slate-300 rounded-lg text-xs flex-1"
                        >
                          <option value="">Seleccionar rol...</option>
                          {roles.map((r) => (
                            <option key={r.id} value={r.codigo}>{r.nombre}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => asignarRol(u.id)}
                          disabled={!asignacion[u.id]}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg"
                        >
                          Asignar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
