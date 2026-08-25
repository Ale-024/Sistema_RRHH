import { useState, useEffect } from 'react';
import api from '../services/api';
import { Shield, UserCog, CheckCircle2, XCircle, Send, X } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { tieneAlgunPermiso, tienePermiso } from '../shared/roles';

const ESTADOS = ['ACTIVO', 'INACTIVO', 'BLOQUEADO'];
const ETIQUETAS_AUTORIZACION = {
  SOLICITADA: 'Solicitada',
  AUTORIZADA: 'Autorizada',
  RECHAZADA: 'Rechazada',
  CONSUMIDA: 'Ejecutada',
};

// Matriz del Anexo (sec. 3): quien puede SOLICITAR cada rol elevado.
const NOMBRES_ROL = {
  EMPLEADO: 'Empleado',
  ENCUESTADOR: 'Encuestador de campo',
  GERENTE_DEPTO: 'Gerente de departamento',
  RRHH_SUP: 'Supervisor de RRHH',
  ADMIN_TI: 'Administrador de TI',
  DIRECCION: 'Dirección general',
};
const SOLICITABLES_POR_ROL = {
  RRHH_SUP: ['EMPLEADO', 'ENCUESTADOR', 'GERENTE_DEPTO'],
  DIRECCION: ['RRHH_SUP', 'DIRECCION'],
  ADMIN_TI: ['ADMIN_TI'],
};

export default function AdminUsuarios() {
  const { user } = useAuthStore();
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [autorizaciones, setAutorizaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [asignacion, setAsignacion] = useState({});
  const [procesando, setProcesando] = useState('');

  // ADMIN_TI gestiona cuentas; DIRECCION (autorizaciones:decidir) participa
  // en el ciclo de autorizacion de roles elevados; RRHH_SUP solicita
  // autorizaciones para su personal (matriz del Anexo, sec. 3).
  const puedeGestionar = tienePermiso(user, 'usuarios:administrar');
  const puedeDecidir = tienePermiso(user, 'autorizaciones:decidir');
  const rolesSolicitables = SOLICITABLES_POR_ROL[user?.rol] ?? [];
  const puedeSolicitar = rolesSolicitables.length > 0;
  const participa = puedeGestionar || puedeDecidir || puedeSolicitar;

  const cargar = async () => {
    setLoading(true);
    try {
      const peticiones = [];
      if (puedeGestionar) {
        peticiones.push(
          api.get('/admin/usuarios').then((r) => setUsuarios(r.data)),
          api.get('/admin/roles').then((r) => setRoles(r.data))
        );
      }
      if (participa) {
        peticiones.push(
          api.get('/admin/autorizaciones-rol').then((r) => setAutorizaciones(r.data?.data ?? r.data))
        );
      }
      await Promise.all(peticiones);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Error al cargar la información.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // La carga inicial actualiza estado solo despues del await; el aviso
    // react(set-state-in-effect) es un falso positivo en este patron.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const decidir = async (id, decision) => {
    const motivo = decision === 'RECHAZADA'
      ? window.prompt('Motivo del rechazo:')
      : window.prompt('Observación (opcional):');
    if (decision === 'RECHAZADA' && !motivo) return;
    setProcesando(`${id}:${decision}`);
    try {
      await api.post(`/admin/autorizaciones-rol/${id}/decision`, { decision, ...(motivo ? { motivo } : {}) });
      notificar('success', `Solicitud ${decision.toLowerCase()}.`);
      cargar();
    } catch (error) {
      notificar('error', error.response?.data?.detail || error.response?.data?.message || 'No se pudo registrar la decisión.');
    } finally {
      setProcesando('');
    }
  };

  // Paso final del anexo: ADMIN_TI ejecuta el otorgamiento citando la
  // autorizacion AUTORIZADA (inv3); sin ese id el backend rechaza.
  const ejecutarAutorizacion = async (aut) => {
    setProcesando(`${aut.id}:ejecutar`);
    try {
      await api.put(`/admin/usuarios/${aut.beneficiarioId}/roles`, {
        rolCodigo: aut.rol?.codigo,
        autorizacionId: aut.id,
      });
      notificar('success', `Rol ${aut.rol?.nombre} asignado a ${aut.beneficiario?.email}.`);
      cargar();
    } catch (error) {
      notificar('error', error.response?.data?.message || 'No se pudo ejecutar la asignación.');
    } finally {
      setProcesando('');
    }
  };

  // ── Paso 1 del anexo: solicitar la autorizacion de un rol elevado ──
  const [formSolicitud, setFormSolicitud] = useState(null);
  const [beneficiarios, setBeneficiarios] = useState([]);
  const [departamentos, setDepartamentos] = useState([]);
  const [enviandoSolicitud, setEnviandoSolicitud] = useState(false);

  const abrirSolicitud = async () => {
    setFormSolicitud({ rolCodigo: rolesSolicitables[0] ?? '', beneficiarioId: '', email: '', scopeDepartamentoId: '', motivo: '' });
    // Fuente de beneficiarios segun lo que el rol puede listar.
    try {
      if (tienePermiso(user, 'usuarios:administrar')) {
        const r = await api.get('/admin/usuarios');
        setBeneficiarios((r.data ?? []).map((u) => ({
          id: u.id,
          etiqueta: `${u.empleado ? `${u.empleado.nombres} ${u.empleado.apellidos} · ` : ''}${u.email}`,
        })));
      } else if (tienePermiso(user, 'empleados:leer')) {
        const r = await api.get('/admin/employees');
        setBeneficiarios((r.data ?? []).filter((e) => e.usuario).map((e) => ({
          id: e.usuario.id,
          etiqueta: `${e.nombres} ${e.apellidos} · ${e.usuario.email}`,
        })));
      }
    } catch { /* el formulario permite correo manual */ }
    if (rolesSolicitables.includes('GERENTE_DEPTO')) {
      try {
        const r = await api.get('/admin/departments');
        setDepartamentos(r.data ?? []);
      } catch { /* sin catalogo, no se puede solicitar GERENTE_DEPTO */ }
    }
  };

  const enviarSolicitud = async (e) => {
    e.preventDefault();
    setEnviandoSolicitud(true);
    try {
      await api.post('/admin/autorizaciones-rol', {
        rolCodigo: formSolicitud.rolCodigo,
        ...(formSolicitud.beneficiarioId
          ? { beneficiarioId: Number(formSolicitud.beneficiarioId) }
          : { email: formSolicitud.email.trim().toLowerCase() }),
        ...(formSolicitud.rolCodigo === 'GERENTE_DEPTO' && formSolicitud.scopeDepartamentoId
          ? { scopeDepartamentoId: Number(formSolicitud.scopeDepartamentoId) }
          : {}),
        ...(formSolicitud.motivo?.trim() ? { motivo: formSolicitud.motivo.trim() } : {}),
      });
      notificar('success', 'Solicitud registrada. Pasa a la bandeja de autorizaciones.');
      setFormSolicitud(null);
      cargar();
    } catch (error) {
      notificar('error', error.response?.data?.detail || error.response?.data?.message || 'No se pudo registrar la solicitud.');
    } finally {
      setEnviandoSolicitud(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Shield className="w-6 h-6 text-blue-600" /> Usuarios y roles
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Cuentas de acceso, permisos por catálogo y autorizaciones de roles elevados.
        </p>
      </div>

      {message.text && (
        <div className={`p-4 rounded-lg text-sm font-medium ${message.type === 'success' ? 'bg-green-50 dark:bg-emerald-500/10 text-green-700 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400'}`}>
          {message.text}
        </div>
      )}

      {/* ── Autorizaciones de rol elevado (anexo de autoridad) ── */}
      {participa && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/60 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-800 dark:text-slate-100">Autorizaciones de rol elevado</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {puedeDecidir
                  ? 'Como Dirección General puedes autorizar o rechazar solicitudes pendientes.'
                  : 'Las solicitudes deben ser autorizadas por Dirección General antes de ejecutarse.'}
              </p>
            </div>
            {puedeSolicitar && (
              <button
                onClick={abrirSolicitud}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
              >
                <Send className="w-3.5 h-3.5" /> Solicitar autorización
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-600 dark:text-slate-400">
              <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-3">Beneficiario</th>
                  <th className="px-6 py-3">Rol solicitado</th>
                  <th className="px-6 py-3">Alcance</th>
                  <th className="px-6 py-3">Estado</th>
                  <th className="px-6 py-3">Vence</th>
                  <th className="px-6 py-3 text-right">Decisión</th>
                </tr>
              </thead>
              <tbody>
                {autorizaciones.map((a) => (
                  <tr key={a.id} className="border-b border-slate-100 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-6 py-3 font-medium text-slate-900 dark:text-slate-100">{a.beneficiario?.email || `Usuario ${a.beneficiarioId}`}</td>
                    <td className="px-6 py-3">{a.rol?.nombre || a.rolId}</td>
                    <td className="px-6 py-3 text-xs">{a.departamento ? a.departamento.nombre : 'Global'}</td>
                    <td className="px-6 py-3">
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        {ETIQUETAS_AUTORIZACION[a.estado] || a.estado}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-xs">{a.venceEn ? new Date(a.venceEn).toLocaleString('es-HN') : '—'}</td>
                    <td className="px-6 py-3 text-right">
                      {a.estado === 'SOLICITADA' && puedeDecidir ? (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => decidir(a.id, 'AUTORIZADA')}
                            disabled={Boolean(procesando)}
                            className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-lg bg-green-50 dark:bg-emerald-500/10 text-green-700 dark:text-emerald-400 hover:bg-green-100 disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Autorizar
                          </button>
                          <button
                            onClick={() => decidir(a.id, 'RECHAZADA')}
                            disabled={Boolean(procesando)}
                            className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-lg bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 hover:bg-red-100 disabled:opacity-50"
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1" /> Rechazar
                          </button>
                        </div>
                      ) : a.estado === 'AUTORIZADA' && puedeGestionar ? (
                        <button
                          onClick={() => ejecutarAutorizacion(a)}
                          disabled={Boolean(procesando)}
                          className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 hover:bg-blue-100 disabled:opacity-50"
                        >
                          <UserCog className="w-3.5 h-3.5 mr-1" /> Ejecutar asignación
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {!autorizaciones.length && (
                  <tr><td colSpan="6" className="px-6 py-8 text-center text-slate-400">No hay autorizaciones registradas.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Gestión de cuentas (solo usuarios:administrar) ── */}
      {puedeGestionar && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400">Cargando...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-slate-600 dark:text-slate-400">
                <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-6 py-4">Usuario</th>
                    <th className="px-6 py-4">Estado</th>
                    <th className="px-6 py-4">Roles</th>
                    <th className="px-6 py-4 w-72">Asignar rol base</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u) => (
                    <tr key={u.id} className="border-b border-slate-100 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
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
                              ? 'bg-green-50 dark:bg-emerald-500/10 text-green-700 dark:text-emerald-400 border-green-200'
                              : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200'
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
                            className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs px-2 py-0.5 rounded-full mr-1"
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
                            className="p-1.5 border border-slate-300 dark:border-slate-600 rounded-lg text-xs flex-1"
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
      )}

      {/* ── Modal: solicitar autorizacion de rol elevado ── */}
      {formSolicitud && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 dark:bg-black/60 p-4">
          <form
            onSubmit={enviarSolicitud}
            className="bg-white dark:bg-slate-800 w-full max-w-md rounded-xl shadow-xl border border-slate-200 dark:border-slate-700"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700/60">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">Solicitar autorización de rol</h3>
              <button type="button" onClick={() => setFormSolicitud(null)} aria-label="Cerrar" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Rol a otorgar</label>
                <select
                  required
                  value={formSolicitud.rolCodigo}
                  onChange={(e) => setFormSolicitud({ ...formSolicitud, rolCodigo: e.target.value })}
                  className="w-full p-2.5 bg-white dark:bg-slate-900/40 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-800 dark:text-slate-100"
                >
                  {rolesSolicitables.map((codigo) => (
                    <option key={codigo} value={codigo}>{NOMBRES_ROL[codigo] ?? codigo}</option>
                  ))}
                </select>
              </div>

              {tienePermiso(user, 'usuarios:administrar') || tienePermiso(user, 'empleados:leer') ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Beneficiario</label>
                  <select
                    required
                    value={formSolicitud.beneficiarioId}
                    onChange={(e) => setFormSolicitud({ ...formSolicitud, beneficiarioId: e.target.value })}
                    className="w-full p-2.5 bg-white dark:bg-slate-900/40 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-800 dark:text-slate-100"
                  >
                    <option value="">Seleccionar...</option>
                    {beneficiarios.map((b) => (
                      <option key={b.id} value={b.id}>{b.etiqueta}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Correo del beneficiario</label>
                  <input
                    type="email"
                    required
                    value={formSolicitud.email}
                    onChange={(e) => setFormSolicitud({ ...formSolicitud, email: e.target.value })}
                    placeholder="persona@sistemarrhh.com"
                    className="w-full p-2.5 bg-white dark:bg-slate-900/40 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-800 dark:text-slate-100"
                  />
                </div>
              )}

              {formSolicitud.rolCodigo === 'GERENTE_DEPTO' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Departamento de alcance (obligatorio)</label>
                  <select
                    required
                    value={formSolicitud.scopeDepartamentoId}
                    onChange={(e) => setFormSolicitud({ ...formSolicitud, scopeDepartamentoId: e.target.value })}
                    className="w-full p-2.5 bg-white dark:bg-slate-900/40 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-800 dark:text-slate-100"
                  >
                    <option value="">Seleccionar...</option>
                    {departamentos.map((d) => (
                      <option key={d.id} value={d.id}>{d.nombre}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Motivo (opcional)</label>
                <textarea
                  rows={2}
                  value={formSolicitud.motivo}
                  onChange={(e) => setFormSolicitud({ ...formSolicitud, motivo: e.target.value })}
                  placeholder="Justificación de la solicitud"
                  className="w-full p-2.5 bg-white dark:bg-slate-900/40 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-800 dark:text-slate-100"
                />
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                La solicitud la autoriza Dirección General y la ejecuta Administración de TI (doble control del Anexo).
              </p>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700/60 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setFormSolicitud(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={enviandoSolicitud}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg inline-flex items-center gap-1.5"
              >
                <Send className="w-4 h-4" /> {enviandoSolicitud ? 'Enviando…' : 'Enviar solicitud'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
