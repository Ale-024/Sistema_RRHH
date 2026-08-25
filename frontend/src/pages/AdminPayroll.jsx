import { Fragment, useCallback, useEffect, useState } from 'react';
import { Calculator, CheckCircle2, ChevronDown, ChevronRight, FileText, Loader2, Plus, Send, XCircle } from 'lucide-react';
import api from '../services/api';
import { tienePermiso } from '../shared/roles';
import { useAuthStore } from '../store/useAuthStore';

const inicial = {
  codigo: '',
  tipo: 'ORDINARIA',
  periodicidad: 'MENSUAL',
  fechaInicio: '',
  fechaFin: '',
  fechaPago: '',
};

const estados = {
  BORRADOR: 'Borrador',
  CALCULADA: 'Calculada',
  EN_APROBACION: 'En aprobación',
  CERRADA: 'Cerrada',
  PAGADA: 'Pagada',
};

function normalizarPeriodos(payload) {
  const datos = payload?.data ?? payload;
  if (Array.isArray(datos)) return datos;
  return datos ? [datos] : [];
}

function mensajeError(error, fallback) {
  return error.response?.data?.detail || error.response?.data?.message || fallback;
}

export default function AdminPayroll() {
  const { user } = useAuthStore();
  const [periodos, setPeriodos] = useState([]);
  const [form, setForm] = useState(inicial);
  const [modal, setModal] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState('');
  const [expandido, setExpandido] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const respuesta = await api.get('/admin/payroll');
      setPeriodos(normalizarPeriodos(respuesta.data));
    } catch (error) {
      setMensaje(mensajeError(error, 'No fue posible cargar los periodos.'));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    // react(set-state-in-effect) es intencional: sincroniza datos remotos al montar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
  }, [cargar]);

  const crear = async (event) => {
    event.preventDefault();
    setProcesando('crear');
    setMensaje('');
    try {
      const respuesta = await api.post('/admin/payroll/periodos', form);
      const creado = respuesta.data?.data ?? respuesta.data;
      if (creado?.id) {
        setPeriodos((actuales) => [creado, ...actuales.filter((periodo) => periodo.id !== creado.id)]);
      }
      setModal(false);
      setForm(inicial);
      setMensaje('Periodo creado en borrador. Ahora puede calcularlo.');
      await cargar();
    } catch (error) {
      setMensaje(mensajeError(error, 'No fue posible crear el periodo.'));
    } finally {
      setProcesando('');
    }
  };

  const accion = async (periodo, ruta, motivo) => {
    const clave = `${periodo.id}:${ruta}`;
    setProcesando(clave);
    setMensaje('');
    try {
      const respuesta = await api.post(
        `/admin/payroll/periodos/${periodo.id}/${ruta}`,
        motivo ? { motivo } : {}
      );
      const actualizado = respuesta.data?.data ?? respuesta.data;

      // El backend devuelve el periodo calculado con sus detalles. Se pinta de
      // inmediato para no perder el resultado si la recarga posterior falla.
      if (actualizado?.id) {
        setPeriodos((actuales) =>
          actuales.map((item) => (item.id === actualizado.id ? { ...item, ...actualizado } : item))
        );
      }
      setMensaje(`Periodo ${periodo.codigo} actualizado.`);
      await cargar();
    } catch (error) {
      setMensaje(mensajeError(error, 'No fue posible actualizar el periodo.'));
    } finally {
      setProcesando('');
    }
  };

  return (
    <div className="animate-in fade-in duration-500 space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Planilla</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">Calcula, revisa y cierra periodos de nómina.</p>
        </div>
        {tienePermiso(user, 'planilla:crear') && (
          <button
            type="button"
            onClick={() => setModal(true)}
            className="flex items-center rounded-lg bg-brand-blue px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            disabled={Boolean(procesando)}
          >
            <Plus className="mr-1 h-5 w-5" /> Nuevo periodo
          </button>
        )}
      </div>

      {mensaje && <div className="rounded-lg bg-blue-50 dark:bg-blue-500/10 p-4 text-sm font-medium text-blue-700 dark:text-blue-400">{mensaje}</div>}

      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
            <thead className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs uppercase text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-6 py-4">Código</th>
                <th className="px-6 py-4">Fechas</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4 text-right">Empleados</th>
                <th className="px-6 py-4 text-right">Neto</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {periodos.map((periodo) => {
                const calculando = procesando === `${periodo.id}:calcular`;
                const abierto = expandido === periodo.id;
                const detalles = periodo.detalles ?? [];
                return (
                  <Fragment key={periodo.id}>
                  <tr className="border-b border-slate-100 dark:border-slate-700/60">
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                      <button
                        type="button"
                        onClick={() => setExpandido(abierto ? null : periodo.id)}
                        className="mr-2 inline-flex align-middle text-slate-400 hover:text-brand-blue"
                        title={abierto ? 'Ocultar empleados' : 'Ver empleados'}
                      >
                        {abierto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                      {periodo.codigo}
                      <div className="text-xs text-slate-500 dark:text-slate-400">{periodo.tipo}</div>
                    </td>
                    <td className="px-6 py-4 text-xs">
                      {new Date(periodo.fechaInicio).toLocaleDateString()} —{' '}
                      {new Date(periodo.fechaFin).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded-full bg-slate-100 dark:bg-slate-700 px-2.5 py-0.5 text-xs font-medium">
                        {calculando ? 'Calculando…' : estados[periodo.estado] || periodo.estado}
                      </span>
                      {periodo.errorCalculo && (
                        <div className="mt-1 max-w-xs text-xs text-red-600 dark:text-red-400">{periodo.errorCalculo}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">{periodo.detalles?.length ?? '—'}</td>
                    <td className="px-6 py-4 text-right font-mono">
                      L {((periodo.totalNetoCent || 0) / 100).toLocaleString('es-HN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {periodo.estado === 'BORRADOR' && tienePermiso(user, 'planilla:calcular') && (
                          <button
                            type="button"
                            onClick={() => accion(periodo, 'calcular')}
                            title="Calcular"
                            className="rounded-lg bg-blue-50 dark:bg-blue-500/10 p-2 text-blue-700 dark:text-blue-400 disabled:opacity-50"
                            disabled={Boolean(procesando)}
                          >
                            {calculando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
                          </button>
                        )}
                        {periodo.estado === 'CALCULADA' && tienePermiso(user, 'planilla:calcular') && (
                          <button
                            type="button"
                            onClick={() => accion(periodo, 'enviar-revision')}
                            title="Enviar a revisión"
                            className="rounded-lg bg-amber-50 dark:bg-amber-500/10 p-2 text-amber-700 dark:text-amber-400 disabled:opacity-50"
                            disabled={Boolean(procesando)}
                          >
                            <Send className="h-4 w-4" />
                          </button>
                        )}
                        {periodo.estado === 'EN_APROBACION' && tienePermiso(user, 'planilla:cerrar') && (
                          <button
                            type="button"
                            onClick={() => accion(periodo, 'cerrar')}
                            title="Cerrar"
                            className="rounded-lg bg-green-50 dark:bg-emerald-500/10 p-2 text-green-700 dark:text-emerald-400 disabled:opacity-50"
                            disabled={Boolean(procesando)}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                        )}
                        {periodo.estado === 'CERRADA' && tienePermiso(user, 'planilla:registrar_pago') && (
                          <button
                            type="button"
                            onClick={() => accion(periodo, 'registrar-pago')}
                            title="Registrar pago"
                            className="rounded-lg bg-green-50 dark:bg-emerald-500/10 p-2 text-green-700 dark:text-emerald-400 disabled:opacity-50"
                            disabled={Boolean(procesando)}
                          >
                            <FileText className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {abierto && (
                    <tr className="border-b border-slate-100 dark:border-slate-700/60 bg-slate-50/60">
                      <td colSpan="6" className="px-6 py-4">
                        <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                          Empleados en {periodo.codigo}
                        </p>
                        {detalles.length ? (
                          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                            <thead>
                              <tr className="text-xs uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                                <th className="px-4 py-2">Empleado</th>
                                <th className="px-4 py-2">Identificación</th>
                                <th className="px-4 py-2 text-right">Ingresos</th>
                                <th className="px-4 py-2 text-right">Deducciones</th>
                                <th className="px-4 py-2 text-right">Neto</th>
                              </tr>
                            </thead>
                            <tbody>
                              {detalles.map((d) => (
                                <tr key={d.id} className="border-b last:border-b-0 border-slate-100 dark:border-slate-700/60">
                                  <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-100">
                                    {d.empleado?.nombres} {d.empleado?.apellidos}
                                  </td>
                                  <td className="px-4 py-2 text-xs">{d.empleado?.dni || '—'}</td>
                                  <td className="px-4 py-2 text-right font-mono">
                                    L {((d.totalIngresosCent ?? 0) / 100).toLocaleString('es-HN', { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="px-4 py-2 text-right font-mono">
                                    L {((d.totalDeduccionesCent ?? 0) / 100).toLocaleString('es-HN', { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="px-4 py-2 text-right font-mono font-semibold text-green-700 dark:text-emerald-400">
                                    L {((d.netoPagarCent ?? 0) / 100).toLocaleString('es-HN', { minimumFractionDigits: 2 })}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <p className="text-sm text-slate-400">Este periodo aún no tiene empleados calculados.</p>
                        )}
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
              {cargando && !periodos.length && (
                <tr>
                  <td colSpan="6" className="p-12 text-center text-slate-400">Cargando periodos…</td>
                </tr>
              )}
              {!cargando && !periodos.length && (
                <tr>
                  <td colSpan="6" className="p-12 text-center text-slate-400">No hay periodos registrados.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white dark:bg-slate-800 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 px-6 py-4">
              <h3 className="font-bold text-slate-900 dark:text-slate-100">Nuevo periodo</h3>
              <button type="button" onClick={() => setModal(false)} aria-label="Cerrar" disabled={procesando === 'crear'}>
                <XCircle className="h-6 w-6 text-slate-400" />
              </button>
            </div>
            <form onSubmit={crear} className="grid gap-4 p-6">
              <input
                required
                placeholder="Código, ej. 2026-08-M"
                value={form.codigo}
                onChange={(event) => setForm({ ...form, codigo: event.target.value })}
                className="rounded-lg border border-slate-300 dark:border-slate-600 p-2.5"
              />
              <div className="grid grid-cols-2 gap-4">
                <select
                  value={form.tipo}
                  onChange={(event) => setForm({ ...form, tipo: event.target.value })}
                  className="rounded-lg border border-slate-300 dark:border-slate-600 p-2.5"
                >
                  <option value="ORDINARIA">Ordinaria</option>
                  <option value="DECIMO_TERCERO">Décimo tercero</option>
                  <option value="DECIMO_CUARTO">Décimo cuarto</option>
                  <option value="LIQUIDACION">Liquidación</option>
                </select>
                <select
                  value={form.periodicidad}
                  onChange={(event) => setForm({ ...form, periodicidad: event.target.value })}
                  className="rounded-lg border border-slate-300 dark:border-slate-600 p-2.5"
                >
                  <option value="MENSUAL">Mensual</option>
                  <option value="QUINCENAL">Quincenal</option>
                  <option value="SEMANAL">Semanal</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input required type="date" value={form.fechaInicio} onChange={(event) => setForm({ ...form, fechaInicio: event.target.value })} className="rounded-lg border border-slate-300 dark:border-slate-600 p-2.5" />
                <input required type="date" value={form.fechaFin} onChange={(event) => setForm({ ...form, fechaFin: event.target.value })} className="rounded-lg border border-slate-300 dark:border-slate-600 p-2.5" />
              </div>
              <label className="text-sm text-slate-600 dark:text-slate-400">
                Fecha de pago
                <input required type="date" value={form.fechaPago} onChange={(event) => setForm({ ...form, fechaPago: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 p-2.5" />
              </label>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setModal(false)} className="rounded-lg px-4 py-2 text-slate-600 dark:text-slate-400" disabled={procesando === 'crear'}>Cancelar</button>
                <button type="submit" className="rounded-lg bg-brand-blue px-4 py-2 font-medium text-white disabled:opacity-60" disabled={procesando === 'crear'}>
                  {procesando === 'crear' ? 'Creando…' : 'Crear periodo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
