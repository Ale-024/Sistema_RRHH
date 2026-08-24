-- ═══════════ PARCHE · FECHAS EN EPOCH-MS (INV. 3/6) ═══════════
-- Prisma almacena DateTime de SQLite como ENTERO en milisegundos epoch.
-- Comparar esas columnas contra strftime() (texto) siempre daba falso por
-- la precedencia de tipos de SQLite (INTEGER < TEXT). Se reemplazan las
-- comparaciones por aritmetica epoch-ms y se deja de escribir texto ISO
-- en columnas que el cliente espera leer como DateTime.

DROP TRIGGER IF EXISTS trg_ur_inv3_autorizacion_previa;
CREATE TRIGGER trg_ur_inv3_autorizacion_previa
BEFORE INSERT ON "UsuarioRol"
FOR EACH ROW
WHEN NEW."asignadoPorId" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "Rol" r WHERE r."id" = NEW."rolId" AND r."nivelAutoridad" >= 30
  ) AND NOT EXISTS (
    SELECT 1 FROM "AutorizacionRol" a
    WHERE a."beneficiarioId" = NEW."usuarioId"
      AND a."rolId" = NEW."rolId"
      AND a."estado" = 'AUTORIZADA'
      AND a."consumidaEn" IS NULL
      AND (a."venceEn" IS NULL OR a."venceEn" > CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
      AND a."autorizadaPorId" IS NOT NULL
      AND a."autorizadaPorId" <> NEW."asignadoPorId"
      AND a."autorizadaPorId" <> NEW."usuarioId"
)
BEGIN
  SELECT RAISE(ABORT, 'INV3_SIN_AUTORIZACION_VIGENTE');
END;

DROP TRIGGER IF EXISTS trg_ur_consumir_autorizacion;
CREATE TRIGGER trg_ur_consumir_autorizacion
AFTER INSERT ON "UsuarioRol"
FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM "Rol" r WHERE r."id" = NEW."rolId" AND r."nivelAutoridad" >= 30
)
BEGIN
  UPDATE "AutorizacionRol"
  SET "consumidaEn" = CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)
  WHERE "beneficiarioId" = NEW."usuarioId"
    AND "rolId" = NEW."rolId"
    AND "estado" = 'AUTORIZADA'
    AND "consumidaEn" IS NULL;
END;

DROP TRIGGER IF EXISTS trg_ur_inv6_incompatibilidad;
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
        AND x."vigenciaDesde" <= CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)
        AND (x."vigenciaHasta" IS NULL OR x."vigenciaHasta" > CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
    )
)
BEGIN
  SELECT RAISE(ABORT, 'INV6_ROLES_INCOMPATIBLES');
END;
