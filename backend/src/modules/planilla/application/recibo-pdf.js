function escapar(texto) {
  return String(texto ?? '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

// Paleta corporativa Marketing Total
const VERDE_OSCURO = '0.122 0.239 0.169'; // #1F3D2B
const VERDE_ACENTO = '0.180 0.420 0.310'; // #2E6B4F
const GRIS_CLARO = '0.945 0.957 0.949';
const GRIS_TEXTO = '0.42 0.45 0.44';
const TINTA = '0.13 0.15 0.14';
const VERDE_PALIDO_TEXTO = '0.78 0.86 0.80';

const MARGEN_IZQ = 50;
const X_DER = 562; // borde derecho para montos
const ANCHO_UTILES = X_DER - MARGEN_IZQ;

/** Anchura exacta en Courier-Bold (600/1000 por punto): alinea montos. */
function anchoCourier(texto, tamano) {
  return String(texto).length * 0.6 * tamano;
}

/** Operacion de texto autocontenida (BT..ET). */
function texto(x, y, contenido, fuente, tamano, color) {
  return `${color} rg BT /${fuente} ${tamano} Tf ${x} ${y} Td (${escapar(contenido)}) Tj ET`;
}

function banda(y, alto, color) {
  return `${color} rg ${MARGEN_IZQ} ${y} ${ANCHO_UTILES} ${alto} re f`;
}

function lineaHorizontal(y) {
  return `0.85 0.88 0.86 RG 0.7 w ${MARGEN_IZQ + 12} ${y} m ${X_DER} ${y} l S`;
}

/**
 * Recibo de planilla con identidad corporativa.
 * PDF 1.4 minimo, deterministico y sin dependencias externas.
 */
function crearReciboPdf(detalle) {
  const { periodo, empleado } = detalle;
  const nombre = `${empleado.nombres} ${empleado.apellidos}`;
  const fmt = (cent) => (cent / 100).toFixed(2);
  const fechaCorta = (iso) => new Date(iso).toISOString().slice(0, 10);
  const estados = {
    BORRADOR: 'Borrador',
    CALCULADA: 'Calculada',
    EN_APROBACION: 'En aprobacion',
    CERRADA: 'Cerrada',
    PAGADA: 'Pagada',
  };

  const ingresos = detalle.lineas.filter((l) => l.concepto.tipo === 'INGRESO');
  const deducciones = detalle.lineas.filter((l) => l.concepto.tipo === 'DEDUCCION');
  const aportes = detalle.lineas.filter((l) => l.concepto.tipo === 'APORTE_PATRONAL');

  const op = [];

  // ── Encabezado corporativo ──
  op.push(banda(746, 46, VERDE_OSCURO));
  op.push(texto(MARGEN_IZQ, 764, 'MARKETING TOTAL', 'F2', 15, '1 1 1'));
  op.push(texto(MARGEN_IZQ, 752, 'Gestion Humana · Recibo de Planilla', 'F1', 8, VERDE_PALIDO_TEXTO));
  op.push(texto(X_DER - anchoCourier(periodo.codigo, 11), 764, periodo.codigo, 'F3', 11, '1 1 1'));
  op.push(texto(X_DER - anchoCourier(estados[periodo.estado] || periodo.estado, 8), 752, estados[periodo.estado] || periodo.estado, 'F1', 8, VERDE_PALIDO_TEXTO));

  // ── Datos del comprobante ──
  let y = 716;
  const filasInfo = [
    ['Empleado', nombre, 'Periodo', `${fechaCorta(periodo.fechaInicio)} al ${fechaCorta(periodo.fechaFin)}`],
    ['Identificacion', String(empleado.dni || '-'), 'Fecha de pago', fechaCorta(periodo.fechaPago)],
    ['Codigo de periodo', periodo.codigo, 'Tipo de planilla', periodo.tipo],
  ];
  for (const [e1, v1, e2, v2] of filasInfo) {
    op.push(texto(MARGEN_IZQ, y, e1.toUpperCase(), 'F1', 7, GRIS_TEXTO));
    op.push(texto(MARGEN_IZQ, y - 11, v1, 'F2', 10, TINTA));
    op.push(texto(310, y, e2.toUpperCase(), 'F1', 7, GRIS_TEXTO));
    op.push(texto(310, y - 11, v2, 'F2', 10, TINTA));
    y -= 34;
  }
  y -= 4;
  op.push(lineaHorizontal(y));
  y -= 24;

  // ── Seccion INGRESOS ──
  op.push(banda(y - 4, 18, GRIS_CLARO));
  op.push(texto(58, y + 1, 'INGRESOS', 'F2', 9, VERDE_ACENTO));
  y -= 21;
  for (const linea of ingresos) {
    op.push(texto(58, y, linea.concepto.nombre, 'F1', 10, TINTA));
    op.push(texto(X_DER - anchoCourier(`L ${fmt(linea.montoCent)}`, 10), y, `L ${fmt(linea.montoCent)}`, 'F3', 10, TINTA));
    y -= 17;
  }
  if (!ingresos.length) {
    op.push(texto(58, y, 'Sin ingresos registrados.', 'F1', 9, GRIS_TEXTO));
    y -= 17;
  }
  op.push(texto(58, y, 'Total ingresos', 'F2', 10, TINTA));
  op.push(texto(X_DER - anchoCourier(`L ${fmt(detalle.totalIngresosCent)}`, 10), y, `L ${fmt(detalle.totalIngresosCent)}`, 'F3', 10, TINTA));
  y -= 28;

  // ── Seccion DEDUCCIONES ──
  op.push(banda(y - 4, 18, GRIS_CLARO));
  op.push(texto(58, y + 1, 'DEDUCCIONES', 'F2', 9, VERDE_ACENTO));
  y -= 21;
  for (const linea of deducciones) {
    op.push(texto(58, y, linea.concepto.nombre, 'F1', 10, TINTA));
    op.push(texto(X_DER - anchoCourier(`L ${fmt(linea.montoCent)}`, 10), y, `L ${fmt(linea.montoCent)}`, 'F3', 10, TINTA));
    y -= 17;
  }
  if (!deducciones.length) {
    op.push(texto(58, y, 'Sin deducciones en este periodo.', 'F1', 9, GRIS_TEXTO));
    y -= 17;
  }
  op.push(texto(58, y, 'Total deducciones', 'F2', 10, TINTA));
  op.push(texto(X_DER - anchoCourier(`L ${fmt(detalle.totalDeduccionesCent)}`, 10), y, `L ${fmt(detalle.totalDeduccionesCent)}`, 'F3', 10, TINTA));
  y -= 26;

  // ── Aportes patronales (informativo) ──
  if (aportes.length) {
    const totalAportes = aportes.reduce((suma, l) => suma + l.montoCent, 0);
    op.push(texto(58, y, 'Aportes patronales (no afectan tu pago)', 'F1', 8, GRIS_TEXTO));
    op.push(texto(X_DER - anchoCourier(`L ${fmt(totalAportes)}`, 8), y, `L ${fmt(totalAportes)}`, 'F3', 8, GRIS_TEXTO));
    y -= 16;
  }

  // ── Caja del neto ──
  y -= 8;
  op.push(banda(y - 12, 40, VERDE_OSCURO));
  op.push(texto(58, y + 2, 'NETO RECIBIDO', 'F2', 11, '1 1 1'));
  const netoTexto = `L ${fmt(detalle.netoPagarCent)}`;
  op.push(texto(X_DER - anchoCourier(netoTexto, 16), y - 2, netoTexto, 'F3', 16, '1 1 1'));

  // ── Pie del documento ──
  op.push(lineaHorizontal(64));
  op.push(texto(MARGEN_IZQ, 52, 'Documento generado electronicamente por SIRH-MKT.', 'F1', 7, GRIS_TEXTO));
  op.push(texto(MARGEN_IZQ, 42, `Emitido el ${new Date().toISOString().slice(0, 10)}. Conserve este recibo para sus registros.`, 'F1', 7, GRIS_TEXTO));

  const contenido = op.join('\n');
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >> >> /Contents 7 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold >>',
    `<< /Length ${Buffer.byteLength(contenido, 'latin1')} >>\nstream\n${contenido}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objetos.forEach((objeto, indice) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${indice + 1} 0 obj\n${objeto}\nendobj\n`;
  });
  const inicioXref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}

module.exports = { crearReciboPdf };
