import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import api from '../services/api';
import { tieneAlgunPermiso, tienePermiso } from '../shared/roles';
import {
  Users, CalendarClock, FileText, CalendarDays, Receipt, Scale, Shield,
  BarChart3, ChevronRight, UserRound, AlarmClock, FileWarning,
} from 'lucide-react';

const MODULOS = [
  {
    titulo: 'Empleados',
    descripcion: 'Expedientes, contratos y altas de personal.',
    ruta: '/admin/employees',
    permisos: ['empleados:leer'],
    icono: Users,
  },
  {
    titulo: 'Asistencia',
    descripcion: 'Marcajes del día, importación y cierre diario.',
    ruta: '/admin/attendance',
    permisos: ['asistencia:leer_global'],
    icono: CalendarClock,
  },
  {
    titulo: 'Solicitudes',
    descripcion: 'Permisos pendientes de revisión y aprobación.',
    ruta: '/admin/requests',
    permisos: ['solicitudes:revisar', 'solicitudes:leer_global'],
    icono: FileText,
  },
  {
    titulo: 'Vacaciones',
    descripcion: 'Saldos, solicitudes y aprobaciones.',
    ruta: '/admin/vacations',
    permisos: ['vacaciones:aprobar', 'vacaciones:leer_global'],
    icono: CalendarDays,
  },
  {
    titulo: 'Nómina',
    descripcion: 'Periodos de planilla y cálculo.',
    ruta: '/admin/payroll',
    permisos: ['planilla:leer_global'],
    icono: Receipt,
  },
  {
    titulo: 'Parámetros legales',
    descripcion: 'Vigencias de salario mínimo, IHSS, RAP e ISR.',
    ruta: '/admin/parameters',
    permisos: ['parametros:leer'],
    icono: Scale,
  },
  {
    titulo: 'Usuarios y roles',
    descripcion: 'Cuentas, autorizaciones de rol elevado y bitácora.',
    ruta: '/admin/usuarios',
    permisos: ['usuarios:administrar', 'autorizaciones:decidir', 'solicitudes:revisar'],
    icono: Shield,
  },
  {
    titulo: 'Reportes',
    descripcion: 'Asistencia, ausentismo y personal por proyecto.',
    ruta: '/admin/reports',
    permisos: ['reportes:ver', 'reportes:ver_global'],
    icono: BarChart3,
  },
];

function fechaHoy() {
  return new Date().toLocaleDateString('es-HN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function AdminDashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState({
    empleados: null,
    solicitudesPendientes: null,
    planillasPendientes: null,
  });

  useEffect(() => {
    // Cada indicador se consulta solo si el rol del usuario lo permite;
    // evita 403 innecesarios en consola (p. ej. DIRECCION no ve empleados).
    const fetchStats = async () => {
      const promesas = [];

      if (tienePermiso(user, 'empleados:leer')) {
        promesas.push(
          api.get('/admin/employees')
            .then((r) => ['empleados', r.data.length])
            .catch(() => null)
        );
      }
      if (tienePermiso(user, 'solicitudes:revisar')) {
        promesas.push(
          api.get('/admin/requests')
            .then((r) => ['solicitudesPendientes', r.data.filter((x) => x.estado === 'PENDIENTE').length])
            .catch(() => null)
        );
      }
      if (tienePermiso(user, 'planilla:leer_global')) {
        promesas.push(
          api.get('/admin/payroll')
            .then((r) => ['planillasPendientes', r.data.filter((x) => x.estado === 'EN_APROBACION' || x.estado === 'CERRADA').length])
            .catch(() => null)
        );
      }

      const resultados = await Promise.all(promesas);
      setStats(Object.fromEntries(resultados.filter(Boolean)));
    };
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const modulos = MODULOS.filter((m) => tieneAlgunPermiso(user, m.permisos));

  const indicadores = [];
  if (tienePermiso(user, 'empleados:leer')) {
    indicadores.push({
      etiqueta: 'Empleados registrados',
      valor: stats.empleados ?? '—',
      icono: UserRound,
      ruta: '/admin/employees',
      enlace: 'Gestionar',
      acento: 'border-t-blue-700',
    });
  }
  if (tienePermiso(user, 'solicitudes:revisar')) {
    indicadores.push({
      etiqueta: 'Solicitudes pendientes',
      valor: stats.solicitudesPendientes ?? '—',
      icono: FileWarning,
      ruta: '/admin/requests',
      enlace: 'Revisar bandeja',
      acento: 'border-t-amber-600',
    });
  }
  if (tienePermiso(user, 'planilla:leer_global')) {
    indicadores.push({
      etiqueta: 'Nóminas por cerrar o pagar',
      valor: stats.planillasPendientes ?? '—',
      icono: AlarmClock,
      ruta: '/admin/payroll',
      enlace: 'Ir a planilla',
      acento: 'border-t-[#1f3d2b] dark:border-t-emerald-700',
    });
  }

  return (
    <div className="space-y-7">
      {/* Encabezado institucional */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1f3d2b] dark:text-emerald-500">
            Marketing Total · Gestión Humana
          </p>
          <h1 className="mt-1.5 font-serif text-[26px] leading-tight font-semibold text-slate-900 dark:text-slate-50">
            Panel de administración
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {user?.nombres} {user?.apellidos}
            <span className="mx-2 text-slate-300 dark:text-slate-600">|</span>
            <span className="first-letter:uppercase">{fechaHoy()}</span>
          </p>
        </div>
      </header>

      {/* Indicadores */}
      {indicadores.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {indicadores.map((ind) => {
            const Icono = ind.icono;
            return (
              <div
                key={ind.etiqueta}
                className={`rounded-lg border border-t-2 border-slate-200 ${ind.acento} dark:border-slate-800 dark:bg-slate-900 bg-white p-5`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    {ind.etiqueta}
                  </p>
                  <Icono className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                </div>
                <p className="mt-3 text-[32px] leading-none font-semibold tabular-nums text-slate-900 dark:text-white">
                  {ind.valor}
                </p>
                <Link
                  to={ind.ruta}
                  className="mt-3 inline-flex items-center gap-0.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-[#1f3d2b] dark:hover:text-emerald-400 transition-colors"
                >
                  {ind.enlace}
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {/* Modulos */}
      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400 mb-3">
          Módulos del sistema
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {modulos.map((m) => {
            const Icono = m.icono;
            return (
              <Link
                key={m.ruta}
                to={m.ruta}
                className="group flex flex-col justify-between rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 min-h-[104px] hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="inline-flex w-8 h-8 rounded-md bg-slate-100 dark:bg-slate-800 items-center justify-center">
                    <Icono className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-[#1f3d2b] dark:group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
                </div>
                <div className="mt-3">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{m.titulo}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">{m.descripcion}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
