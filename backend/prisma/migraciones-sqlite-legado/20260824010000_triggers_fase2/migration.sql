-- Invariantes legales que Prisma no expresa. SQLite no admite CHECK
-- en este contexto de migracion, por lo que se usan triggers ABORT.

-- ─────────────── AUDITORIA: append-only ───────────────
CREATE TRIGGER trg_auditoria_no_update
BEFORE UPDATE ON Auditoria
BEGIN
  SELECT RAISE(ABORT, 'AUDITORIA_INMUTABLE');
END;

CREATE TRIGGER trg_auditoria_no_delete
BEFORE DELETE ON Auditoria
BEGIN
  SELECT RAISE(ABORT, 'AUDITORIA_INMUTABLE');
END;

-- ─────────────── CONTRATO ───────────────
-- Un unico contrato vigente (sin fecha de fin) por empleado.
CREATE UNIQUE INDEX ux_contrato_vigente
  ON Contrato(empleado_id) WHERE vigenciaHasta IS NULL;

CREATE TRIGGER trg_contrato_vigencia
BEFORE INSERT ON Contrato
FOR EACH ROW WHEN NEW.vigenciaHasta IS NOT NULL AND NEW.vigenciaHasta < NEW.vigenciaDesde
BEGIN
  SELECT RAISE(ABORT, 'VIGENCIA_CONTRATO_INVALIDA');
END;

CREATE TRIGGER trg_contrato_vigencia_update
BEFORE UPDATE ON Contrato
FOR EACH ROW WHEN NEW.vigenciaHasta IS NOT NULL AND NEW.vigenciaHasta < NEW.vigenciaDesde
BEGIN
  SELECT RAISE(ABORT, 'VIGENCIA_CONTRATO_INVALIDA');
END;
