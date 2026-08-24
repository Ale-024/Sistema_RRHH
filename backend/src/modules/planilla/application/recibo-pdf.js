function escapar(texto) {
  return String(texto ?? '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/** Generador PDF minimo y deterministico para recibos internos. */
function crearReciboPdf(detalle) {
  const { periodo, empleado } = detalle;
  const nombre = `${empleado.nombres} ${empleado.apellidos}`;
  const lineas = [
    'SIRH-MKT - RECIBO DE PLANILLA',
    `Empleado: ${nombre}`,
    `Periodo: ${periodo.codigo}`,
    `Desde: ${new Date(periodo.fechaInicio).toISOString().slice(0, 10)} Hasta: ${new Date(periodo.fechaFin).toISOString().slice(0, 10)}`,
    `Ingresos: L ${(detalle.totalIngresosCent / 100).toFixed(2)}`,
    `Deducciones: L ${(detalle.totalDeduccionesCent / 100).toFixed(2)}`,
    `Aportes patronales: L ${(detalle.totalAportesPatronalesCent / 100).toFixed(2)}`,
    `Neto a pagar: L ${(detalle.netoPagarCent / 100).toFixed(2)}`,
    '',
    ...detalle.lineas.map((linea) => `${linea.concepto.nombre}: L ${(linea.montoCent / 100).toFixed(2)}`),
  ];
  const contenido = ['BT', '/F1 11 Tf', '50 770 Td', ...lineas.flatMap((linea, indice) => [`(${escapar(linea)}) Tj`, indice === lineas.length - 1 ? '' : '0 -18 Td']), 'ET'].join('\n');
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
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
