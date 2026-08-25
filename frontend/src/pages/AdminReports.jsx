import { useEffect, useState } from 'react';
import { BarChart3, Download, RefreshCw } from 'lucide-react';
import api from '../services/api';
import { tienePermiso } from '../shared/roles';
import { useAuthStore } from '../store/useAuthStore';

const REPORTES = [
  { id: 'asistencia', nombre: 'Asistencia mensual' },
  { id: 'ausentismo', nombre: 'Ausentismo' },
  { id: 'personal-por-proyecto', nombre: 'Personal por proyecto' },
  { id: 'costo-planilla', nombre: 'Costo de planilla', global: true },
];

export default function AdminReports() {
  const user = useAuthStore((state) => state.user);
  const ahora = new Date();
  const [anio, setAnio] = useState(ahora.getFullYear());
  const [mes, setMes] = useState(ahora.getMonth() + 1);
  const [reporte, setReporte] = useState('asistencia');
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const reportesVisibles = REPORTES.filter((item) => !item.global || tienePermiso(user, 'reportes:ver_global'));

  const cargar = async () => {
    setCargando(true);
    setMensaje('');
    try {
      const respuesta = await api.get(`/admin/reportes/${reporte}`, { params: { anio, mes } });
      setFilas(respuesta.data.data ?? []);
    } catch (error) {
      setMensaje(error.response?.data?.message ?? 'No se pudo cargar el reporte.');
    } finally { setCargando(false); }
  };

  useEffect(() => {
    // react(set-state-in-effect) es intencional: sincroniza el reporte remoto.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reporte, anio, mes]);

  const descargar = async (formato) => {
    const respuesta = await api.get(`/admin/reportes/${reporte}`, { params: { anio, mes, formato }, responseType: 'blob' });
    const url = URL.createObjectURL(respuesta.data);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `${reporte}-${anio}-${mes}.${formato}`;
    enlace.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Reportes</h1><p className="text-slate-500 dark:text-slate-400 mt-1">Indicadores con alcance según tu rol.</p></div>
        <div className="flex gap-2"><button onClick={() => descargar('xlsx')} className="flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50"><Download className="w-4 h-4" /> XLSX</button><button onClick={() => descargar('pdf')} className="flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50"><Download className="w-4 h-4" /> PDF</button></div>
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex flex-wrap gap-3 items-end">
        <label className="text-sm text-slate-600 dark:text-slate-400">Reporte<select value={reporte} onChange={(event) => setReporte(event.target.value)} className="mt-1 block rounded-lg border-slate-300 dark:border-slate-600"><option value="">Seleccione</option>{reportesVisibles.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
        <label className="text-sm text-slate-600 dark:text-slate-400">Año<input type="number" value={anio} onChange={(event) => setAnio(Number(event.target.value))} className="mt-1 block w-28 rounded-lg border-slate-300 dark:border-slate-600" /></label>
        <label className="text-sm text-slate-600 dark:text-slate-400">Mes<input type="number" min="1" max="12" value={mes} onChange={(event) => setMes(Number(event.target.value))} className="mt-1 block w-24 rounded-lg border-slate-300 dark:border-slate-600" /></label>
        <button onClick={cargar} className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50" disabled={cargando}><RefreshCw className="w-4 h-4" /> {cargando ? 'Cargando...' : 'Actualizar'}</button>
      </div>
      {mensaje && <p className="text-red-600 dark:text-red-400">{mensaje}</p>}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-auto">
        {!filas.length ? <div className="p-10 text-center text-slate-500 dark:text-slate-400"><BarChart3 className="w-8 h-8 mx-auto mb-2" />Sin datos para el periodo seleccionado.</div> : <table className="min-w-full text-sm"><thead className="bg-slate-50 dark:bg-slate-800/60"><tr>{Object.keys(filas[0]).filter((key) => typeof filas[0][key] !== 'object').map((key) => <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-400" key={key}>{key}</th>)}</tr></thead><tbody>{filas.map((fila, index) => <tr className="border-t border-slate-100 dark:border-slate-700/60" key={fila.id ?? index}>{Object.entries(fila).filter(([, value]) => typeof value !== 'object').map(([key, value]) => <td className="px-4 py-3 text-slate-700 dark:text-slate-300" key={key}>{String(value ?? '')}</td>)}</tr>)}</tbody></table>}
      </div>
    </div>
  );
}
