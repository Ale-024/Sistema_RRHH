import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import api from '../services/api';
import { tieneAlgunPermiso, tienePermiso } from '../shared/roles';

const ACCESOS = [
  {
    titulo: 'Empleados',
    descripcion: 'Expedientes, contratos y altas de personal.',
    ruta: '/admin/employees',
    permisos: ['empleados:leer'],
  },
  {
    titulo: 'Asistencia',
    descripcion: 'Marcajes del día, importación y cierre diario.',
    ruta: '/admin/attendance',
    permisos: ['asistencia:leer_global'],
  },
  {
    titulo: 'Solicitudes',
    descripcion: 'Permisos pendientes de revisión y aprobación.',
    ruta: '/admin/requests',
    permisos: ['solicitudes:revisar', 'solicitudes:leer_global'],
  },
  {
    titulo: 'Vacaciones',
    descripcion: 'Saldos, solicitudes y aprobaciones.',
    ruta: '/admin/vacations',
    permisos: ['vacaciones:aprobar', 'vacaciones:leer_global'],
  },
  {
    titulo: 'Nómina',
    descripcion: 'Periodos de planilla y cálculo.',
    ruta: '/admin/payroll',
    permisos: ['planilla:leer_global'],
  },
  {
    titulo: 'Parámetros legales',
    descripcion: 'Vigencias de salario mínimo, INSS e IR.',
    ruta: '/admin/parameters',
    permisos: ['parametros:leer'],
  },
  {
    titulo: 'Usuarios y roles',
    descripcion: 'Cuentas, autorizaciones de rol elevado y bitácora.',
    ruta: '/admin/usuarios',
    permisos: ['usuarios:administrar', 'planilla:cerrar'],
  },
  {
    titulo: 'Reportes',
    descripcion: 'Asistencia, ausentismo y personal por proyecto.',
    ruta: '/admin/reports',
    permisos: ['reportes:ver', 'reportes:ver_global'],
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

  const accesos = ACCESOS.filter((a) => tieneAlgunPermiso(user, a.permisos));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Panel de administración</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {user?.nombres} {user?.apellidos} · {fechaHoy()}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-slate-200 border border-slate-200">
        {tienePermiso(user, 'empleados:leer') && (
          <div className="bg-white p-6">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Empleados registrados
            </p>
            <p className="text-3xl font-semibold text-slate-800 mt-2">
              {stats.empleados ?? '—'}
            </p>
          </div>
        )}
        {tienePermiso(user, 'solicitudes:revisar') && (
          <div className="bg-white p-6">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Solicitudes pendientes
            </p>
            <p className="text-3xl font-semibold text-slate-800 mt-2">
              {stats.solicitudesPendientes ?? '—'}
            </p>
          </div>
        )}
        {tienePermiso(user, 'planilla:leer_global') && (
          <div className="bg-white p-6">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Nóminas por aprobar o pagar
            </p>
            <p className="text-3xl font-semibold text-slate-800 mt-2">
              {stats.planillasPendientes ?? '—'}
            </p>
            <Link to="/admin/payroll" className="text-sm text-brand-blue hover:underline mt-1 inline-block">
              Revisar planilla
            </Link>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500 mb-3">
          Accesos
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accesos.map((a) => (
            <Link
              key={a.ruta}
              to={a.ruta}
              className="block bg-white border border-slate-200 p-5 hover:border-brand-blue transition-colors"
            >
              <p className="font-medium text-slate-800">{a.titulo}</p>
              <p className="text-sm text-slate-500 mt-1">{a.descripcion}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
