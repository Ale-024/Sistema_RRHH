function xmlEscape(valor) {
  return String(valor ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u32(numero) { const buffer = Buffer.alloc(4); buffer.writeUInt32LE(numero >>> 0); return buffer; }
function u16(numero) { const buffer = Buffer.alloc(2); buffer.writeUInt16LE(numero); return buffer; }

function crearZip(archivos) {
  const locales = [];
  const centrales = [];
  let offset = 0;
  for (const [nombre, contenido] of Object.entries(archivos)) {
    const nombreBuffer = Buffer.from(nombre);
    const datos = Buffer.from(contenido);
    const crc = crc32(datos);
    const local = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(datos.length), u32(datos.length), u16(nombreBuffer.length), u16(0), nombreBuffer, datos]);
    locales.push(local);
    centrales.push(Buffer.concat([Buffer.from([0x50, 0x4b, 0x01, 0x02]), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(datos.length), u32(datos.length), u16(nombreBuffer.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), nombreBuffer]));
    offset += local.length;
  }
  const central = Buffer.concat(centrales);
  return Buffer.concat([...locales, central, Buffer.from([0x50, 0x4b, 0x05, 0x06]), Buffer.alloc(6), u16(centrales.length), u16(centrales.length), u32(central.length), u32(offset), u16(0)]);
}

function crearXlsx(filas) {
  const columnas = [...new Set(filas.flatMap((fila) => Object.keys(fila)))];
  const celda = (valor) => typeof valor === 'number' ? `<c t="n"><v>${valor}</v></c>` : `<c t="inlineStr"><is><t>${xmlEscape(valor)}</t></is></c>`;
  const filasXml = [columnas, ...filas.map((fila) => columnas.map((columna) => fila[columna] ?? '').join('\u0000'))].map((fila, indice) => {
    const valores = indice === 0 ? fila : fila.split('\u0000');
    return `<row>${valores.map(celda).join('')}</row>`;
  }).join('');
  const archivos = {
    '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Reporte" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${filasXml}</sheetData></worksheet>`,
  };
  return crearZip(archivos);
}

function crearPdfReporte(titulo, filas) {
  const lineas = [titulo, `Generado: ${new Date().toISOString()}`, '', ...filas.slice(0, 40).map((fila) => Object.values(fila).join(' | '))];
  const escapar = (texto) => String(texto).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const contenido = ['BT', '/F1 8 Tf', '40 760 Td', ...lineas.flatMap((linea, indice) => [`(${escapar(linea.slice(0, 150))}) Tj`, indice === lineas.length - 1 ? '' : '0 -14 Td']), 'ET'].join('\n');
  const objetos = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${Buffer.byteLength(contenido, 'latin1')} >>\nstream\n${contenido}\nendstream`];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objetos.forEach((objeto, indice) => { offsets.push(Buffer.byteLength(pdf, 'latin1')); pdf += `${indice + 1} 0 obj\n${objeto}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}

module.exports = { crearXlsx, crearPdfReporte };
