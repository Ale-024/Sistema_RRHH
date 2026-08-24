-- ═════════════ ANEXO DE AUTORIDAD PARA OTORGAR ROLES ═════════════
-- Separa alta de empleado / alta de usuario / asignacion de rol e introduce
-- la jerarquia nivelAutoridad, la autorizacion previa y las invariantes 1-7.
-- (La invariante 8 de trazabilidad se refuerza por suscriptores y auditoria.)

-- ── Jerarquia de autoridad ──────────────────────────────────────────
ALTER TABLE "Rol" ADD COLUMN "nivelAutoridad" INTEGER NOT NULL DEFAULT 10;
UPDATE "Rol" SET "nivelAutoridad" = 90 WHERE "codigo" = 'DIRECCION';
UPDATE "Rol" SET "nivelAutoridad" = 50 WHERE "codigo" IN ('RRHH_SUP', 'ADMIN_TI');
UPDATE "Rol" SET "nivelAutoridad" = 30 WHERE "codigo" = 'GERENTE_DEPTO';

-- ── Ejecutor de la asignacion (null = SISTEMA) ──────────────────────
ALTER TABLE "UsuarioRol" ADD COLUMN "asignadoPorId" INTEGER;

-- ── Autorizaciones previas ──────────────────────────────────────────
CREATE TABLE "AutorizacionRol" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "beneficiarioId" INTEGER NOT NULL,
    "rolId" INTEGER NOT NULL,
    "scopeDepartamentoId" INTEGER,
    "solicitadaPorId" INTEGER NOT NULL,
    "autorizadaPorId" INTEGER,
    "estado" TEXT NOT NULL DEFAULT 'SOLICITADA',
    "motivo" TEXT,
    "creadaEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decididaEn" DATETIME,
    "venceEn" DATETIME,
    "consumidaEn" DATETIME
);
CREATE INDEX "AutorizacionRol_beneficiarioId_rolId_estado_idx"
  ON "AutorizacionRol"("beneficiarioId", "rolId", "estado");
CREATE INDEX "AutorizacionRol_estado_idx" ON "AutorizacionRol"("estado");

-- ── Excepciones auditadas a la incompatibilidad (inv. 6) ────────────
CREATE TABLE "RolIncompatibilidadExcepcion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "rolAId" INTEGER NOT NULL,
    "rolBId" INTEGER NOT NULL,
    "vigenciaDesde" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vigenciaHasta" DATETIME,
    "motivo" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true
);

-- ═════════════ TRIGGERS · INVARIANTES ═════════════

-- Invariante 1: prohibicion de autoasignacion.
CREATE TRIGGER trg_ur_inv1_no_autoasignacion
BEFORE INSERT ON "UsuarioRol"
FOR EACH ROW
WHEN NEW."asignadoPorId" IS NOT NULL AND NEW."asignadoPorId" = NEW."usuarioId"
BEGIN
  SELECT RAISE(ABORT, 'INV1_AUTOASIGNACION');
END;

-- Invariante 5: alcance obligatorio. GERENTE_DEPTO exige scope; los demas lo prohíben.
CREATE TRIGGER trg_ur_inv5_scope_insert
BEFORE INSERT ON "UsuarioRol"
FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM "Rol" r WHERE r."id" = NEW."rolId"
    AND ( (r."codigo" = 'GERENTE_DEPTO' AND NEW."scopeDepartamentoId" IS NULL)
       OR (r."codigo" <> 'GERENTE_DEPTO' AND NEW."scopeDepartamentoId" IS NOT NULL) )
)
BEGIN
  SELECT RAISE(ABORT, 'INV5_ALCANCE_INVALIDO');
END;

CREATE TRIGGER trg_ur_inv5_scope_update
BEFORE UPDATE OF "scopeDepartamentoId" ON "UsuarioRol"
FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM "Rol" r WHERE r."id" = NEW."rolId"
    AND ( (r."codigo" = 'GERENTE_DEPTO' AND NEW."scopeDepartamentoId" IS NULL)
       OR (r."codigo" <> 'GERENTE_DEPTO' AND NEW."scopeDepartamentoId" IS NOT NULL) )
)
BEGIN
  SELECT RAISE(ABORT, 'INV5_ALCANCE_INVALIDO');
END;

-- Invariantes 2/3/4: otorgamiento controlado para roles de nivel >= 30.
-- Exige AutorizacionRol AUTORIZADA, vigente y no consumida; el autorizador
-- no puede ser ni el ejecutor ni el beneficiario (doble control).
CREATE TRIGGER trg_ur_inv3_autorizacion_previa
BEFORE INSERT ON "UsuarioRol"
FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM "Rol" r WHERE r."id" = NEW."rolId" AND r."nivelAutoridad" >= 30
) AND NOT EXISTS (
  SELECT 1 FROM "AutorizacionRol" a
  WHERE a."beneficiarioId" = NEW."usuarioId"
    AND a."rolId" = NEW."rolId"
    AND a."estado" = 'AUTORIZADA'
    AND a."consumidaEn" IS NULL
    AND (a."venceEn" IS NULL OR a."venceEn" > strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    AND a."autorizadaPorId" IS NOT NULL
    AND a."autorizadaPorId" <> NEW."asignadoPorId"
    AND a."autorizadaPorId" <> NEW."usuarioId"
)
BEGIN
  SELECT RAISE(ABORT, 'INV3_SIN_AUTORIZACION_VIGENTE');
END;

-- Marca la autorizacion como consumida al otorgarse el rol.
CREATE TRIGGER trg_ur_consumir_autorizacion
AFTER INSERT ON "UsuarioRol"
FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM "Rol" r WHERE r."id" = NEW."rolId" AND r."nivelAutoridad" >= 30
)
BEGIN
  UPDATE "AutorizacionRol"
  SET "consumidaEn" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE "beneficiarioId" = NEW."usuarioId"
    AND "rolId" = NEW."rolId"
    AND "estado" = 'AUTORIZADA'
    AND "consumidaEn" IS NULL;
END;

-- Invariante 6: incompatibilidad por segregacion de funciones.
-- ADMIN_TI es excluyente con cualquier otro rol. RRHH_SUP + DIRECCION solo
-- conviven si existe una excepcion activa en RolIncompatibilidadExcepcion.
CREATE TRIGGER trg_ur_inv6_incompatibilidad
BEFORE INSERT ON "UsuarioRol"
FOR EACH ROW
WHEN EXISTS (
  SELECT 1
  FROM "UsuarioRol" ur
  JOIN "Rol" rn ON rn."id" = NEW."rolId"
  JOIN "Rol" re ON re."id" = ur."rolId"
  WHERE ur."usuarioId" = NEW."usuarioId"
    AND (
         (rn."codigo" = 'ADMIN_TI' AND re."codigo" <> 'ADMIN_TI')
      OR (re."codigo" = 'ADMIN_TI' AND rn."codigo" <> 'ADMIN_TI')
      OR (rn."codigo" = 'RRHH_SUP'   AND re."codigo" = 'DIRECCION')
      OR (rn."codigo" = 'DIRECCION'  AND re."codigo" = 'RRHH_SUP')
    )
    AND NOT EXISTS (
      SELECT 1 FROM "RolIncompatibilidadExcepcion" x
      WHERE x."activo" = 1
        AND ((x."rolAId" = re."id" AND x."rolBId" = rn."id")
          OR (x."rolAId" = rn."id" AND x."rolBId" = re."id"))
        AND x."vigenciaDesde" <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        AND (x."vigenciaHasta" IS NULL OR x."vigenciaHasta" > strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )
)
BEGIN
  SELECT RAISE(ABORT, 'INV6_ROLES_INCOMPATIBLES');
END;

-- Invariante 7: continuidad administrativa. No puede retirarse el ultimo
-- ADMIN_TI ni el ultimo DIRECCION activo del sistema.
CREATE TRIGGER trg_ur_inv7_continuidad_delete
BEFORE DELETE ON "UsuarioRol"
FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM "Rol" r WHERE r."id" = OLD."rolId"
    AND r."codigo" IN ('ADMIN_TI', 'DIRECCION')
) AND NOT EXISTS (
  SELECT 1
  FROM "UsuarioRol" ur2
  JOIN "Usuario" u2 ON u2."id" = ur2."usuarioId"
  WHERE ur2."rolId" = OLD."rolId"
    AND ur2."usuarioId" <> OLD."usuarioId"
    AND u2."estado" = 'ACTIVO'
)
BEGIN
  SELECT RAISE(ABORT, 'INV7_ULTIMO_ADMINISTRADOR');
END;
