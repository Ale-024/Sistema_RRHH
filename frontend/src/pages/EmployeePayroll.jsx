import { useCallback, useEffect, useState } from 'react';
import { Download, FileText } from 'lucide-react';
import api from '../services/api';

export default function EmployeePayroll() {
  const [periodos, setPeriodos] = useState([]); const [mensaje, setMensaje] = useState('');
  const cargar = useCallback(async () => { try { const respuesta = await api.get('/employee/payroll'); setPeriodos(respuesta.data); } catch { setMensaje('No fue posible cargar tus recibos.'); } }, []);
  useEffect(() => {
    // react(set-state-in-effect) es intencional: sincroniza datos remotos al montar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
  }, [cargar]);
  const descargar = async (detalleId, codigo) => { try { const respuesta = await api.get(`/employee/payroll/recibos/${detalleId}`, { responseType: 'blob' }); const url = URL.createObjectURL(respuesta.data); const enlace = document.createElement('a'); enlace.href = url; enlace.download = `recibo-${codigo}.pdf`; enlace.click(); URL.revokeObjectURL(url); } catch { setMensaje('No fue posible descargar el recibo.'); } };
  return <div className="animate-in fade-in duration-500 space-y-6"><div><h1 className="text-2xl font-bold text-slate-900">Mis recibos de planilla</h1><p className="mt-1 text-slate-500">Consulta el detalle de tus ingresos y deducciones.</p></div>{mensaje && <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-700">{mensaje}</div>}<div className="grid gap-4 md:grid-cols-2">{periodos.map((periodo) => { const detalle = periodo.detalles?.[0]; return <div key={periodo.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><p className="font-semibold text-slate-900">{periodo.codigo}</p><p className="text-xs text-slate-500">{new Date(periodo.fechaInicio).toLocaleDateString()} — {new Date(periodo.fechaFin).toLocaleDateString()}</p></div><span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs">{periodo.estado}</span></div>{detalle && <><p className="mt-4 text-2xl font-bold text-green-700">L {(detalle.netoPagarCent / 100).toLocaleString('es-HN', { minimumFractionDigits: 2 })}</p><p className="text-xs text-slate-500">Bruto L {(detalle.totalIngresosCent / 100).toLocaleString('es-HN', { minimumFractionDigits: 2 })} · Deducciones L {(detalle.totalDeduccionesCent / 100).toLocaleString('es-HN', { minimumFractionDigits: 2 })}</p><button onClick={() => descargar(detalle.id, periodo.codigo)} className="mt-4 inline-flex items-center rounded-lg bg-brand-blue px-3 py-2 text-sm font-medium text-white"><Download className="mr-2 h-4 w-4" /> Descargar recibo PDF</button></>}</div>; })}{!periodos.length && <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center text-slate-500 md:col-span-2"><FileText className="mx-auto mb-3 h-10 w-10 text-slate-300" />Aún no tienes recibos publicados.</div>}</div></div>;
}
