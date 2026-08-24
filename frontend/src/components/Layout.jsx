import { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import {
  LayoutDashboard,
  Users,
  CalendarClock,
  CalendarDays,
  FileText,
  Receipt,
  Shield,
  BarChart3,
  User,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import NotificationsMenu from './NotificationsMenu';
import ThemeToggle from './ThemeToggle';
import { esRolAdministrativo, tieneAlgunPermiso, tienePermiso, ETIQUETAS_ROL } from '../shared/roles';

export default function Layout() {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // `permisos` acepta un código o una lista: basta con poseer uno de ellos.
  const adminLinks = [
    { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { name: 'Empleados', path: '/admin/employees', icon: Users, permisos: ['empleados:leer'] },
    { name: 'Asistencia', path: '/admin/attendance', icon: CalendarClock, permisos: ['asistencia:leer_global'] },
    { name: 'Solicitudes', path: '/admin/requests', icon: FileText, permisos: ['solicitudes:revisar', 'solicitudes:leer_global'] },
    { name: 'Vacaciones', path: '/admin/vacations', icon: CalendarDays, permisos: ['vacaciones:aprobar', 'vacaciones:leer_global'] },
    { name: 'Nómina', path: '/admin/payroll', icon: Receipt, permisos: ['planilla:leer_global'] },
    { name: 'Parámetros legales', path: '/admin/parameters', icon: Receipt, permisos: ['parametros:leer'] },
    { name: 'Usuarios y roles', path: '/admin/usuarios', icon: Shield, permisos: ['usuarios:administrar', 'planilla:cerrar'] },
    { name: 'Reportes', path: '/admin/reports', icon: BarChart3, permisos: ['reportes:ver', 'reportes:ver_global'] },
  ].filter((l) => !l.permisos || tieneAlgunPermiso(user, l.permisos));

  const employeeLinks = [
    { name: 'Dashboard', path: '/employee', icon: LayoutDashboard },
    { name: 'Mi Perfil', path: '/employee/profile', icon: User },
    { name: 'Asistencia', path: '/employee/attendance', icon: CalendarClock },
    { name: 'Mis Solicitudes', path: '/employee/requests', icon: FileText },
    { name: 'Vacaciones', path: '/employee/vacations', icon: CalendarDays, permiso: 'vacaciones:leer' },
    { name: 'Mis recibos', path: '/employee/payroll', icon: Receipt, permiso: 'planilla:leer' },
  ].filter((l) => !l.permiso || tienePermiso(user, l.permiso) || (l.permiso === 'reportes:ver' && tienePermiso(user, 'reportes:ver_global')));

  const links = esRolAdministrativo(user) ? adminLinks : employeeLinks;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex transition-colors">
      {/* Mobile sidebar overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-brand-DEFAULT text-white transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:w-64
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-16 flex items-center px-6 border-b border-white/10">
          <div className="w-8 h-8 border border-white/40 flex items-center justify-center mr-3 shrink-0">
            <span className="font-serif font-bold text-white text-sm leading-none">MT</span>
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-[0.14em] uppercase text-white">Marketing Total</p>
            <p className="text-[10px] text-brand-200 tracking-widest uppercase">Gestión Humana</p>
          </div>
          <button
            className="ml-auto lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-4 border-b border-white/10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
              <User className="w-5 h-5 text-slate-300" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">{user?.nombres} {user?.apellidos}</p>
              <p className="text-xs text-slate-400 uppercase tracking-wider">{ETIQUETAS_ROL[user?.rol] || user?.rol}</p>
            </div>
          </div>
        </div>

        <nav className="p-4 space-y-1 overflow-y-auto h-[calc(100vh-145px)]">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.path || (location.pathname.startsWith(link.path) && link.path !== '/admin' && link.path !== '/employee');
            
            return (
              <Link
                key={link.name}
                to={link.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`
                  flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors
                  ${isActive
                    ? 'bg-white/10 text-white border-l-2 border-brand-200'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'}
                `}
              >
                <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-brand-200' : 'text-slate-400'}`} />
                {link.name}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 w-full p-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-3 py-2.5 text-sm font-medium text-slate-300 rounded-lg hover:bg-white/10 hover:text-white transition-colors"
          >
            <LogOut className="w-5 h-5 mr-3 text-slate-400" />
            Cerrar Sesión
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top header */}
        <header className="h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-4 sm:px-6 lg:px-8 z-10 transition-colors">
          <button
            className="lg:hidden text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </button>
          
          <div className="ml-auto flex items-center space-x-2">
            <ThemeToggle />
            <NotificationsMenu />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-50 dark:bg-slate-900 transition-colors">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
