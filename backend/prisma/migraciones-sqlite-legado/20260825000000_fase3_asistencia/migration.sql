-- Fase 3: reemplazo del modelo Asistencia del MVP por el conjunto
-- Turno / HorarioEmpleado / Marcaje / RegistroAsistencia / DiaFeriado.
-- La base se recreo en Fase 2 con seeds; no hay datos que trasladar.

CREATE TABLE "Turno" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "horaEntrada" TEXT NOT NULL,
    "horaSalida" TEXT NOT NULL,
    "cruzaMedianoche" BOOLEAN NOT NULL DEFAULT false,
    "toleranciaMin" INTEGER NOT NULL DEFAULT 10,
    "minutosAlmuerzo" INTEGER NOT NULL DEFAULT 60,
    "diasSemana" TEXT NOT NULL DEFAULT '1,2,3,4,5',
    "activo" BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE "HorarioEmpleado" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "empleadoId" INTEGER NOT NULL,
    "turnoId" INTEGER NOT NULL,
    "desde" DATETIME NOT NULL,
    "hasta" DATETIME,
    CONSTRAINT "HorarioEmpleado_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "Turno" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HorarioEmpleado_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "Marcaje" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "empleadoId" INTEGER NOT NULL,
    "ocurridoEn" DATETIME NOT NULL,
    "tipo" TEXT NOT NULL,
    "origen" TEXT NOT NULL DEFAULT 'WEB',
    "dispositivo" TEXT,
    "latitud" REAL,
    "longitud" REAL,
    "registradoPor" INTEGER,
    "hashEvento" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Marcaje_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "RegistroAsistencia" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "empleadoId" INTEGER NOT NULL,
    "fecha" DATETIME NOT NULL,
    "turnoId" INTEGER,
    "horaEntrada" DATETIME,
    "horaSalida" DATETIME,
    "minutosTrabajados" INTEGER NOT NULL DEFAULT 0,
    "minutosTardanza" INTEGER NOT NULL DEFAULT 0,
    "horasExtraDiurnas" REAL NOT NULL DEFAULT 0,
    "horasExtraNocturnas" REAL NOT NULL DEFAULT 0,
    "estadoDia" TEXT NOT NULL,
    "observacion" TEXT,
    "cerrado" BOOLEAN NOT NULL DEFAULT false,
    "cerradoPor" INTEGER,
    "cerradoEn" DATETIME,
    CONSTRAINT "RegistroAsistencia_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RegistroAsistencia_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "Turno" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "DiaFeriado" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fecha" DATETIME NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'NACIONAL',
    "remunerado" BOOLEAN NOT NULL DEFAULT true
);

CREATE UNIQUE INDEX "HorarioEmpleado_empleadoId_desde_key" ON "HorarioEmpleado"("empleadoId", "desde");
CREATE UNIQUE INDEX "Marcaje_hashEvento_key" ON "Marcaje"("hashEvento");
CREATE UNIQUE INDEX "RegistroAsistencia_empleadoId_fecha_key" ON "RegistroAsistencia"("empleadoId", "fecha");
CREATE UNIQUE INDEX "DiaFeriado_fecha_key" ON "DiaFeriado"("fecha");
CREATE INDEX "Marcaje_empleadoId_ocurridoEn_idx" ON "Marcaje"("empleadoId", "ocurridoEn");
CREATE INDEX "Marcaje_ocurridoEn_idx" ON "Marcaje"("ocurridoEn");
CREATE INDEX "RegistroAsistencia_fecha_estadoDia_idx" ON "RegistroAsistencia"("fecha", "estadoDia");

DROP TABLE "Asistencia";

-- ─────────────── Invariantes por trigger ───────────────

-- El dia consolidado cerrado no admite modificacion ni borrado;
-- la reapertura (cerrado 1 -> 0) si esta permitida y queda auditada.
CREATE TRIGGER trg_asistencia_cerrada_no_update
BEFORE UPDATE ON RegistroAsistencia
FOR EACH ROW WHEN OLD.cerrado = 1 AND NEW.cerrado = 1
BEGIN
  SELECT RAISE(ABORT, 'ASISTENCIA_DIA_CERRADO');
END;

CREATE TRIGGER trg_asistencia_cerrada_no_delete
BEFORE DELETE ON RegistroAsistencia
FOR EACH ROW WHEN OLD.cerrado = 1
BEGIN
  SELECT RAISE(ABORT, 'ASISTENCIA_DIA_CERRADO');
END;

-- El marcaje crudo es un registro historico append-only.
CREATE TRIGGER trg_marcaje_no_update
BEFORE UPDATE ON Marcaje
BEGIN
  SELECT RAISE(ABORT, 'MARCAJE_INMUTABLE');
END;

CREATE TRIGGER trg_marcaje_no_delete
BEFORE DELETE ON Marcaje
BEGIN
  SELECT RAISE(ABORT, 'MARCAJE_INMUTABLE');
END;
