import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import api from '../services/api';

export default function EmployeeDashboard() {
  const { user } = useAuthStore();
  const [hoy, setHoy] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });

  const cargarEstado = async () => {
    try {
      const res = await api.get('/employee/attendance/hoy');
      setHoy(res.data);
    } catch (error) {
      console.error('Error al consultar el estado del día', error);
    }
  };

  useEffect(() => {
    cargarEstado();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const marcar = async () => {
    setCargando(true);
    setMensaje({ tipo: '', texto: '' });
    try {
      const res = await api.post('/employee/attendance');
      setMensaje({ tipo: 'ok', texto: res.data.message || 'Marcaje registrado.' });
      await cargarEstado();
    } catch (error) {
      setMensaje({
        tipo: 'error',
        texto: error.response?.data?.message || 'Error al registrar la asistencia.',
      });
    } finally {
      setCargando(false);
    }
  };

  const proximoTipo = hoy?.proximoTipo === 'SALIDA' ? 'Salida' : 'Entrada';

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
          Bienvenido, {user?.nombres}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Marketing Total · Portal del empleado
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Asistencia */}
        <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Registro de asistencia
          </h2>

          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between border-b border-slate-100 dark:border-slate-700/60 pb-2">
              <dt className="text-slate-500 dark:text-slate-400">Entrada</dt>
              <dd className="font-medium text-slate-800 dark:text-slate-100">
                {hoy?.ultimaEntrada
                  ? new Date(hoy.ultimaEntrada).toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' })
                  : '—'}
              </dd>
            </div>
            <div className="flex justify-between border-b border-slate-100 dark:border-slate-700/60 pb-2">
              <dt className="text-slate-500 dark:text-slate-400">Salida</dt>
              <dd className="font-medium text-slate-800 dark:text-slate-100">
                {hoy?.ultimaSalida
                  ? new Date(hoy.ultimaSalida).toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' })
                  : 'pendiente'}
              </dd>
            </div>
            <div className="flex justify-between border-b border-slate-100 dark:border-slate-700/60 pb-2">
              <dt className="text-slate-500 dark:text-slate-400">Marcajes de hoy</dt>
              <dd className="font-medium text-slate-800 dark:text-slate-100">{hoy?.marcajesDelDia ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500 dark:text-slate-400">Próximo marcaje</dt>
              <dd className="font-medium text-slate-800 dark:text-slate-100">{hoy ? proximoTipo : '—'}</dd>
            </div>
          </dl>

          <button
            onClick={marcar}
            disabled={cargando || !hoy}
            className="mt-5 w-full py-2.5 bg-brand-blue hover:bg-brand-DEFAULT text-white text-sm font-medium rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {cargando ? 'Registrando…' : `Marcar ${proximoTipo.toLowerCase()}`}
          </button>

          {mensaje.texto && (
            <p
              className={`mt-4 text-sm px-3 py-2 border-l-4 ${
                mensaje.tipo === 'ok'
                  ? 'border-green-600 bg-green-50 dark:bg-emerald-500/10 text-green-700 dark:text-emerald-400'
                  : 'border-red-500 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400'
              }`}
            >
              {mensaje.texto}
            </p>
          )}
        </section>

        {/* Accesos */}
        <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">
            Gestiones
          </h2>
          <nav className="space-y-px bg-slate-100 dark:bg-slate-700 border border-slate-100 dark:border-slate-700/60">
            {[
              { titulo: 'Mis solicitudes', descripcion: 'Permisos y su seguimiento', ruta: '/employee/requests' },
              { titulo: 'Vacaciones', descripcion: 'Saldos y solicitudes de vacaciones', ruta: '/employee/vacations' },
              { titulo: 'Mi perfil', descripcion: 'Datos personales y cambio de contraseña', ruta: '/employee/profile' },
              { titulo: 'Mis recibos', descripcion: 'Recibos de nómina', ruta: '/employee/payroll' },
            ].map((a) => (
              <Link
                key={a.ruta}
                to={a.ruta}
                className="block bg-white dark:bg-slate-800 hover:bg-brand-50 px-4 py-3 transition-colors"
              >
                <p className="font-medium text-slate-800 dark:text-slate-100">{a.titulo}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{a.descripcion}</p>
              </Link>
            ))}
          </nav>
        </section>
      </div>
    </div>
  );
}
