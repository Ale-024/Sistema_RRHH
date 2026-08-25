import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import api from '../services/api';
import {
  AlarmClock, ChevronRight, Clock3, FileText, CalendarDays, UserRound, Receipt,
} from 'lucide-react';

const GESTIONES = [
  { titulo: 'Mis solicitudes', descripcion: 'Permisos y su seguimiento', ruta: '/employee/requests', icono: FileText },
  { titulo: 'Vacaciones', descripcion: 'Saldos y solicitudes de vacaciones', ruta: '/employee/vacations', icono: CalendarDays },
  { titulo: 'Mi perfil', descripcion: 'Datos personales y cambio de contraseña', ruta: '/employee/profile', icono: UserRound },
  { titulo: 'Mis recibos', descripcion: 'Recibos de nómina', ruta: '/employee/payroll', icono: Receipt },
];

function useReloj() {
  const [ahora, setAhora] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return ahora;
}

export default function EmployeeDashboard() {
  const { user } = useAuthStore();
  const ahora = useReloj();
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
  const hora = (valor) =>
    valor ? new Date(valor).toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' }) : null;

  return (
    <div className="space-y-7">
      {/* Encabezado institucional */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1f3d2b] dark:text-emerald-500">
            Marketing Total · Portal del empleado
          </p>
          <h1 className="mt-1.5 font-serif text-[26px] leading-tight font-semibold text-slate-900 dark:text-slate-50">
            Bienvenido, {user?.nombres}
          </h1>
        </div>
        <p className="text-sm tabular-nums text-slate-500 dark:text-slate-400">
          {ahora.toLocaleTimeString('es-HN')}
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Tarjeta de asistencia del dia */}
        <section className="lg:col-span-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <AlarmClock className="w-4 h-4 text-slate-400" /> Asistencia de hoy
            </h2>
            {hoy && (
              <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                Próximo marcaje: {proximoTipo}
              </span>
            )}
          </div>

          <div className="px-6 py-6 grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-800">
            {[
              { etiqueta: 'Entrada', valor: hora(hoy?.ultimaEntrada) ?? '—' },
              { etiqueta: 'Salida', valor: hora(hoy?.ultimaSalida) ?? 'pendiente' },
              { etiqueta: 'Marcajes', valor: hoy?.marcajesDelDia ?? '—' },
            ].map((m) => (
              <div key={m.etiqueta} className="px-2 text-center">
                <p className="text-xl font-semibold tabular-nums text-slate-900 dark:text-white">{m.valor}</p>
                <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500 mt-1">{m.etiqueta}</p>
              </div>
            ))}
          </div>

          <div className="px-6 pb-6">
            <button
              onClick={marcar}
              disabled={cargando || !hoy}
              className="w-full py-3 bg-[#1f3d2b] hover:bg-[#16302a] dark:bg-emerald-700 dark:hover:bg-emerald-800 text-white text-sm font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
            >
              <Clock3 className="w-4 h-4" />
              {cargando ? 'Registrando…' : `Registrar ${proximoTipo.toLowerCase()}`}
            </button>

            {mensaje.texto && (
              <p
                className={`mt-4 text-sm px-3 py-2 border-l-2 rounded-r ${
                  mensaje.tipo === 'ok'
                    ? 'border-[#1f3d2b] dark:border-emerald-600 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200'
                    : 'border-red-600 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400'
                }`}
              >
                {mensaje.texto}
              </p>
            )}
          </div>
        </section>

        {/* Gestiones */}
        <section className="lg:col-span-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400 mb-3">
            Gestiones
          </h2>
          <div className="space-y-2.5">
            {GESTIONES.map((g) => {
              const Icono = g.icono;
              return (
                <Link
                  key={g.ruta}
                  to={g.ruta}
                  className="group flex items-center gap-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                >
                  <span className="inline-flex w-8 h-8 shrink-0 rounded-md bg-slate-100 dark:bg-slate-800 items-center justify-center">
                    <Icono className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">{g.titulo}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">{g.descripcion}</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-[#1f3d2b] dark:group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
