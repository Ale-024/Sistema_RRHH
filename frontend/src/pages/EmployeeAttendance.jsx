import { useState, useEffect } from 'react';
import api from '../services/api';
import { Clock, LogIn, LogOut, MapPin, Loader2, CalendarDays, Briefcase } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

const ESTILOS_ESTADO = {
  PRESENTE: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
  TARDANZA: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300',
  AUSENTE: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
  PERMISO: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
  VACACION: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
  FERIADO: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  INCAPACIDAD: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
  DESCANSO: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

export default function EmployeeAttendance() {
  const { user } = useAuthStore();
  const [registros, setRegistros] = useState([]);
  const [estadoHoy, setEstadoHoy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [marcando, setMarcando] = useState(false);
  const [mensaje, setMensaje] = useState({ type: '', text: '' });
  const [usarGps, setUsarGps] = useState(false);
  // RF-16 / CU02.2: proyecto de campo vinculado al marcaje del encuestador.
  const esEncuestador = user?.rol === 'ENCUESTADOR';
  const [proyectos, setProyectos] = useState([]);
  const [proyectoId, setProyectoId] = useState('');

  const cargar = async () => {
    try {
      const [resRegistros, resHoy] = await Promise.all([
        api.get('/employee/attendance'),
        api.get('/employee/attendance/hoy'),
      ]);
      setRegistros(resRegistros.data);
      setEstadoHoy(resHoy.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // La carga inicial actualiza estado solo despues del await; el aviso
    // react(set-state-in-effect) es un falso positivo en este patron.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
    // eslint-disable-next-line react-hooks/set-state-in-effect
  }, []);

  // CU01.5: proyectos asignados al encuestador de campo.
  useEffect(() => {
    if (!esEncuestador) return;
    api.get('/employee/proyectos')
      .then((r) => setProyectos(r.data ?? []))
      .catch(() => setProyectos([]));
  }, [esEncuestador]);


  const marcar = async () => {
    setMarcando(true);
    setMensaje({ type: '', text: '' });
    try {
      let cuerpo = { dispositivo: 'web' };
      if (usarGps && navigator.geolocation) {
        cuerpo = await new Promise((resolve, _reject) => {
          navigator.geolocation.getCurrentPosition(
            (pos) =>
              resolve({
                ...cuerpo,
                latitud: pos.coords.latitude,
                longitud: pos.coords.longitude,
              }),
            () => resolve(cuerpo),
            { timeout: 5000 }
          );
        });
      }
      // RF-16: el marcaje de campo se vincula al proyecto seleccionado.
      if (esEncuestador && proyectoId) cuerpo.proyectoId = Number(proyectoId);
      const res = await api.post('/employee/attendance', cuerpo);
      setMensaje({ type: 'success', text: res.data.message });
      await cargar();
    } catch (error) {
      setMensaje({
        type: 'error',
        text: error.response?.data?.message || 'Error al registrar el marcaje.',
      });
    } finally {
      setMarcando(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-blue-600" /> Mi Asistencia
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Registra tu entrada y salida; la tardanza se calcula contra tu turno.
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          {esEncuestador && proyectos.length > 0 && (
            <select
              value={proyectoId}
              onChange={(e) => setProyectoId(e.target.value)}
              className="text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-900/40 text-slate-700 dark:text-slate-200"
            >
              <option value="">Sin proyecto (marca general)</option>
              {proyectos.map((p) => (
                <option key={p.id} value={p.proyecto.id}>
                  {p.proyecto.codigo} · {p.proyecto.nombre}
                </option>
              ))}
            </select>
          )}
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={usarGps}
              onChange={(e) => setUsarGps(e.target.checked)}
              className="rounded border-slate-300"
            />
            <MapPin className="w-4 h-4" /> Incluir ubicación
          </label>
          <button
            onClick={marcar}
            disabled={marcando}
            className={`flex items-center px-6 py-3 font-bold rounded-xl shadow-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-60 ${
              estadoHoy?.proximoTipo === 'SALIDA'
                ? 'bg-red-600 hover:bg-red-700 shadow-red-600/20 text-white'
                : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20 text-white'
            }`}
          >
            {marcando ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : estadoHoy?.proximoTipo === 'SALIDA' ? (
              <LogOut className="w-5 h-5 mr-2" />
            ) : (
              <LogIn className="w-5 h-5 mr-2" />
            )}
            Marcar {estadoHoy?.proximoTipo === 'SALIDA' ? 'salida' : 'entrada'}
          </button>
        </div>
      </div>

      {mensaje.text && (
        <div
          className={`p-4 rounded-lg text-sm font-medium ${
            mensaje.type === 'success'
              ? 'bg-green-50 text-green-700 dark:bg-green-900/40 dark:text-green-300'
              : 'bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-300'
          }`}
        >
          {mensaje.text}
        </div>
      )}

      {/* Registros consolidados */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white">Historial</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-500">Cargando...</div>
        ) : registros.length === 0 ? (
          <div className="p-8 text-center text-slate-400">Aún no tienes registros de asistencia.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-3">Fecha</th>
                  <th className="px-6 py-3">Turno</th>
                  <th className="px-6 py-3">Entrada</th>
                  <th className="px-6 py-3">Salida</th>
                  <th className="px-6 py-3">Trabajado</th>
                  <th className="px-6 py-3">Tardanza</th>
                  <th className="px-6 py-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {registros.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="px-6 py-3 font-medium">
                      {new Date(r.fecha).toLocaleDateString('es-HN', { timeZone: 'UTC' })}
                      {r.cerrado && (
                        <span className="ml-2 text-[10px] uppercase bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                          cerrado
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3">{r.turno?.nombre || '—'}</td>
                    <td className="px-6 py-3">{r.horaEntrada ? new Date(r.horaEntrada).toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    <td className="px-6 py-3">{r.horaSalida ? new Date(r.horaSalida).toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    <td className="px-6 py-3">
                      {Math.floor(r.minutosTrabajados / 60)}h {r.minutosTrabajados % 60}m
                      {(r.horasExtraDiurnas > 0 || r.horasExtraNocturnas > 0) && (
                        <span className="block text-xs text-blue-500">
                          +HE {(r.horasExtraDiurnas + r.horasExtraNocturnas).toFixed(2)}h
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3">{r.minutosTardanza > 0 ? `${r.minutosTardanza} min` : '—'}</td>
                    <td className="px-6 py-3">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${ESTILOS_ESTADO[r.estadoDia] || ESTILOS_ESTADO.DESCANSO}`}>
                        {r.estadoDia}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Marcajes de hoy */}
      {estadoHoy?.marcajes?.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <Clock className="w-4 h-4" /> Marcajes de hoy
          </h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {estadoHoy.marcajes.map((m) => (
              <span
                key={m.id}
                className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg ${
                  m.tipo === 'ENTRADA'
                    ? 'bg-green-50 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                    : 'bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                }`}
              >
                {m.tipo === 'ENTRADA' ? <LogIn className="w-4 h-4" /> : <LogOut className="w-4 h-4" />}
                {m.tipo === 'ENTRADA' ? 'Entrada' : 'Salida'}
                <strong>{new Date(m.ocurridoEn).toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' })}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* CU01.5: proyectos asignados (encuestador de campo) */}
      {esEncuestador && proyectos.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Briefcase className="w-4 h-4" /> Mis proyectos asignados
            </h3>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {proyectos.map((p) => (
              <div key={p.id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    <span className="text-slate-400 mr-1.5">{p.proyecto.codigo}</span>
                    {p.proyecto.nombre}
                  </p>
                  {p.proyecto.descripcion && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{p.proyecto.descripcion}</p>
                  )}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {Math.round((p.porcentajeDedicacion ?? 1) * 100)}% dedicación
                  {' · '}desde {new Date(p.desde).toLocaleDateString('es-HN')}
                  {p.hasta ? ` · hasta ${new Date(p.hasta).toLocaleDateString('es-HN')}` : ' · vigente'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
