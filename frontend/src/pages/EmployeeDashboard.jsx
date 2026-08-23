import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { CalendarClock, CheckCircle, Clock } from 'lucide-react';
import api from '../services/api';

export default function EmployeeDashboard() {
  const { user } = useAuthStore();
  const [attendanceStatus, setAttendanceStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const markAttendance = async () => {
    setLoading(true);
    try {
      const res = await api.post('/employee/attendance');
      alert(res.data.message);
      // Opcionalmente recargar estado
    } catch (error) {
      alert(error.response?.data?.message || 'Error al registrar asistencia');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-gradient-to-r from-brand-DEFAULT to-slate-800 rounded-2xl p-8 text-white shadow-lg">
        <h1 className="text-3xl font-bold">¡Hola, {user?.nombres}!</h1>
        <p className="mt-2 text-brand-light/90 text-lg">Bienvenido a tu portal del empleado.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Asistencia Rápida */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
            <CalendarClock className="w-5 h-5 mr-2 text-brand-blue" />
            Registro de Asistencia
          </h2>
          
          <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
            <Clock className="w-12 h-12 text-slate-400 mb-4" />
            <p className="text-slate-600 mb-6 text-center">Registra tu hora de entrada o salida con un solo clic.</p>
            
            <button
              onClick={markAttendance}
              disabled={loading}
              className="px-8 py-3 bg-brand-blue hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {loading ? 'Registrando...' : 'Marcar Asistencia'}
            </button>
          </div>
        </div>

        {/* Resumen */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
            <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
            Resumen Reciente
          </h2>
          <div className="space-y-4">
             <div className="p-4 rounded-lg bg-slate-50 border border-slate-100 flex justify-between items-center">
                <div>
                  <p className="font-medium text-slate-800">Vacaciones Anuales</p>
                  <p className="text-sm text-slate-500">Disponibles</p>
                </div>
                <span className="text-2xl font-bold text-brand-DEFAULT">14 días</span>
             </div>
             
             <div className="p-4 rounded-lg bg-slate-50 border border-slate-100 flex justify-between items-center">
                <div>
                  <p className="font-medium text-slate-800">Último Recibo de Nómina</p>
                  <p className="text-sm text-slate-500">Agosto 2026</p>
                </div>
                <button className="text-sm font-medium text-brand-blue hover:underline">Ver detalle</button>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
