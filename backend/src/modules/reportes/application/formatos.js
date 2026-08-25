// Generadores de archivos sin dependencias externas: XLSX (OOXML minimo)
// y PDF corporativo (banner de marca, tabla paginada y pie de pagina).

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
  const celda = (valor, estilo) => {
    if (typeof valor === 'number') return `<c t="n"${estilo ? ` s="${estilo}"` : ''}><v>${valor}</v></c>`;
    return `<c t="inlineStr"${estilo ? ` s="${estilo}"` : ''}><is><t>${xmlEscape(valor)}</t></is></c>`;
  };
  const encabezado = `<row>${columnas.map((columna) => celda(String(columna).toUpperCase(), 1)).join('')}</row>`;
  const cuerpo = filas.map((fila) => `<row>${columnas.map((columna) => celda(fila[columna] ?? '')).join('')}</row>`).join('');
  const anchos = columnas.map((columna) => `<col min="${columnas.indexOf(columna) + 1}" max="${columnas.indexOf(columna) + 1}" width="${Math.min(40, Math.max(12, String(columna).length + 6))}" customWidth="1"/>`).join('');
  const archivos = {
    '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    '_rels/.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Reporte" sheetId="1" r:id="rId1"/></sheets><styles r:id="rId2"/></workbook>',
    'xl/_rels/workbook.xml.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    'xl/styles.xml': '<?xml version="1.0"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="10"/><name val="Calibri"/></font><font><b/><sz val="10"/><color rgb="FF1F3D2B"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE3EDE6"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs></styleSheet>',
    'xl/worksheets/sheet1.xml': `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${anchos}</cols><sheetData>${encabezado}${cuerpo}</sheetData><autoFilter ref="A1:${String.fromCharCode(65 + Math.min(columnas.length - 1, 25))}${filas.length + 1}"/></worksheet>`,
  };
  return crearZip(archivos);
}

// ─────────────── PDF corporativo ───────────────

const PDF_VERDE = '0.122 0.239 0.169';   // #1f3d2b institucional
const PDF_GRIS_BANDA = '0.933 0.949 0.961';
const PDF_GRIS_FILA = '0.965 0.973 0.980';
const PDF_TEXTO = '0.118 0.161 0.212';
const PDF_GRIS_TEXTO = '0.420 0.470 0.520';

function escaparPdf(texto) {
  return String(texto).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function truncarPdf(texto, maxCaracteres) {
  const limpio = String(texto ?? '');
  return limpio.length <= maxCaracteres ? limpio : `${limpio.slice(0, Math.max(1, maxCaracteres - 1))}..`;
}

// Estimacion de ancho Helvetica: mayusculas ~0.66em, minusculas ~0.52em.
function anchoTexto(texto, tamano) {
  let ancho = 0;
  for (const ch of String(texto)) {
    ancho += (ch === ch.toUpperCase() && ch !== ch.toLowerCase() ? 0.66 : 0.52) * tamano;
  }
  return ancho;
}

// Trunca por ANCHO real (pt), no por numero de caracteres: evita encimados.
function truncarAncho(texto, anchoMax, tamano) {
  const limpio = String(texto ?? '');
  if (anchoTexto(limpio, tamano) <= anchoMax) return limpio;
  let cortado = limpio;
  while (cortado.length > 1 && anchoTexto(`${cortado}..`, tamano) > anchoMax) {
    cortado = cortado.slice(0, -1);
  }
  return `${cortado}..`;
}

function fechaLarga(fecha = new Date()) {
  return fecha.toLocaleDateString('es-HN', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * PDF corporativo: banner de marca, tabla con encabezado y filas alternadas,
 * paginacion automatica y pie con numeracion. Sin dependencias externas.
 */
// Texto con posicion ABSOLUTA (Tm): los Td encadenados acumulan offset y
// dibujan las columnas fuera de pagina. Cada celda es su propio BT/ET.
const celdaPdf = (texto, x, y, fuente, tamano, color) =>
  `BT /${fuente} ${tamano} Tf ${color} rg 1 0 0 1 ${Number(x).toFixed(2)} ${Number(y).toFixed(2)} Tm (${escaparPdf(texto)}) Tj ET`;

function crearPdfReporte(titulo, filas, meta = {}) {
  const anchoPagina = 612;
  const altoPagina = 792;
  const margenX = 36;
  const tablaAncho = anchoPagina - margenX * 2;

  const columnas = [...new Set(filas.flatMap((fila) => Object.keys(fila)))];
  const anchoCol = tablaAncho / Math.max(columnas.length, 1);
  const tamanoCelda = columnas.length > 7 ? 6.5 : 8;
  const tamanoEncabezado = columnas.length > 7 ? 6.5 : 7.5;
  const filaAlto = 16;
  const tablaY = altoPagina - 128;
  const filasPorPagina = Math.floor((tablaY - 60) / filaAlto);

  const grupos = [];
  for (let inicio = 0; inicio < filas.length; inicio += filasPorPagina) {
    grupos.push(filas.slice(inicio, inicio + filasPorPagina));
  }
  if (!grupos.length) grupos.push([]);
  const totalPaginas = grupos.length;

  const generado = `Generado: ${fechaLarga()}`;

  const contenidos = grupos.map((filasPagina, indice) => {
    const ops = [];
    const yBanner = altoPagina - 88;

    // Banner de marca
    ops.push(`${PDF_VERDE} rg`, `${margenX} ${yBanner} ${tablaAncho} 52 re f`);
    ops.push(celdaPdf('MARKETING TOTAL', margenX + 14, yBanner + 30, 'F2', 14, '1 1 1'));
    ops.push(celdaPdf(`Gestión Humana · Reporte de ${titulo}`, margenX + 14, yBanner + 13, 'F1', 9, '1 1 1'));
    ops.push(celdaPdf(generado, anchoPagina - margenX - 172, yBanner + 30, 'F1', 7.5, '0.85 0.92 0.88'));

    // Resumen
    ops.push(celdaPdf(`Registros: ${filas.length}${meta.periodo ? ` · ${meta.periodo}` : ''}`, margenX, yBanner - 20, 'F1', 8, '0.35 0.40 0.45'));

    // Encabezado de tabla
    let y = tablaY;
    ops.push(`${PDF_GRIS_BANDA} rg`, `${margenX} ${y - filaAlto + 5} ${tablaAncho} ${filaAlto} re f`);
    columnas.forEach((columna, i) => {
      ops.push(celdaPdf(truncarAncho(String(columna).toUpperCase(), anchoCol - 8, tamanoEncabezado), margenX + 5 + i * anchoCol, y - filaAlto + 10, 'F2', tamanoEncabezado, '0.10 0.15 0.12'));
    });

    // Filas alternadas
    y -= filaAlto;
    filasPagina.forEach((fila, indice) => {
      if (indice % 2 === 1) {
        ops.push(`${PDF_GRIS_FILA} rg`, `${margenX} ${y - filaAlto + 5} ${tablaAncho} ${filaAlto} re f`);
      }
      columnas.forEach((columna, i) => {
        ops.push(celdaPdf(truncarAncho(fila[columna], anchoCol - 8, tamanoCelda), margenX + 5 + i * anchoCol, y - filaAlto + 10, 'F1', tamanoCelda, PDF_TEXTO));
      });
      y -= filaAlto;
    });

    // Pie de pagina
    ops.push('0.78 0.82 0.86 RG 0.7 w', `${margenX} 46 m ${anchoPagina - margenX} 46 l S`);
    ops.push(celdaPdf('Marketing Total · SIRH-MKT - documento generado automaticamente', margenX, 34, 'F1', 7, PDF_GRIS_TEXTO));
    ops.push(celdaPdf(`Pagina ${indice + 1} de ${totalPaginas}`, anchoPagina - margenX - 78, 34, 'F1', 7, PDF_GRIS_TEXTO));

    return ops.join('\n');
  });

  // Ensamblado del PDF con paginas multiples
  const objetos = [];
  const idsHijos = [];
  const primerIdPagina = 5;
  contenidos.forEach((_, indice) => {
    const idPagina = primerIdPagina + indice * 2;
    idsHijos.push(`${idPagina} 0 R`);
  });
  objetos.push('<< /Type /Catalog /Pages 2 0 R >>');
  objetos.push(`<< /Type /Pages /Kids [${idsHijos.join(' ')}] /Count ${contenidos.length} >>`);
  // WinAnsiEncoding: sin esto los acentos (ó, é, í...) se pierden al renderizar.
  objetos.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  objetos.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  contenidos.forEach((contenido, indice) => {
    const idPagina = primerIdPagina + indice * 2;
    const idContenido = idPagina + 1;
    objetos.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${anchoPagina} ${altoPagina}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${idContenido} 0 R >>`);
    objetos.push(`<< /Length ${Buffer.byteLength(contenido, 'latin1')} >>\nstream\n${contenido}\nendstream`);
  });

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objetos.forEach((objeto, indice) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${indice + 1} 0 obj\n${objeto}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}

module.exports = { crearXlsx, crearPdfReporte };
