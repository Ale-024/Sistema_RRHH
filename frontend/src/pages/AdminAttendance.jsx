import { useState, useEffect } from 'react';
import api from '../services/api';
import {
  CalendarClock, RefreshCw, Lock, Unlock, FileUp, Pencil, XCircle, Loader2,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { tienePermiso } from '../shared/roles';

const ESTILOS = {
  PRESENTE: 'bg-green-100 text-green-700',
  TARDANZA: 'bg-yellow-100 text-yellow-700',
  AUSENTE: 'bg-red-100 text-red-700',
  PERMISO: 'bg-purple-100 text-purple-700',
  VACACION: 'bg-purple-100 text-purple-700',
  FERIADO: 'bg-blue-100 text-blue-700',
  INCAPACIDAD: 'bg-orange-100 text-orange-700',
  DESCANSO: 'bg-slate-100 text-slate-600',
};

export default function AdminAttendance() {
  const { user } = useAuthStore();
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [ocupado, setOcupado] = useState(false);
  const [modalImportar, setModalImportar] = useState(false);
  const [textoLote, setTextoLote] = useState('');
  const [correccion, setCorreccion] = useState(null); // {id, estadoDia}
  const [motivoCorreccion, setMotivoCorreccion] = useState('');
  const [reapertura, setReapertura] = useState(null); // {empleadoId, fecha}
  const [motivoReapertura, setMotivoReapertura] = useState('');

  const cargar = async () => {
    setLoading(true);
    try {
      const params = {};
      if (desde) params.desde = desde;
      if (hasta) params.hasta = hasta;
      const res = await api.get('/admin/attendance', { params });
      setRegistros(res.data);
    } catch (error) {
      notificar('error', error.response?.data?.message || 'Error al cargar.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const notificar = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 6000);
  };

  const ejecutar = async (accion, ok) => {
    setOcupado(true);
    try {
      await accion();
      notificar('success', ok);
      await cargar();
    } catch (error) {
      notificar('error', error.response?.data?.message || 'Error en la operación.');
    } finally {
      setOcupado(false);
    }
  };

  const consolidarHoy = () =>
    ejecutar(
      () => api.post('/admin/asistencia/consolidar', {}),
      'Consolidado ejecutado.'
    );

  const cerrarRango = () => {
    if (!desde || !hasta) return notificar('error', 'Indica el rango de fechas para cerrar.');
    ejecutar(
      () =>
        api.post('/admin/asistencia/cierre', {
          desde: new Date(desde).toISOString(),
          hasta: new Date(`${hasta}T23:59:59`).toISOString(),
        }),
      'Cierre aplicado al rango.'
    );
  };

  const importarLote = () =>
    ejecutar(async () => {
      const eventos = textoLote
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const [idEmpleado, tipo, fecha, hora] = l.split(',').map((s) => s.trim());
          return {
            empleadoId: Number(idEmpleado),
            tipo: tipo.toUpperCase(),
            ocurridoEn: new Date(`${fecha}T${hora || '08:00'}`).toISOString(),
          };
        });
      const res = await api.post('/admin/asistencia/importar-lote', { eventos });
      setTextoLote('');
      setModalImportar(false);
      const r = res.data.reporte;
      if (r.rechazados.length) {
        const detalle = r.rechazados
          .slice(0, 3)
          .map((x) => `Línea ${x.indice + 1}: ${x.motivo}`)
          .join(' · ');
        notificar(
          'error',
          `${r.aceptados} aceptados, ${r.duplicados} duplicados, ${r.rechazados.length} rechazados. ${detalle}${r.rechazados.length > 3 ? ' …' : ''}`
        );
      } else {
        notificar(
          'success',
          `Importación: ${r.aceptados} aceptados, ${r.duplicados} duplicados.`
        );
      }
    }, null);

  const guardarCorreccion = () =>
    ejecutar(async () => {
      await api.patch(`/admin/asistencia/${correccion.id}`, {
        estadoDia: correccion.estadoDia,
        motivo: motivoCorreccion,
      });
      setCorreccion(null);
      setMotivoCorreccion('');
    }, 'Registro corregido y auditado.');

  const confirmarReapertura = () =>
    ejecutar(async () => {
      await api.post('/admin/asistencia/reapertura', {
        empleadoId: reapertura.empleadoId,
        fecha: reapertura.fecha,
        motivo: motivoReapertura,
      });
      setReapertura(null);
      setMotivoReapertura('');
    }, 'Dia reabierto.');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarClock className="w-6 h-6 text-blue-600" /> Control de asistencia
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Consolidado diario, cierre por rango, correcciones auditadas e importación.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {tienePermiso(user, 'asistencia:importar') && (
            <button onClick={consolidarHoy} disabled={ocupado} className="flex items-center px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg text-sm">
              <RefreshCw className={`w-4 h-4 mr-1 ${ocupado ? 'animate-spin' : ''}`} /> Consolidar hoy
            </button>
          )}
          {tienePermiso(user, 'asistencia:cerrar') && (
            <button onClick={cerrarRango} disabled={ocupado} className="flex items-center px-3 py-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-medium rounded-lg text-sm">
              <Lock className="w-4 h-4 mr-1" /> Cerrar rango
            </button>
          )}
          {tienePermiso(user, 'asistencia:importar') && (
            <button onClick={() => setModalImportar(true)} className="flex items-center px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg text-sm">
              <FileUp className="w-4 h-4 mr-1" /> Importar
            </button>
          )}
        </div>
      </div>

      {message.text && (
        <div className={`p-4 rounded-lg text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-300'}`}>
          {message.text}
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-end bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Desde</label>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Hasta</label>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm" />
        </div>
        <button onClick={cargar} className="px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-sm font-medium">
          Filtrar
        </button>
      </div>

      {/* Tabla */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Cargando...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Empleado</th>
                  <th className="px-4 py-3">Departamento</th>
                  <th className="px-4 py-3">Turno</th>
                  <th className="px-4 py-3">Entrada</th>
                  <th className="px-4 py-3">Salida</th>
                  <th className="px-4 py-3">Tardanza</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {registros.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {new Date(r.fecha).toLocaleDateString('es-HN')}
                      {r.cerrado && <span className="ml-1.5 text-[10px] uppercase bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded">cerrado</span>}
                    </td>
                    <td className="px-4 py-3">{r.empleado?.nombres} {r.empleado?.apellidos}</td>
                    <td className="px-4 py-3">{r.empleado?.puesto?.departamento?.nombre || '—'}</td>
                    <td className="px-4 py-3">{r.turno?.nombre || '—'}</td>
                    <td className="px-4 py-3">{r.horaEntrada ? new Date(r.horaEntrada).toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    <td className="px-4 py-3">{r.horaSalida ? new Date(r.horaSalida).toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    <td className="px-4 py-3">{r.minutosTardanza > 0 ? `${r.minutosTardanza}'` : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTILOS[r.estadoDia] || ESTILOS.DESCANSO}`}>{r.estadoDia}</span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap">
                      {!r.cerrado ? (
                        <>
                          {tienePermiso(user, 'asistencia:corregir') && (
                            <button
                              onClick={() => { setCorreccion({ id: r.id, estadoDia: r.estadoDia }); setMotivoCorreccion(''); }}
                              className="inline-flex items-center px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 rounded"
                              title="Corregir"
                            >
                              <Pencil className="w-3.5 h-3.5 mr-0.5" /> Corregir
                            </button>
                          )}
                          {tienePermiso(user, 'asistencia:cerrar') && (
                            <button
                              onClick={() =>
                                ejecutar(
                                  () => api.post('/admin/asistencia/cierre', { desde: r.fecha, hasta: r.fecha }),
                                  'Día cerrado.'
                                )
                              }
                              className="inline-flex items-center px-2 py-1 text-xs text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-700 rounded"
                              title="Cerrar día"
                            >
                              <Lock className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      ) : (
                        <button
                          onClick={() => { setReapertura({ empleadoId: r.empleadoId, fecha: r.fecha }); setMotivoReapertura(''); }}
                          className="inline-flex items-center px-2 py-1 text-xs text-orange-600 hover:bg-orange-50 dark:hover:bg-slate-700 rounded"
                          title="Reabrir día"
                        >
                          <Unlock className="w-3.5 h-3.5 mr-0.5" /> Reabrir
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {registros.length === 0 && (
                  <tr><td colSpan="9" className="px-6 py-12 text-center text-slate-400">Sin registros para el filtro actual.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal importar */}
      {modalImportar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
              <h3 className="font-bold text-slate-900 dark:text-white">Importar marcajes (lote)</h3>
              <button onClick={() => setModalImportar(false)}><XCircle className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Una línea por evento con formato:{' '}
                <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">idEmpleado,TIPO,YYYY-MM-DD,HH:mm</code>.
                Los duplicados se ignoran automáticamente.
              </p>
              <textarea
                rows="7"
                value={textoLote}
                onChange={(e) => setTextoLote(e.target.value)}
                placeholder={'3,ENTRADA,2026-08-25,07:55\n3,SALIDA,2026-08-25,17:10'}
                className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg font-mono text-sm bg-white dark:bg-slate-700"
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setModalImportar(false)} className="px-4 py-2 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">Cancelar</button>
                <button onClick={importarLote} disabled={ocupado || !textoLote.trim()} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg font-medium flex items-center">
                  {ocupado && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Importar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal corrección */}
      {correccion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-bold text-slate-900 dark:text-white">Corregir registro #{correccion.id}</h3>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Estado del día</label>
              <select
                value={correccion.estadoDia}
                onChange={(e) => setCorreccion({ ...correccion, estadoDia: e.target.value })}
                className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm"
              >
                {['PRESENTE', 'AUSENTE', 'TARDANZA', 'PERMISO', 'VACACION', 'INCAPACIDAD', 'DESCANSO', 'FERIADO'].map((e) => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Motivo (mínimo 10 caracteres)</label>
              <textarea rows="3" value={motivoCorreccion} onChange={(e) => setMotivoCorreccion(e.target.value)} className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700" />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setCorreccion(null)} className="px-4 py-2 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-sm">Cancelar</button>
              <button onClick={guardarCorreccion} disabled={ocupado || motivoCorreccion.trim().length < 10} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg font-medium text-sm">
                Guardar corrección
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal reapertura */}
      {reapertura && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-bold text-slate-900 dark:text-white">Reabrir día cerrado</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              La reapertura queda registrada en la bitácora de auditoría.
            </p>
            <textarea
              rows="3"
              value={motivoReapertura}
              onChange={(e) => setMotivoReapertura(e.target.value)}
              placeholder="Motivo (mínimo 10 caracteres)"
              className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setReapertura(null)} className="px-4 py-2 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-sm">Cancelar</button>
              <button onClick={confirmarReapertura} disabled={ocupado || motivoReapertura.trim().length < 10} className="px-5 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-40 text-white rounded-lg font-medium text-sm">
                Reabrir día
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
