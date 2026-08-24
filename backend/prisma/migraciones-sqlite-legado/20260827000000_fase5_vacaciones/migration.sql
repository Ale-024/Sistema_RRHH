-- Fase 5: vacaciones (CU04).
-- El modelo Solicitud legado se conserva; las nuevas vacaciones usan estos
-- agregados y un libro mayor append-only.

CREATE TABLE "ParametroLegal" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "clave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "unidad" TEXT,
    "descripcion" TEXT,
    "baseLegal" TEXT,
    "vigenciaDesde" DATETIME NOT NULL,
    "vigenciaHasta" DATETIME,
    "creadoPor" INTEGER,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activo" BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE "PeriodoVacacional" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "empleadoId" INTEGER NOT NULL,
    "anioServicio" INTEGER NOT NULL,
    "desde" DATETIME NOT NULL,
    "hasta" DATETIME NOT NULL,
    "diasDerecho" INTEGER NOT NULL,
    "diasGozados" REAL NOT NULL DEFAULT 0,
    "diasPagados" REAL NOT NULL DEFAULT 0,
    "estado" TEXT NOT NULL DEFAULT 'VIGENTE',
    "generadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PeriodoVacacional_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "SolicitudVacacion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "folio" TEXT NOT NULL,
    "empleadoId" INTEGER NOT NULL,
    "periodoId" INTEGER NOT NULL,
    "fechaInicio" DATETIME NOT NULL,
    "fechaFin" DATETIME NOT NULL,
    "diasHabiles" REAL NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'SOLICITADO',
    "suplenteId" INTEGER,
    "revisadoPor" INTEGER,
    "revisadoEn" DATETIME,
    "observacionRevision" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SolicitudVacacion_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SolicitudVacacion_periodoId_fkey" FOREIGN KEY ("periodoId") REFERENCES "PeriodoVacacional" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SolicitudVacacion_suplenteId_fkey" FOREIGN KEY ("suplenteId") REFERENCES "Empleado" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "VacacionHistorialEstado" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "vacacionId" INTEGER NOT NULL,
    "estadoAnterior" TEXT,
    "estadoNuevo" TEXT NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "motivo" TEXT,
    "ip" TEXT,
    "ocurridoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VacacionHistorialEstado_vacacionId_fkey" FOREIGN KEY ("vacacionId") REFERENCES "SolicitudVacacion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "MovimientoSaldoVacacion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "periodoId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "dias" REAL NOT NULL,
    "referenciaId" INTEGER,
    "motivo" TEXT,
    "registradoPor" INTEGER,
    "ocurridoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MovimientoSaldoVacacion_periodoId_fkey" FOREIGN KEY ("periodoId") REFERENCES "PeriodoVacacional" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

ALTER TABLE "RegistroAsistencia"
  ADD COLUMN "vacacionId" INTEGER REFERENCES "SolicitudVacacion" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "PeriodoVacacional_empleadoId_anioServicio_key" ON "PeriodoVacacional"("empleadoId", "anioServicio");
CREATE UNIQUE INDEX "SolicitudVacacion_folio_key" ON "SolicitudVacacion"("folio");
CREATE INDEX "ParametroLegal_clave_vigenciaDesde_idx" ON "ParametroLegal"("clave", "vigenciaDesde");
CREATE INDEX "ParametroLegal_vigenciaDesde_vigenciaHasta_idx" ON "ParametroLegal"("vigenciaDesde", "vigenciaHasta");
CREATE INDEX "PeriodoVacacional_empleadoId_estado_idx" ON "PeriodoVacacional"("empleadoId", "estado");
CREATE INDEX "SolicitudVacacion_empleadoId_estado_idx" ON "SolicitudVacacion"("empleadoId", "estado");
CREATE INDEX "SolicitudVacacion_estado_creadoEn_idx" ON "SolicitudVacacion"("estado", "creadoEn");
CREATE INDEX "SolicitudVacacion_fechaInicio_fechaFin_idx" ON "SolicitudVacacion"("fechaInicio", "fechaFin");
CREATE INDEX "VacacionHistorialEstado_vacacionId_ocurridoEn_idx" ON "VacacionHistorialEstado"("vacacionId", "ocurridoEn");
CREATE INDEX "MovimientoSaldoVacacion_periodoId_ocurridoEn_idx" ON "MovimientoSaldoVacacion"("periodoId", "ocurridoEn");
CREATE INDEX "RegistroAsistencia_vacacionId_idx" ON "RegistroAsistencia"("vacacionId");
CREATE INDEX "SolicitudVacacion_solapamiento_idx"
  ON "SolicitudVacacion"("empleadoId", "fechaInicio", "fechaFin")
  WHERE "estado" IN ('EN_REVISION', 'APROBADO');

-- La escala inicial es parametrica y puede ser reemplazada por una vigencia
-- posterior sin modificar el codigo del caso de uso.
INSERT INTO "ParametroLegal" ("clave", "valor", "unidad", "descripcion", "baseLegal", "vigenciaDesde")
SELECT 'VAC_DIAS_ANIO_1', '10', 'DIAS', 'Vacaciones al cumplir el primer año', 'Codigo de Trabajo, escala vacacional', '2020-01-01T00:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM "ParametroLegal" WHERE "clave" = 'VAC_DIAS_ANIO_1' AND "vigenciaDesde" = '2020-01-01T00:00:00.000Z');
INSERT INTO "ParametroLegal" ("clave", "valor", "unidad", "descripcion", "baseLegal", "vigenciaDesde")
SELECT 'VAC_DIAS_ANIO_2', '12', 'DIAS', 'Vacaciones al cumplir el segundo año', 'Codigo de Trabajo, escala vacacional', '2020-01-01T00:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM "ParametroLegal" WHERE "clave" = 'VAC_DIAS_ANIO_2' AND "vigenciaDesde" = '2020-01-01T00:00:00.000Z');
INSERT INTO "ParametroLegal" ("clave", "valor", "unidad", "descripcion", "baseLegal", "vigenciaDesde")
SELECT 'VAC_DIAS_ANIO_3', '15', 'DIAS', 'Vacaciones al cumplir el tercer año', 'Codigo de Trabajo, escala vacacional', '2020-01-01T00:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM "ParametroLegal" WHERE "clave" = 'VAC_DIAS_ANIO_3' AND "vigenciaDesde" = '2020-01-01T00:00:00.000Z');
INSERT INTO "ParametroLegal" ("clave", "valor", "unidad", "descripcion", "baseLegal", "vigenciaDesde")
SELECT 'VAC_DIAS_ANIO_4', '20', 'DIAS', 'Vacaciones al cumplir cuatro o mas años', 'Codigo de Trabajo, escala vacacional', '2020-01-01T00:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM "ParametroLegal" WHERE "clave" = 'VAC_DIAS_ANIO_4' AND "vigenciaDesde" = '2020-01-01T00:00:00.000Z');

CREATE TRIGGER trg_parametro_legal_vigencias
BEFORE INSERT ON ParametroLegal
FOR EACH ROW
WHEN NEW.vigenciaHasta IS NOT NULL AND NEW.vigenciaHasta < NEW.vigenciaDesde
BEGIN
  SELECT RAISE(ABORT, 'PARAMETRO_LEGAL_RANGO_INVALIDO');
END;

CREATE TRIGGER trg_parametro_legal_solapado
BEFORE INSERT ON ParametroLegal
FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM ParametroLegal p
  WHERE p.clave = NEW.clave AND p.activo = 1
    AND p.vigenciaDesde <= COALESCE(NEW.vigenciaHasta, '9999-12-31T23:59:59.999Z')
    AND COALESCE(p.vigenciaHasta, '9999-12-31T23:59:59.999Z') >= NEW.vigenciaDesde
)
BEGIN
  SELECT RAISE(ABORT, 'PARAMETRO_LEGAL_VIGENCIA_SOLAPADA');
END;

CREATE TRIGGER trg_parametro_legal_update_rango
BEFORE UPDATE OF vigenciaDesde, vigenciaHasta ON ParametroLegal
FOR EACH ROW
WHEN NEW.vigenciaHasta IS NOT NULL AND NEW.vigenciaHasta < NEW.vigenciaDesde
BEGIN
  SELECT RAISE(ABORT, 'PARAMETRO_LEGAL_RANGO_INVALIDO');
END;

CREATE TRIGGER trg_parametro_legal_update_solapado
BEFORE UPDATE OF clave, vigenciaDesde, vigenciaHasta, activo ON ParametroLegal
FOR EACH ROW
WHEN NEW.activo = 1 AND EXISTS (
  SELECT 1 FROM ParametroLegal p
  WHERE p.id <> NEW.id AND p.clave = NEW.clave AND p.activo = 1
    AND p.vigenciaDesde <= COALESCE(NEW.vigenciaHasta, '9999-12-31T23:59:59.999Z')
    AND COALESCE(p.vigenciaHasta, '9999-12-31T23:59:59.999Z') >= NEW.vigenciaDesde
)
BEGIN
  SELECT RAISE(ABORT, 'PARAMETRO_LEGAL_VIGENCIA_SOLAPADA');
END;

CREATE TRIGGER trg_vacacion_fechas_validas
BEFORE INSERT ON SolicitudVacacion
FOR EACH ROW WHEN NEW.fechaFin < NEW.fechaInicio
BEGIN
  SELECT RAISE(ABORT, 'VACACION_RANGO_INVALIDO');
END;

CREATE TRIGGER trg_vacacion_fechas_validas_update
BEFORE UPDATE ON SolicitudVacacion
FOR EACH ROW WHEN NEW.fechaFin < NEW.fechaInicio
BEGIN
  SELECT RAISE(ABORT, 'VACACION_RANGO_INVALIDO');
END;

CREATE TRIGGER trg_vacacion_solapamiento_insert
BEFORE INSERT ON SolicitudVacacion
FOR EACH ROW
WHEN NEW.estado IN ('EN_REVISION', 'APROBADO')
 AND EXISTS (
   SELECT 1 FROM SolicitudVacacion s
   WHERE s.empleadoId = NEW.empleadoId
     AND s.estado IN ('EN_REVISION', 'APROBADO')
     AND s.fechaInicio <= NEW.fechaFin AND s.fechaFin >= NEW.fechaInicio
 )
BEGIN
  SELECT RAISE(ABORT, 'VACACION_SOLAPADA');
END;

CREATE TRIGGER trg_vacacion_solapamiento_update
BEFORE UPDATE ON SolicitudVacacion
FOR EACH ROW
WHEN NEW.estado IN ('EN_REVISION', 'APROBADO')
 AND EXISTS (
   SELECT 1 FROM SolicitudVacacion s
   WHERE s.id <> NEW.id AND s.empleadoId = NEW.empleadoId
     AND s.estado IN ('EN_REVISION', 'APROBADO')
     AND s.fechaInicio <= NEW.fechaFin AND s.fechaFin >= NEW.fechaInicio
 )
BEGIN
  SELECT RAISE(ABORT, 'VACACION_SOLAPADA');
END;

CREATE TRIGGER trg_vacacion_transicion_valida
BEFORE UPDATE ON SolicitudVacacion
FOR EACH ROW
WHEN OLD.estado <> NEW.estado
 AND NOT (
   (OLD.estado = 'SOLICITADO' AND NEW.estado IN ('EN_REVISION', 'CANCELADO'))
   OR (OLD.estado = 'EN_REVISION' AND NEW.estado IN ('APROBADO', 'RECHAZADO', 'SOLICITADO'))
 )
BEGIN
  SELECT RAISE(ABORT, 'VACACION_TRANSICION_INVALIDA');
END;

CREATE TRIGGER trg_vacacion_estado_final_no_update
BEFORE UPDATE ON SolicitudVacacion
FOR EACH ROW WHEN OLD.estado IN ('APROBADO', 'RECHAZADO', 'CANCELADO')
BEGIN
  SELECT RAISE(ABORT, 'VACACION_ESTADO_FINAL');
END;

CREATE TRIGGER trg_vacacion_historial_no_update
BEFORE UPDATE ON VacacionHistorialEstado
BEGIN
  SELECT RAISE(ABORT, 'VACACION_HISTORIAL_INMUTABLE');
END;

CREATE TRIGGER trg_vacacion_historial_no_delete
BEFORE DELETE ON VacacionHistorialEstado
BEGIN
  SELECT RAISE(ABORT, 'VACACION_HISTORIAL_INMUTABLE');
END;

-- El movimiento solo puede ingresar si el saldo resultante permanece dentro
-- de [0, diasDerecho]. UPDATE/DELETE quedan prohibidos para reconstruibilidad.
CREATE TRIGGER trg_movimiento_saldo_vacacion_limites
BEFORE INSERT ON MovimientoSaldoVacacion
FOR EACH ROW
WHEN (SELECT COALESCE(SUM(m.dias), 0) FROM MovimientoSaldoVacacion m WHERE m.periodoId = NEW.periodoId) + NEW.dias < 0
BEGIN
  SELECT RAISE(ABORT, 'SALDO_VACACIONES_INSUFICIENTE');
END;

CREATE TRIGGER trg_movimiento_saldo_vacacion_excedido
BEFORE INSERT ON MovimientoSaldoVacacion
FOR EACH ROW
WHEN (SELECT COALESCE(SUM(m.dias), 0) FROM MovimientoSaldoVacacion m WHERE m.periodoId = NEW.periodoId) + NEW.dias > (SELECT p.diasDerecho FROM PeriodoVacacional p WHERE p.id = NEW.periodoId)
BEGIN
  SELECT RAISE(ABORT, 'SALDO_VACACIONES_EXCEDIDO');
END;

CREATE TRIGGER trg_movimiento_saldo_vacacion_no_update
BEFORE UPDATE ON MovimientoSaldoVacacion
BEGIN
  SELECT RAISE(ABORT, 'MOVIMIENTO_SALDO_INMUTABLE');
END;

CREATE TRIGGER trg_movimiento_saldo_vacacion_no_delete
BEFORE DELETE ON MovimientoSaldoVacacion
BEGIN
  SELECT RAISE(ABORT, 'MOVIMIENTO_SALDO_INMUTABLE');
END;

CREATE TRIGGER trg_periodo_vacacional_resumen_limites
BEFORE UPDATE OF diasGozados, diasPagados ON PeriodoVacacional
FOR EACH ROW
WHEN NEW.diasGozados < 0 OR NEW.diasPagados < 0
  OR NEW.diasGozados + NEW.diasPagados > NEW.diasDerecho
BEGIN
  SELECT RAISE(ABORT, 'SALDO_VACACIONES_EXCEDIDO');
END;
