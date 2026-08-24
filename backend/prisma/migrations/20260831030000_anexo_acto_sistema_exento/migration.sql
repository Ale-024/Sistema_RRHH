-- ═══════════ PARCHE · EXENCIÓN DE ACTOS DEL SISTEMA (INV. 2/3) ═══════════
-- El Anexo (sec. 3) contempla como excepcion documentada los actos de
-- instalacion: el primer administrador se siembra por script con actor
-- SISTEMA. En UsuarioRol eso equivale a asignadoPorId NULL, que solo el
-- backend siembra o el alta automatica por puesto produce; toda ruta HTTP
-- siempre estampa el ejecutor. Se exime del requisito de autorizacion unicamente
-- ese camino, para permitir el arranque inicial (primer DIRECCION / primer ADMIN_TI).

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
      AND (a."venceEn" IS NULL OR a."venceEn" > strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      AND a."autorizadaPorId" IS NOT NULL
      AND a."autorizadaPorId" <> NEW."asignadoPorId"
      AND a."autorizadaPorId" <> NEW."usuarioId"
)
BEGIN
  SELECT RAISE(ABORT, 'INV3_SIN_AUTORIZACION_VIGENTE');
END;
