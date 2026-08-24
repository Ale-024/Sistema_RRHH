-- Fase 6: planilla (CU05).
-- Nomina se conserva como tabla legacy; los nuevos ciclos usan periodos,
-- detalles y lineas con importes enteros en centavos.

CREATE TABLE "Concepto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "gravableIsr" BOOLEAN NOT NULL DEFAULT true,
    "afectaIhss" BOOLEAN NOT NULL DEFAULT true,
    "formulaClave" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE "PeriodoPlanilla" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "codigo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "periodicidad" TEXT NOT NULL,
    "fechaInicio" DATETIME NOT NULL,
    "fechaFin" DATETIME NOT NULL,
    "fechaPago" DATETIME NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'BORRADOR',
    "periodoAjusteDeId" INTEGER,
    "totalBrutoCent" INTEGER NOT NULL DEFAULT 0,
    "totalDeduccionesCent" INTEGER NOT NULL DEFAULT 0,
    "totalNetoCent" INTEGER NOT NULL DEFAULT 0,
    "totalAportesPatronalesCent" INTEGER NOT NULL DEFAULT 0,
    "calculadoPor" INTEGER,
    "calculadoEn" DATETIME,
    "errorCalculo" TEXT,
    "cerradoPor" INTEGER,
    "cerradoEn" DATETIME,
    "hashCierre" TEXT,
    "pagadoPor" INTEGER,
    "pagadoEn" DATETIME,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PeriodoPlanilla_periodoAjusteDeId_fkey" FOREIGN KEY ("periodoAjusteDeId") REFERENCES "PeriodoPlanilla" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "DetallePlanilla" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "periodoId" INTEGER NOT NULL,
    "empleadoId" INTEGER NOT NULL,
    "contratoSnapshot" TEXT NOT NULL,
    "parametrosSnapshot" TEXT NOT NULL,
    "diasTrabajados" REAL NOT NULL,
    "horasExtra" REAL NOT NULL DEFAULT 0,
    "totalIngresosCent" INTEGER NOT NULL,
    "totalDeduccionesCent" INTEGER NOT NULL,
    "totalAportesPatronalesCent" INTEGER NOT NULL DEFAULT 0,
    "netoPagarCent" INTEGER NOT NULL,
    "reciboRuta" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DetallePlanilla_periodoId_fkey" FOREIGN KEY ("periodoId") REFERENCES "PeriodoPlanilla" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DetallePlanilla_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "LineaConcepto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "detalleId" INTEGER NOT NULL,
    "conceptoId" INTEGER NOT NULL,
    "baseCalculoCent" INTEGER NOT NULL,
    "cantidad" REAL,
    "montoCent" INTEGER NOT NULL,
    "detalleCalculo" TEXT NOT NULL,
    CONSTRAINT "LineaConcepto_detalleId_fkey" FOREIGN KEY ("detalleId") REFERENCES "DetallePlanilla" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LineaConcepto_conceptoId_fkey" FOREIGN KEY ("conceptoId") REFERENCES "Concepto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Concepto_codigo_key" ON "Concepto"("codigo");
CREATE UNIQUE INDEX "PeriodoPlanilla_codigo_key" ON "PeriodoPlanilla"("codigo");
CREATE UNIQUE INDEX "DetallePlanilla_periodoId_empleadoId_key" ON "DetallePlanilla"("periodoId", "empleadoId");
CREATE INDEX "PeriodoPlanilla_estado_fechaPago_idx" ON "PeriodoPlanilla"("estado", "fechaPago");
CREATE INDEX "PeriodoPlanilla_fechaInicio_fechaFin_idx" ON "PeriodoPlanilla"("fechaInicio", "fechaFin");
CREATE INDEX "DetallePlanilla_empleadoId_idx" ON "DetallePlanilla"("empleadoId");
CREATE INDEX "LineaConcepto_detalleId_idx" ON "LineaConcepto"("detalleId");

-- Catalogo minimo inicial. Las tasas y techos se parametrizan por vigencia;
-- estos valores son la referencia operativa documentada para 2026.
INSERT INTO "Concepto" ("codigo", "nombre", "tipo", "gravableIsr", "afectaIhss", "formulaClave", "orden")
SELECT 'SUELDO', 'Sueldo ordinario', 'INGRESO', 1, 1, 'SUELDO', 10
WHERE NOT EXISTS (SELECT 1 FROM "Concepto" WHERE "codigo" = 'SUELDO');
INSERT INTO "Concepto" ("codigo", "nombre", "tipo", "gravableIsr", "afectaIhss", "formulaClave", "orden")
SELECT 'H_EXTRA_D', 'Hora extra diurna', 'INGRESO', 1, 1, 'H_EXTRA_D', 20
WHERE NOT EXISTS (SELECT 1 FROM "Concepto" WHERE "codigo" = 'H_EXTRA_D');
INSERT INTO "Concepto" ("codigo", "nombre", "tipo", "gravableIsr", "afectaIhss", "formulaClave", "orden")
SELECT 'H_EXTRA_N', 'Hora extra nocturna', 'INGRESO', 1, 1, 'H_EXTRA_N', 21
WHERE NOT EXISTS (SELECT 1 FROM "Concepto" WHERE "codigo" = 'H_EXTRA_N');
INSERT INTO "Concepto" ("codigo", "nombre", "tipo", "gravableIsr", "afectaIhss", "formulaClave", "orden")
SELECT 'IHSS_EM_TRAB', 'IHSS trabajador', 'DEDUCCION', 0, 0, 'IHSS_EM_TRAB', 40
WHERE NOT EXISTS (SELECT 1 FROM "Concepto" WHERE "codigo" = 'IHSS_EM_TRAB');
INSERT INTO "Concepto" ("codigo", "nombre", "tipo", "gravableIsr", "afectaIhss", "formulaClave", "orden")
SELECT 'RAP_TRAB', 'RAP trabajador', 'DEDUCCION', 0, 0, 'RAP_TRAB', 50
WHERE NOT EXISTS (SELECT 1 FROM "Concepto" WHERE "codigo" = 'RAP_TRAB');
INSERT INTO "Concepto" ("codigo", "nombre", "tipo", "gravableIsr", "afectaIhss", "formulaClave", "orden")
SELECT 'ISR', 'Impuesto sobre la renta', 'DEDUCCION', 0, 0, 'ISR', 60
WHERE NOT EXISTS (SELECT 1 FROM "Concepto" WHERE "codigo" = 'ISR');
INSERT INTO "Concepto" ("codigo", "nombre", "tipo", "gravableIsr", "afectaIhss", "formulaClave", "orden")
SELECT 'IHSS_EM_PATR', 'IHSS patronal', 'APORTE_PATRONAL', 0, 0, 'IHSS_EM_PATR', 70
WHERE NOT EXISTS (SELECT 1 FROM "Concepto" WHERE "codigo" = 'IHSS_EM_PATR');
INSERT INTO "Concepto" ("codigo", "nombre", "tipo", "gravableIsr", "afectaIhss", "formulaClave", "orden")
SELECT 'RAP_PATR', 'RAP patronal', 'APORTE_PATRONAL', 0, 0, 'RAP_PATR', 80
WHERE NOT EXISTS (SELECT 1 FROM "Concepto" WHERE "codigo" = 'RAP_PATR');

INSERT INTO "ParametroLegal" ("clave", "valor", "unidad", "descripcion", "baseLegal", "vigenciaDesde")
SELECT 'IHSS_EM_TRAB', '0.025', 'PORCENTAJE', 'IHSS Enfermedad y Maternidad trabajador', 'Ley de aportaciones y cotizaciones del IHSS', '2020-01-01T00:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM "ParametroLegal" WHERE "clave" = 'IHSS_EM_TRAB' AND "vigenciaDesde" = '2020-01-01T00:00:00.000Z');
INSERT INTO "ParametroLegal" ("clave", "valor", "unidad", "descripcion", "baseLegal", "vigenciaDesde")
SELECT 'IHSS_IVM_TRAB', '0.025', 'PORCENTAJE', 'IHSS Invalidez, Vejez y Muerte trabajador', 'Ley de aportaciones y cotizaciones del IHSS', '2020-01-01T00:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM "ParametroLegal" WHERE "clave" = 'IHSS_IVM_TRAB' AND "vigenciaDesde" = '2020-01-01T00:00:00.000Z');
INSERT INTO "ParametroLegal" ("clave", "valor", "unidad", "descripcion", "baseLegal", "vigenciaDesde")
SELECT 'IHSS_EM_PATR', '0.05', 'PORCENTAJE', 'IHSS Enfermedad y Maternidad patronal', 'Ley de aportaciones y cotizaciones del IHSS', '2020-01-01T00:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM "ParametroLegal" WHERE "clave" = 'IHSS_EM_PATR' AND "vigenciaDesde" = '2020-01-01T00:00:00.000Z');
INSERT INTO "ParametroLegal" ("clave", "valor", "unidad", "descripcion", "baseLegal", "vigenciaDesde")
SELECT 'IHSS_IVM_PATR', '0.035', 'PORCENTAJE', 'IHSS Invalidez, Vejez y Muerte patronal', 'Ley de aportaciones y cotizaciones del IHSS', '2020-01-01T00:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM "ParametroLegal" WHERE "clave" = 'IHSS_IVM_PATR' AND "vigenciaDesde" = '2020-01-01T00:00:00.000Z');
INSERT INTO "ParametroLegal" ("clave", "valor", "unidad", "descripcion", "baseLegal", "vigenciaDesde")
SELECT 'TECHO_IHSS', '1190313', 'MONTO_CENT', 'Techo mensual de cotizacion IHSS', 'PCM 048-2024; confirmar antes de cada ejercicio', '2020-01-01T00:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM "ParametroLegal" WHERE "clave" = 'TECHO_IHSS' AND "vigenciaDesde" = '2020-01-01T00:00:00.000Z');
INSERT INTO "ParametroLegal" ("clave", "valor", "unidad", "descripcion", "baseLegal", "vigenciaDesde")
SELECT 'RAP_TRAB', '0.015', 'PORCENTAJE', 'RAP trabajador', 'Comunicado de techos y porcentajes RAP; confirmar antes de cada ejercicio', '2020-01-01T00:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM "ParametroLegal" WHERE "clave" = 'RAP_TRAB' AND "vigenciaDesde" = '2020-01-01T00:00:00.000Z');
INSERT INTO "ParametroLegal" ("clave", "valor", "unidad", "descripcion", "baseLegal", "vigenciaDesde")
SELECT 'RAP_PATR', '0.015', 'PORCENTAJE', 'RAP patronal', 'Comunicado de techos y porcentajes RAP; confirmar antes de cada ejercicio', '2020-01-01T00:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM "ParametroLegal" WHERE "clave" = 'RAP_PATR' AND "vigenciaDesde" = '2020-01-01T00:00:00.000Z');
INSERT INTO "ParametroLegal" ("clave", "valor", "unidad", "descripcion", "baseLegal", "vigenciaDesde")
SELECT 'RAP_PISO_CENT', '0', 'MONTO_CENT', 'Piso de cotizacion RAP', 'Parametrizado para ajustes normativos', '2020-01-01T00:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM "ParametroLegal" WHERE "clave" = 'RAP_PISO_CENT' AND "vigenciaDesde" = '2020-01-01T00:00:00.000Z');
INSERT INTO "ParametroLegal" ("clave", "valor", "unidad", "descripcion", "baseLegal", "vigenciaDesde")
SELECT 'H_EXTRA_DIURNA_RECARGO', '0.25', 'PORCENTAJE', 'Recargo de hora extra diurna', 'Codigo de Trabajo; confirmar antes de cada ejercicio', '2020-01-01T00:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM "ParametroLegal" WHERE "clave" = 'H_EXTRA_DIURNA_RECARGO' AND "vigenciaDesde" = '2020-01-01T00:00:00.000Z');
INSERT INTO "ParametroLegal" ("clave", "valor", "unidad", "descripcion", "baseLegal", "vigenciaDesde")
SELECT 'H_EXTRA_NOCTURNA_RECARGO', '0.5', 'PORCENTAJE', 'Recargo de hora extra nocturna', 'Codigo de Trabajo; confirmar antes de cada ejercicio', '2020-01-01T00:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM "ParametroLegal" WHERE "clave" = 'H_EXTRA_NOCTURNA_RECARGO' AND "vigenciaDesde" = '2020-01-01T00:00:00.000Z');
INSERT INTO "ParametroLegal" ("clave", "valor", "unidad", "descripcion", "baseLegal", "vigenciaDesde")
SELECT 'ISR_EXENTO_ANUAL_CENT', '21749316', 'MONTO_CENT', 'Monto anual exento ISR persona natural', 'Acuerdo SAR-07-2025; confirmar la tabla del ejercicio vigente', '2025-01-01T00:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM "ParametroLegal" WHERE "clave" = 'ISR_EXENTO_ANUAL_CENT' AND "vigenciaDesde" = '2025-01-01T00:00:00.000Z');
INSERT INTO "ParametroLegal" ("clave", "valor", "unidad", "descripcion", "baseLegal", "vigenciaDesde")
SELECT 'ISR_TRAMO_1_LIMITE_ANUAL_CENT', '33163850', 'MONTO_CENT', 'Limite superior tramo ISR 15%', 'Acuerdo SAR-07-2025; confirmar la tabla del ejercicio vigente', '2025-01-01T00:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM "ParametroLegal" WHERE "clave" = 'ISR_TRAMO_1_LIMITE_ANUAL_CENT' AND "vigenciaDesde" = '2025-01-01T00:00:00.000Z');
INSERT INTO "ParametroLegal" ("clave", "valor", "unidad", "descripcion", "baseLegal", "vigenciaDesde")
SELECT 'ISR_TRAMO_1_TASA', '0.15', 'PORCENTAJE', 'Tasa ISR tramo 1', 'Acuerdo SAR-07-2025; confirmar la tabla del ejercicio vigente', '2025-01-01T00:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM "ParametroLegal" WHERE "clave" = 'ISR_TRAMO_1_TASA' AND "vigenciaDesde" = '2025-01-01T00:00:00.000Z');
INSERT INTO "ParametroLegal" ("clave", "valor", "unidad", "descripcion", "baseLegal", "vigenciaDesde")
SELECT 'ISR_TRAMO_2_LIMITE_ANUAL_CENT', '77125238', 'MONTO_CENT', 'Limite superior tramo ISR 20%', 'Acuerdo SAR-07-2025; confirmar la tabla del ejercicio vigente', '2025-01-01T00:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM "ParametroLegal" WHERE "clave" = 'ISR_TRAMO_2_LIMITE_ANUAL_CENT' AND "vigenciaDesde" = '2025-01-01T00:00:00.000Z');
INSERT INTO "ParametroLegal" ("clave", "valor", "unidad", "descripcion", "baseLegal", "vigenciaDesde")
SELECT 'ISR_TRAMO_2_TASA', '0.20', 'PORCENTAJE', 'Tasa ISR tramo 2', 'Acuerdo SAR-07-2025; confirmar la tabla del ejercicio vigente', '2025-01-01T00:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM "ParametroLegal" WHERE "clave" = 'ISR_TRAMO_2_TASA' AND "vigenciaDesde" = '2025-01-01T00:00:00.000Z');
INSERT INTO "ParametroLegal" ("clave", "valor", "unidad", "descripcion", "baseLegal", "vigenciaDesde")
SELECT 'ISR_TRAMO_3_LIMITE_ANUAL_CENT', '999999999999', 'MONTO_CENT', 'Limite superior tramo ISR 25%', 'Acuerdo SAR-07-2025; tramo abierto superior', '2025-01-01T00:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM "ParametroLegal" WHERE "clave" = 'ISR_TRAMO_3_LIMITE_ANUAL_CENT' AND "vigenciaDesde" = '2025-01-01T00:00:00.000Z');
INSERT INTO "ParametroLegal" ("clave", "valor", "unidad", "descripcion", "baseLegal", "vigenciaDesde")
SELECT 'ISR_TRAMO_3_TASA', '0.25', 'PORCENTAJE', 'Tasa ISR tramo 3', 'Acuerdo SAR-07-2025; confirmar la tabla del ejercicio vigente', '2025-01-01T00:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM "ParametroLegal" WHERE "clave" = 'ISR_TRAMO_3_TASA' AND "vigenciaDesde" = '2025-01-01T00:00:00.000Z');

-- Migracion idempotente de registros legacy. Se marcan por codigo LEGACY y
-- no reciben hash de cierre porque no se conoce el contexto original.
INSERT INTO "PeriodoPlanilla" (
  "codigo", "tipo", "periodicidad", "fechaInicio", "fechaFin", "fechaPago",
  "estado", "totalBrutoCent", "totalDeduccionesCent", "totalNetoCent", "creadoEn"
)
SELECT
  'LEGACY-' || n."id", 'ORDINARIA', 'LEGACY', n."periodo_inicio", n."periodo_fin", n."fecha_pago",
  'CERRADA', CAST(ROUND(CAST(n."salario_bruto" AS REAL) * 100) AS INTEGER),
  CAST(ROUND(CAST(n."deducciones" AS REAL) * 100) AS INTEGER),
  CAST(ROUND(CAST(n."salario_neto" AS REAL) * 100) AS INTEGER), CURRENT_TIMESTAMP
FROM "Nomina" n
WHERE NOT EXISTS (SELECT 1 FROM "PeriodoPlanilla" p WHERE p."codigo" = 'LEGACY-' || n."id");

INSERT INTO "DetallePlanilla" (
  "periodoId", "empleadoId", "contratoSnapshot", "parametrosSnapshot", "diasTrabajados", "horasExtra",
  "totalIngresosCent", "totalDeduccionesCent", "netoPagarCent", "creadoEn"
)
SELECT p."id", n."empleado_id", '{"origen":"MIGRACION"}', '{}', 0, 0,
  CAST(ROUND(CAST(n."salario_bruto" AS REAL) * 100) AS INTEGER),
  CAST(ROUND(CAST(n."deducciones" AS REAL) * 100) AS INTEGER),
  CAST(ROUND(CAST(n."salario_neto" AS REAL) * 100) AS INTEGER), CURRENT_TIMESTAMP
FROM "Nomina" n
JOIN "PeriodoPlanilla" p ON p."codigo" = 'LEGACY-' || n."id"
WHERE NOT EXISTS (
  SELECT 1 FROM "DetallePlanilla" d WHERE d."periodoId" = p."id" AND d."empleadoId" = n."empleado_id"
);

INSERT INTO "LineaConcepto" ("detalleId", "conceptoId", "baseCalculoCent", "cantidad", "montoCent", "detalleCalculo")
SELECT d."id", c."id", d."totalIngresosCent", 1, d."totalIngresosCent", '{"formula":"MIGRACION_NOMINA","origen":"Nomina"}'
FROM "DetallePlanilla" d
JOIN "PeriodoPlanilla" p ON p."id" = d."periodoId" AND p."codigo" LIKE 'LEGACY-%'
JOIN "Concepto" c ON c."codigo" = 'SUELDO'
WHERE NOT EXISTS (SELECT 1 FROM "LineaConcepto" l WHERE l."detalleId" = d."id" AND l."conceptoId" = c."id");

CREATE TRIGGER trg_periodo_planilla_fechas_validas
BEFORE INSERT ON PeriodoPlanilla
FOR EACH ROW WHEN NEW.fechaFin < NEW.fechaInicio
BEGIN
  SELECT RAISE(ABORT, 'PLANILLA_RANGO_INVALIDO');
END;

CREATE TRIGGER trg_periodo_planilla_fechas_validas_update
BEFORE UPDATE ON PeriodoPlanilla
FOR EACH ROW WHEN NEW.fechaFin < NEW.fechaInicio
BEGIN
  SELECT RAISE(ABORT, 'PLANILLA_RANGO_INVALIDO');
END;

CREATE TRIGGER trg_periodo_planilla_transicion_valida
BEFORE UPDATE ON PeriodoPlanilla
FOR EACH ROW
WHEN OLD.estado <> NEW.estado
 AND NOT (
   (OLD.estado = 'BORRADOR' AND NEW.estado = 'CALCULADA')
   OR (OLD.estado = 'CALCULADA' AND NEW.estado = 'EN_APROBACION')
   OR (OLD.estado = 'EN_APROBACION' AND NEW.estado IN ('CALCULADA', 'CERRADA'))
   OR (OLD.estado = 'CERRADA' AND NEW.estado = 'PAGADA')
 )
BEGIN
  SELECT RAISE(ABORT, 'PLANILLA_TRANSICION_INVALIDA');
END;

CREATE TRIGGER trg_periodo_planilla_cierre_inmutable
BEFORE UPDATE ON PeriodoPlanilla
FOR EACH ROW
WHEN OLD.estado IN ('CERRADA', 'PAGADA')
 AND NOT (
   OLD.estado = 'CERRADA' AND NEW.estado = 'PAGADA'
   AND NEW.codigo = OLD.codigo AND NEW.tipo = OLD.tipo AND NEW.periodicidad = OLD.periodicidad
   AND NEW.fechaInicio = OLD.fechaInicio AND NEW.fechaFin = OLD.fechaFin AND NEW.fechaPago = OLD.fechaPago
   AND NEW.periodoAjusteDeId IS OLD.periodoAjusteDeId
   AND NEW.totalBrutoCent = OLD.totalBrutoCent AND NEW.totalDeduccionesCent = OLD.totalDeduccionesCent
   AND NEW.totalNetoCent = OLD.totalNetoCent AND NEW.totalAportesPatronalesCent = OLD.totalAportesPatronalesCent
   AND NEW.calculadoPor IS OLD.calculadoPor AND NEW.calculadoEn IS OLD.calculadoEn
   AND NEW.errorCalculo IS OLD.errorCalculo AND NEW.cerradoPor IS OLD.cerradoPor
   AND NEW.cerradoEn IS OLD.cerradoEn AND NEW.hashCierre IS OLD.hashCierre
 )
BEGIN
  SELECT RAISE(ABORT, 'PLANILLA_CERRADA_INMUTABLE');
END;

CREATE TRIGGER trg_periodo_planilla_cerrar_con_hash
BEFORE UPDATE ON PeriodoPlanilla
FOR EACH ROW WHEN NEW.estado = 'CERRADA' AND (NEW.hashCierre IS NULL OR length(NEW.hashCierre) < 64)
BEGIN
  SELECT RAISE(ABORT, 'PLANILLA_HASH_REQUERIDO');
END;

CREATE TRIGGER trg_periodo_planilla_cuadre
BEFORE UPDATE ON PeriodoPlanilla
FOR EACH ROW
WHEN NEW.estado IN ('CALCULADA', 'EN_APROBACION', 'CERRADA', 'PAGADA')
 AND (
   NEW.totalBrutoCent <> (SELECT COALESCE(SUM(d.totalIngresosCent), 0) FROM DetallePlanilla d WHERE d.periodoId = NEW.id)
   OR NEW.totalDeduccionesCent <> (SELECT COALESCE(SUM(d.totalDeduccionesCent), 0) FROM DetallePlanilla d WHERE d.periodoId = NEW.id)
   OR NEW.totalNetoCent <> (SELECT COALESCE(SUM(d.netoPagarCent), 0) FROM DetallePlanilla d WHERE d.periodoId = NEW.id)
   OR NEW.totalAportesPatronalesCent <> (SELECT COALESCE(SUM(d.totalAportesPatronalesCent), 0) FROM DetallePlanilla d WHERE d.periodoId = NEW.id)
 )
BEGIN
  SELECT RAISE(ABORT, 'DESCUADRE_DETALLE_PLANILLA');
END;

CREATE TRIGGER trg_periodo_planilla_no_delete_cerrada
BEFORE DELETE ON PeriodoPlanilla
FOR EACH ROW WHEN OLD.estado IN ('CERRADA', 'PAGADA')
BEGIN
  SELECT RAISE(ABORT, 'PLANILLA_CERRADA_INMUTABLE');
END;

CREATE TRIGGER trg_detalle_planilla_no_insert_cerrada
BEFORE INSERT ON DetallePlanilla
FOR EACH ROW WHEN (SELECT estado FROM PeriodoPlanilla WHERE id = NEW.periodoId) IN ('CERRADA', 'PAGADA')
BEGIN
  SELECT RAISE(ABORT, 'DETALLE_PLANILLA_INMUTABLE');
END;

CREATE TRIGGER trg_detalle_planilla_no_update_cerrada
BEFORE UPDATE ON DetallePlanilla
FOR EACH ROW WHEN (SELECT estado FROM PeriodoPlanilla WHERE id = OLD.periodoId) IN ('CERRADA', 'PAGADA')
BEGIN
  SELECT RAISE(ABORT, 'DETALLE_PLANILLA_INMUTABLE');
END;

CREATE TRIGGER trg_detalle_planilla_no_delete_cerrada
BEFORE DELETE ON DetallePlanilla
FOR EACH ROW WHEN (SELECT estado FROM PeriodoPlanilla WHERE id = OLD.periodoId) IN ('CERRADA', 'PAGADA')
BEGIN
  SELECT RAISE(ABORT, 'DETALLE_PLANILLA_INMUTABLE');
END;

CREATE TRIGGER trg_linea_planilla_no_insert_cerrada
BEFORE INSERT ON LineaConcepto
FOR EACH ROW WHEN (SELECT p.estado FROM PeriodoPlanilla p JOIN DetallePlanilla d ON d.periodoId = p.id WHERE d.id = NEW.detalleId) IN ('CERRADA', 'PAGADA')
BEGIN
  SELECT RAISE(ABORT, 'LINEA_PLANILLA_INMUTABLE');
END;

CREATE TRIGGER trg_linea_planilla_no_update_cerrada
BEFORE UPDATE ON LineaConcepto
FOR EACH ROW WHEN (SELECT p.estado FROM PeriodoPlanilla p JOIN DetallePlanilla d ON d.periodoId = p.id WHERE d.id = OLD.detalleId) IN ('CERRADA', 'PAGADA')
BEGIN
  SELECT RAISE(ABORT, 'LINEA_PLANILLA_INMUTABLE');
END;

CREATE TRIGGER trg_linea_planilla_no_delete_cerrada
BEFORE DELETE ON LineaConcepto
FOR EACH ROW WHEN (SELECT p.estado FROM PeriodoPlanilla p JOIN DetallePlanilla d ON d.periodoId = p.id WHERE d.id = OLD.detalleId) IN ('CERRADA', 'PAGADA')
BEGIN
  SELECT RAISE(ABORT, 'LINEA_PLANILLA_INMUTABLE');
END;
