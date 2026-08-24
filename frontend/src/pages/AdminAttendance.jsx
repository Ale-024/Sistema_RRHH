import { useState, useEffect } from 'react';
import api from '../services/api';
import { CalendarClock, Search, Filter } from 'lucide-react';

export default function AdminAttendance() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchAttendance();
  }, []);

  const fetchAttendance = async () => {
    try {
      const res = await api.get('/admin/attendance');
      setRecords(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (estado) => {
    switch (estado) {
      case 'PRESENTE': return <span className="bg-green-100 text-green-800 text-xs px-2.5 py-0.5 rounded-full font-medium">Presente</span>;
      case 'RETARDO': return <span className="bg-yellow-100 text-yellow-800 text-xs px-2.5 py-0.5 rounded-full font-medium">Retardo</span>;
      case 'FALTA': return <span className="bg-red-100 text-red-800 text-xs px-2.5 py-0.5 rounded-full font-medium">Falta</span>;
      default: return <span className="bg-slate-100 text-slate-600 text-xs px-2.5 py-0.5 rounded-full font-medium">{estado}</span>;
    }
  };

  const filtered = records.filter(r => {
    const matchesSearch = `${r.empleado?.nombres} ${r.empleado?.apellidos}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDate = dateFilter ? r.fecha_hora_entrada?.startsWith(dateFilter) : true;
    return matchesSearch && matchesDate;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Registro de Asistencia</h1>
        <p className="text-slate-500 mt-1">Control global de asistencia de todos los empleados</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar empleado..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-slate-400" />
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
          />
          <button onClick={() => setDateFilter('')} className="text-sm text-blue-600 hover:underline">Todas</button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Cargando...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-600">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Empleado</th>
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4">Hora Entrada</th>
                  <th className="px-6 py-4">Hora Salida</th>
                  <th className="px-6 py-4">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((rec) => (
                  <tr key={rec.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {rec.empleado?.nombres} {rec.empleado?.apellidos}
                    </td>
                    <td className="px-6 py-4">{rec.fecha_hora_entrada ? new Date(rec.fecha_hora_entrada).toLocaleDateString() : '—'}</td>
                    <td className="px-6 py-4">{rec.fecha_hora_entrada ? new Date(rec.fecha_hora_entrada).toLocaleTimeString() : '—'}</td>
                    <td className="px-6 py-4">{rec.fecha_hora_salida ? new Date(rec.fecha_hora_salida).toLocaleTimeString() : '—'}</td>
                    <td className="px-6 py-4">{getStatusBadge(rec.estado)}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan="5" className="px-6 py-12 text-center text-slate-400 flex flex-col items-center justify-center">
                    <CalendarClock className="w-10 h-10 mb-2 text-slate-300" />
                    No hay registros de asistencia
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
