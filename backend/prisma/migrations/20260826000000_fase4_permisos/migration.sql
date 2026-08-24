-- Fase 4: permisos (CU03).
-- Se conserva Solicitud como modelo legado para permitir una migracion
-- gradual de instalaciones existentes. Las nuevas solicitudes usan los
-- modelos independientes de esta migracion.

CREATE TABLE "TipoPermiso" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "remunerado" BOOLEAN NOT NULL DEFAULT true,
    "diasMaxAnio" INTEGER,
    "requiereSoporte" BOOLEAN NOT NULL DEFAULT false,
    "baseLegal" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE "SolicitudPermiso" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "folio" TEXT NOT NULL,
    "empleadoId" INTEGER NOT NULL,
    "tipoPermisoId" INTEGER NOT NULL,
    "fechaInicio" DATETIME NOT NULL,
    "fechaFin" DATETIME NOT NULL,
    "horaInicio" TEXT,
    "horaFin" TEXT,
    "diasHabiles" REAL NOT NULL,
    "motivo" TEXT NOT NULL,
    "soporteRuta" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'SOLICITADO',
    "revisadoPor" INTEGER,
    "revisadoEn" DATETIME,
    "observacionRevision" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SolicitudPermiso_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SolicitudPermiso_tipoPermisoId_fkey" FOREIGN KEY ("tipoPermisoId") REFERENCES "TipoPermiso" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "PermisoHistorialEstado" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "permisoId" INTEGER NOT NULL,
    "estadoAnterior" TEXT,
    "estadoNuevo" TEXT NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "motivo" TEXT,
    "ip" TEXT,
    "ocurridoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PermisoHistorialEstado_permisoId_fkey" FOREIGN KEY ("permisoId") REFERENCES "SolicitudPermiso" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

ALTER TABLE "RegistroAsistencia"
  ADD COLUMN "permisoId" INTEGER REFERENCES "SolicitudPermiso" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "TipoPermiso_codigo_key" ON "TipoPermiso"("codigo");
CREATE UNIQUE INDEX "SolicitudPermiso_folio_key" ON "SolicitudPermiso"("folio");
CREATE INDEX "SolicitudPermiso_empleadoId_estado_idx" ON "SolicitudPermiso"("empleadoId", "estado");
CREATE INDEX "SolicitudPermiso_estado_creadoEn_idx" ON "SolicitudPermiso"("estado", "creadoEn");
CREATE INDEX "SolicitudPermiso_fechaInicio_fechaFin_idx" ON "SolicitudPermiso"("fechaInicio", "fechaFin");
CREATE INDEX "PermisoHistorialEstado_permisoId_ocurridoEn_idx" ON "PermisoHistorialEstado"("permisoId", "ocurridoEn");
CREATE INDEX "RegistroAsistencia_permisoId_idx" ON "RegistroAsistencia"("permisoId");

-- Indice parcial: acelera y documenta el conjunto que puede reservar dias.
CREATE INDEX "SolicitudPermiso_solapamiento_idx"
  ON "SolicitudPermiso"("empleadoId", "fechaInicio", "fechaFin")
  WHERE "estado" IN ('EN_REVISION', 'APROBADO');

-- Migracion de datos del MVP: las solicitudes antiguas de tipo PERMISO se
-- convierten al catalogo PERS y conservan su trazabilidad. VACACIONES queda
-- en Solicitud hasta la Fase 5, cuando tendra su agregado propio.
INSERT INTO "TipoPermiso" ("codigo", "nombre", "remunerado", "diasMaxAnio", "requiereSoporte", "baseLegal")
SELECT 'PERS', 'Permiso personal', 1, 6, 0, 'Politica interna de permisos'
WHERE NOT EXISTS (SELECT 1 FROM "TipoPermiso" WHERE "codigo" = 'PERS');

INSERT INTO "SolicitudPermiso" (
  "folio", "empleadoId", "tipoPermisoId", "fechaInicio", "fechaFin",
  "diasHabiles", "motivo", "estado", "creadoEn", "actualizadoEn"
)
SELECT
  'PER-LEGACY-' || s."id",
  s."empleado_id",
  t."id",
  s."fecha_inicio",
  s."fecha_fin",
  MAX(1, CAST(julianday(s."fecha_fin") - julianday(s."fecha_inicio") AS INTEGER) + 1),
  s."motivo",
  CASE s."estado"
    WHEN 'APROBADA' THEN 'APROBADO'
    WHEN 'RECHAZADA' THEN 'RECHAZADO'
    ELSE 'EN_REVISION'
  END,
  s."fecha_solicitud",
  s."fecha_solicitud"
FROM "Solicitud" s
JOIN "TipoPermiso" t ON t."codigo" = 'PERS'
WHERE s."tipo" = 'PERMISO'
  AND NOT EXISTS (SELECT 1 FROM "SolicitudPermiso" p WHERE p."folio" = 'PER-LEGACY-' || s."id");

INSERT INTO "PermisoHistorialEstado" (
  "permisoId", "estadoNuevo", "usuarioId", "motivo", "ocurridoEn"
)
SELECT p."id", p."estado", e."usuario_id", 'Migracion desde Solicitud del MVP', p."creadoEn"
FROM "SolicitudPermiso" p
JOIN "Empleado" e ON e."id" = p."empleadoId"
WHERE p."folio" LIKE 'PER-LEGACY-%'
  AND NOT EXISTS (
    SELECT 1 FROM "PermisoHistorialEstado" h WHERE h."permisoId" = p."id"
  );

-- ─────────────── Invariantes del dominio ───────────────

CREATE TRIGGER trg_permiso_fechas_validas
BEFORE INSERT ON SolicitudPermiso
FOR EACH ROW WHEN NEW.fechaFin < NEW.fechaInicio
BEGIN
  SELECT RAISE(ABORT, 'PERMISO_RANGO_INVALIDO');
END;

CREATE TRIGGER trg_permiso_fechas_validas_update
BEFORE UPDATE ON SolicitudPermiso
FOR EACH ROW WHEN NEW.fechaFin < NEW.fechaInicio
BEGIN
  SELECT RAISE(ABORT, 'PERMISO_RANGO_INVALIDO');
END;

-- Solo EN_REVISION y APROBADO reservan el rango. La regla se repite en
-- INSERT y UPDATE para cubrir envio, aprobacion y escrituras directas.
CREATE TRIGGER trg_permiso_solapamiento_insert
BEFORE INSERT ON SolicitudPermiso
FOR EACH ROW
WHEN NEW.estado IN ('EN_REVISION', 'APROBADO')
 AND EXISTS (
   SELECT 1 FROM SolicitudPermiso p
   WHERE p.empleadoId = NEW.empleadoId
     AND p.estado IN ('EN_REVISION', 'APROBADO')
     AND p.fechaInicio <= NEW.fechaFin
     AND p.fechaFin >= NEW.fechaInicio
 )
BEGIN
  SELECT RAISE(ABORT, 'PERMISO_SOLAPADO');
END;

CREATE TRIGGER trg_permiso_solapamiento_update
BEFORE UPDATE ON SolicitudPermiso
FOR EACH ROW
WHEN NEW.estado IN ('EN_REVISION', 'APROBADO')
 AND EXISTS (
   SELECT 1 FROM SolicitudPermiso p
   WHERE p.id <> NEW.id
     AND p.empleadoId = NEW.empleadoId
     AND p.estado IN ('EN_REVISION', 'APROBADO')
     AND p.fechaInicio <= NEW.fechaFin
     AND p.fechaFin >= NEW.fechaInicio
 )
BEGIN
  SELECT RAISE(ABORT, 'PERMISO_SOLAPADO');
END;

-- FSM persistente: no se puede saltar estados ni reabrir estados finales.
CREATE TRIGGER trg_permiso_transicion_valida
BEFORE UPDATE ON SolicitudPermiso
FOR EACH ROW
WHEN OLD.estado <> NEW.estado
 AND NOT (
   (OLD.estado = 'SOLICITADO' AND NEW.estado IN ('EN_REVISION', 'CANCELADO'))
   OR (OLD.estado = 'EN_REVISION' AND NEW.estado IN ('APROBADO', 'RECHAZADO', 'SOLICITADO'))
 )
BEGIN
  SELECT RAISE(ABORT, 'PERMISO_TRANSICION_INVALIDA');
END;

CREATE TRIGGER trg_permiso_estado_final_no_update
BEFORE UPDATE ON SolicitudPermiso
FOR EACH ROW WHEN OLD.estado IN ('APROBADO', 'RECHAZADO', 'CANCELADO')
BEGIN
  SELECT RAISE(ABORT, 'PERMISO_ESTADO_FINAL');
END;

-- La evidencia de transiciones es append-only.
CREATE TRIGGER trg_permiso_historial_no_update
BEFORE UPDATE ON PermisoHistorialEstado
BEGIN
  SELECT RAISE(ABORT, 'PERMISO_HISTORIAL_INMUTABLE');
END;

CREATE TRIGGER trg_permiso_historial_no_delete
BEFORE DELETE ON PermisoHistorialEstado
BEGIN
  SELECT RAISE(ABORT, 'PERMISO_HISTORIAL_INMUTABLE');
END;
