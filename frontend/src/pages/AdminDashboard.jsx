import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { Users, FileText, CalendarClock, Activity } from 'lucide-react';
import api from '../services/api';

export default function AdminDashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState({ employees: 0, requests: 0 });

  useEffect(() => {
    // In a real app, you would fetch these from a /api/admin/stats endpoint
    const fetchStats = async () => {
      try {
        const empRes = await api.get('/admin/employees');
        const reqRes = await api.get('/admin/requests');
        setStats({
          employees: empRes.data.length,
          requests: reqRes.data.filter(r => r.estado === 'PENDIENTE').length
        });
      } catch (error) {
        console.error("Error fetching stats", error);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard Administrativo</h1>
        <p className="text-slate-500 mt-1">Bienvenido de nuevo, {user?.nombres}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center">
          <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mr-4">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Total Empleados</p>
            <h3 className="text-2xl font-bold text-slate-900">{stats.employees}</h3>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center">
          <div className="w-12 h-12 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center mr-4">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Solicitudes Pendientes</p>
            <h3 className="text-2xl font-bold text-slate-900">{stats.requests}</h3>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center">
          <div className="w-12 h-12 rounded-lg bg-green-50 text-green-600 flex items-center justify-center mr-4">
            <CalendarClock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Presentes Hoy</p>
            <h3 className="text-2xl font-bold text-slate-900">--</h3>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center">
          <div className="w-12 h-12 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mr-4">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Ausencias</p>
            <h3 className="text-2xl font-bold text-slate-900">--</h3>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Módulos Administrativos</h2>
        <p className="text-slate-600">Utilice el menú lateral para gestionar empleados, asistencia, solicitudes y nómina.</p>
      </div>
    </div>
  );
}
