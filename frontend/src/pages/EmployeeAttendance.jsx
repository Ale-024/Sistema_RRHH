import { useState, useEffect } from 'react';
import api from '../services/api';
import { CalendarClock, Clock, CheckCircle2, XCircle } from 'lucide-react';

export default function EmployeeAttendance() {
  const [attendance, setAttendance] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [attRes, reqRes] = await Promise.all([
        api.get('/employee/attendance'),
        api.get('/employee/requests')
      ]);
      setAttendance(attRes.data);
      setRequests(reqRes.data.filter(r => r.estado === 'APROBADA'));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    try {
      await api.post('/employee/attendance');
      fetchData(); // Refresh data
    } catch (error) {
      alert(error.response?.data?.message || 'Error al registrar asistencia');
    }
  };

  // Calendar logic
  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  // Determine status of a specific day
  const getDayStatus = (day) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    // Check approved requests (leave)
    const leave = requests.find(r => {
      const start = new Date(r.fecha_inicio).toISOString().split('T')[0];
      const end = new Date(r.fecha_fin).toISOString().split('T')[0];
      return dateStr >= start && dateStr <= end;
    });

    if (leave) {
      return { type: 'leave', label: leave.tipo, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300' };
    }

    // Check attendance
    const record = attendance.find(a => a.fecha_hora_entrada.startsWith(dateStr));
    
    if (record) {
      if (record.estado === 'PRESENTE') return { type: 'present', label: 'Presente', color: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' };
      if (record.estado === 'RETARDO') return { type: 'late', label: 'Retardo', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300' };
      if (record.estado === 'FALTA') return { type: 'absent', label: 'Falta', color: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' };
    }

    // Past weekdays with no record = absent (simplification, excludes holidays/weekends)
    const dateObj = new Date(year, month, day);
    const today = new Date();
    today.setHours(0,0,0,0);
    
    if (dateObj < today && dateObj.getDay() !== 0 && dateObj.getDay() !== 6) {
      // It's a past weekday and no record was found, maybe absent
      return { type: 'missing', label: 'Sin registro', color: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' };
    }

    return null;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Mi Asistencia</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Registra tu entrada/salida y revisa tu historial</p>
        </div>
        <button 
          onClick={handleRegister}
          className="flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all hover:scale-105 active:scale-95"
        >
          <Clock className="w-5 h-5 mr-2" /> 
          Registrar Entrada / Salida
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
            <button onClick={prevMonth} className="px-3 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg shadow-sm hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors">&larr;</button>
            <h2 className="text-lg font-bold text-slate-800 dark:text-white capitalize">{monthNames[month]} {year}</h2>
            <button onClick={nextMonth} className="px-3 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg shadow-sm hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors">&rarr;</button>
          </div>
          
          <div className="p-4">
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => (
                <div key={d} className="text-center text-xs font-bold text-slate-400 uppercase py-2">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} className="h-20 rounded-lg bg-slate-50/50 dark:bg-slate-800/30 border border-transparent"></div>)}
              
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const status = getDayStatus(day);
                const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
                
                return (
                  <div key={day} className={`h-20 rounded-lg border p-1.5 flex flex-col ${isToday ? 'border-blue-500 dark:border-blue-400 bg-blue-50/30 dark:bg-blue-900/10' : 'border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800'}`}>
                    <span className={`text-sm font-semibold ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>{day}</span>
                    {status && (
                      <div className={`mt-auto text-[10px] sm:text-xs font-medium px-1.5 py-0.5 rounded flex items-center justify-center text-center ${status.color}`}>
                        {status.label}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Legend / Stats */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Leyenda</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3"><div className="w-4 h-4 rounded-full bg-green-500"></div><span className="text-sm text-slate-600 dark:text-slate-300">Presente</span></div>
              <div className="flex items-center gap-3"><div className="w-4 h-4 rounded-full bg-yellow-500"></div><span className="text-sm text-slate-600 dark:text-slate-300">Retardo</span></div>
              <div className="flex items-center gap-3"><div className="w-4 h-4 rounded-full bg-red-500"></div><span className="text-sm text-slate-600 dark:text-slate-300">Falta</span></div>
              <div className="flex items-center gap-3"><div className="w-4 h-4 rounded-full bg-purple-500"></div><span className="text-sm text-slate-600 dark:text-slate-300">Vacaciones / Permiso</span></div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Últimos Registros</h3>
            {loading ? (
              <p className="text-sm text-slate-500">Cargando...</p>
            ) : attendance.length === 0 ? (
              <p className="text-sm text-slate-500">No hay registros recientes</p>
            ) : (
              <div className="space-y-4">
                {attendance.slice(0, 5).map(a => (
                  <div key={a.id} className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-700 last:border-0 last:pb-0">
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{new Date(a.fecha_hora_entrada).toLocaleDateString()}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {new Date(a.fecha_hora_entrada).toLocaleTimeString()} 
                        {a.fecha_hora_salida && ` - ${new Date(a.fecha_hora_salida).toLocaleTimeString()}`}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      a.estado === 'PRESENTE' ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' :
                      a.estado === 'RETARDO' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300' :
                      'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                    }`}>
                      {a.estado}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
