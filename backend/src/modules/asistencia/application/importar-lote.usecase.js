const { hashEvento } = require('./hash-evento');

/**
 * Importacion de marcajes por lote (reloj biometrico o archivos).
 * Deduplicacion por hashEvento: reenviar el mismo lote no duplica
 * registros. Devuelve un reporte de aceptados, duplicados y rechazados.
 */
async function importarLote(eventos, ctx) {
  const { prisma } = ctx;
  const reporte = { total: eventos.length, aceptados: 0, duplicados: 0, rechazados: [] };

  for (let i = 0; i < eventos.length; i++) {
    const e = eventos[i];
    try {
      const empleadoId = Number(e.empleadoId);
      const ocurridoEn = new Date(e.ocurridoEn);
      if (!Number.isInteger(empleadoId) || empleadoId <= 0) {
        throw new Error('empleadoId invalido');
      }
      if (Number.isNaN(ocurridoEn.getTime())) {
        throw new Error('fecha invalida');
      }
      const tipo = String(e.tipo).toUpperCase();
      if (!['ENTRADA', 'SALIDA'].includes(tipo)) {
        throw new Error(`tipo invalido: ${e.tipo}`);
      }

      const existeEmpleado = await prisma.empleado.findUnique({ where: { id: empleadoId }, select: { id: true } });
      if (!existeEmpleado) throw new Error('empleado inexistente');

      try {
        await prisma.marcaje.create({
          data: {
            empleadoId,
            ocurridoEn,
            tipo,
            origen: 'IMPORTADO',
            dispositivo: e.dispositivo ?? 'importacion',
            hashEvento: hashEvento(empleadoId, ocurridoEn, tipo),
          },
        });
        reporte.aceptados++;
      } catch (errorColision) {
        if (errorColision.code === 'P2002') {
          // El mismo evento ya fue importado: deduplicado por hashEvento.
          reporte.duplicados++;
        } else {
          throw errorColision;
        }
      }
    } catch (error) {
      reporte.rechazados.push({ indice: i, motivo: error.message });
    }
  }

  return reporte;
}

module.exports = { importarLote };
