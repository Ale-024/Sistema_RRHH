-- ═══════════ INVARIANTES POR TRIGGER · PORT DE SQLITE A POSTGRESQL ═══════════
-- Port 1:1 de las migraciones de triggers de la version SQLite. Cada trigger
-- preserva el mensaje de abort original (los tests y el manejo de errores
-- confian en esos codigos). En Postgres los triggers usan funciones plpgsql.

-- ─────────────── AUDITORIA: append-only ───────────────
CREATE OR REPLACE FUNCTION trg_auditoria_no_update_fn() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AUDITORIA_INMUTABLE';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auditoria_no_update BEFORE UPDATE ON "Auditoria"
FOR EACH ROW EXECUTE FUNCTION trg_auditoria_no_update_fn();

CREATE TRIGGER trg_auditoria_no_delete BEFORE DELETE ON "Auditoria"
FOR EACH ROW EXECUTE FUNCTION trg_auditoria_no_update_fn();

-- ─────────────── CONTRATO ───────────────
-- Un unico contrato vigente (sin fecha de fin) por empleado.
CREATE UNIQUE INDEX "ux_contrato_vigente" ON "Contrato"("empleado_id") WHERE "vigenciaHasta" IS NULL;

CREATE OR REPLACE FUNCTION trg_contrato_vigencia_fn() RETURNS trigger AS $$
BEGIN
  IF NEW."vigenciaHasta" IS NOT NULL AND NEW."vigenciaHasta" < NEW."vigenciaDesde" THEN
    RAISE EXCEPTION 'VIGENCIA_CONTRATO_INVALIDA';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_contrato_vigencia BEFORE INSERT ON "Contrato"
FOR EACH ROW EXECUTE FUNCTION trg_contrato_vigencia_fn();

CREATE TRIGGER trg_contrato_vigencia_update BEFORE UPDATE ON "Contrato"
FOR EACH ROW EXECUTE FUNCTION trg_contrato_vigencia_fn();

-- ─────────────── ASISTENCIA / MARCAJE ───────────────
CREATE OR REPLACE FUNCTION trg_asistencia_cerrada_no_update_fn() RETURNS trigger AS $$
BEGIN
  IF OLD."cerrado" AND NEW."cerrado" THEN
    RAISE EXCEPTION 'ASISTENCIA_DIA_CERRADO';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_asistencia_cerrada_no_update BEFORE UPDATE ON "RegistroAsistencia"
FOR EACH ROW EXECUTE FUNCTION trg_asistencia_cerrada_no_update_fn();

CREATE OR REPLACE FUNCTION trg_asistencia_cerrada_no_delete_fn() RETURNS trigger AS $$
BEGIN
  IF OLD."cerrado" THEN
    RAISE EXCEPTION 'ASISTENCIA_DIA_CERRADO';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_asistencia_cerrada_no_delete BEFORE DELETE ON "RegistroAsistencia"
FOR EACH ROW EXECUTE FUNCTION trg_asistencia_cerrada_no_delete_fn();

CREATE OR REPLACE FUNCTION trg_marcaje_inmutable_fn() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'MARCAJE_INMUTABLE';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_marcaje_no_update BEFORE UPDATE ON "Marcaje"
FOR EACH ROW EXECUTE FUNCTION trg_marcaje_inmutable_fn();

CREATE TRIGGER trg_marcaje_no_delete BEFORE DELETE ON "Marcaje"
FOR EACH ROW EXECUTE FUNCTION trg_marcaje_inmutable_fn();

-- ─────────────── PERMISOS (CU03) ───────────────
CREATE OR REPLACE FUNCTION trg_permiso_fechas_validas_fn() RETURNS trigger AS $$
BEGIN
  IF NEW."fechaFin" < NEW."fechaInicio" THEN
    RAISE EXCEPTION 'PERMISO_RANGO_INVALIDO';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_permiso_fechas_validas BEFORE INSERT ON "SolicitudPermiso"
FOR EACH ROW EXECUTE FUNCTION trg_permiso_fechas_validas_fn();

CREATE TRIGGER trg_permiso_fechas_validas_update BEFORE UPDATE ON "SolicitudPermiso"
FOR EACH ROW EXECUTE FUNCTION trg_permiso_fechas_validas_fn();

-- Solo EN_REVISION y APROBADO reservan el rango.
CREATE OR REPLACE FUNCTION trg_permiso_solapamiento_insert_fn() RETURNS trigger AS $$
BEGIN
  IF NEW."estado" IN ('EN_REVISION', 'APROBADO') AND EXISTS (
    SELECT 1 FROM "SolicitudPermiso" p
    WHERE p."empleadoId" = NEW."empleadoId"
      AND p."estado" IN ('EN_REVISION', 'APROBADO')
      AND p."fechaInicio" <= NEW."fechaFin"
      AND p."fechaFin" >= NEW."fechaInicio"
  ) THEN
    RAISE EXCEPTION 'PERMISO_SOLAPADO';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_permiso_solapamiento_insert BEFORE INSERT ON "SolicitudPermiso"
FOR EACH ROW EXECUTE FUNCTION trg_permiso_solapamiento_insert_fn();

CREATE OR REPLACE FUNCTION trg_permiso_solapamiento_update_fn() RETURNS trigger AS $$
BEGIN
  IF NEW."estado" IN ('EN_REVISION', 'APROBADO') AND EXISTS (
    SELECT 1 FROM "SolicitudPermiso" p
    WHERE p."id" <> NEW."id"
      AND p."empleadoId" = NEW."empleadoId"
      AND p."estado" IN ('EN_REVISION', 'APROBADO')
      AND p."fechaInicio" <= NEW."fechaFin"
      AND p."fechaFin" >= NEW."fechaInicio"
  ) THEN
    RAISE EXCEPTION 'PERMISO_SOLAPADO';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_permiso_solapamiento_update BEFORE UPDATE ON "SolicitudPermiso"
FOR EACH ROW EXECUTE FUNCTION trg_permiso_solapamiento_update_fn();

-- FSM persistente: no se puede saltar estados ni reabrir estados finales.
CREATE OR REPLACE FUNCTION trg_permiso_transicion_valida_fn() RETURNS trigger AS $$
BEGIN
  IF OLD."estado" <> NEW."estado" AND NOT (
    (OLD."estado" = 'SOLICITADO' AND NEW."estado" IN ('EN_REVISION', 'CANCELADO'))
    OR (OLD."estado" = 'EN_REVISION' AND NEW."estado" IN ('APROBADO', 'RECHAZADO', 'SOLICITADO'))
  ) THEN
    RAISE EXCEPTION 'PERMISO_TRANSICION_INVALIDA';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_permiso_transicion_valida BEFORE UPDATE ON "SolicitudPermiso"
FOR EACH ROW EXECUTE FUNCTION trg_permiso_transicion_valida_fn();

CREATE OR REPLACE FUNCTION trg_permiso_estado_final_no_update_fn() RETURNS trigger AS $$
BEGIN
  IF OLD."estado" IN ('APROBADO', 'RECHAZADO', 'CANCELADO') THEN
    RAISE EXCEPTION 'PERMISO_ESTADO_FINAL';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_permiso_estado_final_no_update BEFORE UPDATE ON "SolicitudPermiso"
FOR EACH ROW EXECUTE FUNCTION trg_permiso_estado_final_no_update_fn();

CREATE OR REPLACE FUNCTION trg_permiso_historial_inmutable_fn() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'PERMISO_HISTORIAL_INMUTABLE';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_permiso_historial_no_update BEFORE UPDATE ON "PermisoHistorialEstado"
FOR EACH ROW EXECUTE FUNCTION trg_permiso_historial_inmutable_fn();

CREATE TRIGGER trg_permiso_historial_no_delete BEFORE DELETE ON "PermisoHistorialEstado"
FOR EACH ROW EXECUTE FUNCTION trg_permiso_historial_inmutable_fn();

-- Indice parcial: acelera y documenta el conjunto que puede reservar dias.
CREATE INDEX "SolicitudPermiso_solapamiento_idx"
  ON "SolicitudPermiso"("empleadoId", "fechaInicio", "fechaFin")
  WHERE "estado" IN ('EN_REVISION', 'APROBADO');

-- ─────────────── VACACIONES (CU04) ───────────────
CREATE OR REPLACE FUNCTION trg_parametro_legal_vigencias_fn() RETURNS trigger AS $$
BEGIN
  IF NEW."vigenciaHasta" IS NOT NULL AND NEW."vigenciaHasta" < NEW."vigenciaDesde" THEN
    RAISE EXCEPTION 'PARAMETRO_LEGAL_RANGO_INVALIDO';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_parametro_legal_vigencias BEFORE INSERT ON "ParametroLegal"
FOR EACH ROW EXECUTE FUNCTION trg_parametro_legal_vigencias_fn();

CREATE OR REPLACE FUNCTION trg_parametro_legal_solapado_fn() RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "ParametroLegal" p
    WHERE p."clave" = NEW."clave" AND p."activo"
      AND p."vigenciaDesde" <= COALESCE(NEW."vigenciaHasta", 'infinity'::timestamp)
      AND COALESCE(p."vigenciaHasta", 'infinity'::timestamp) >= NEW."vigenciaDesde"
  ) THEN
    RAISE EXCEPTION 'PARAMETRO_LEGAL_VIGENCIA_SOLAPADA';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_parametro_legal_solapado BEFORE INSERT ON "ParametroLegal"
FOR EACH ROW EXECUTE FUNCTION trg_parametro_legal_solapado_fn();

CREATE TRIGGER trg_parametro_legal_update_rango BEFORE UPDATE OF "vigenciaDesde", "vigenciaHasta" ON "ParametroLegal"
FOR EACH ROW EXECUTE FUNCTION trg_parametro_legal_vigencias_fn();

CREATE OR REPLACE FUNCTION trg_parametro_legal_update_solapado_fn() RETURNS trigger AS $$
BEGIN
  IF NEW."activo" AND EXISTS (
    SELECT 1 FROM "ParametroLegal" p
    WHERE p."id" <> NEW."id" AND p."clave" = NEW."clave" AND p."activo"
      AND p."vigenciaDesde" <= COALESCE(NEW."vigenciaHasta", 'infinity'::timestamp)
      AND COALESCE(p."vigenciaHasta", 'infinity'::timestamp) >= NEW."vigenciaDesde"
  ) THEN
    RAISE EXCEPTION 'PARAMETRO_LEGAL_VIGENCIA_SOLAPADA';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_parametro_legal_update_solapado BEFORE UPDATE OF "clave", "vigenciaDesde", "vigenciaHasta", "activo" ON "ParametroLegal"
FOR EACH ROW EXECUTE FUNCTION trg_parametro_legal_update_solapado_fn();

CREATE OR REPLACE FUNCTION trg_vacacion_fechas_validas_fn() RETURNS trigger AS $$
BEGIN
  IF NEW."fechaFin" < NEW."fechaInicio" THEN
    RAISE EXCEPTION 'VACACION_RANGO_INVALIDO';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_vacacion_fechas_validas BEFORE INSERT ON "SolicitudVacacion"
FOR EACH ROW EXECUTE FUNCTION trg_vacacion_fechas_validas_fn();

CREATE TRIGGER trg_vacacion_fechas_validas_update BEFORE UPDATE ON "SolicitudVacacion"
FOR EACH ROW EXECUTE FUNCTION trg_vacacion_fechas_validas_fn();

CREATE OR REPLACE FUNCTION trg_vacacion_solapamiento_insert_fn() RETURNS trigger AS $$
BEGIN
  IF NEW."estado" IN ('EN_REVISION', 'APROBADO') AND EXISTS (
    SELECT 1 FROM "SolicitudVacacion" s
    WHERE s."empleadoId" = NEW."empleadoId"
      AND s."estado" IN ('EN_REVISION', 'APROBADO')
      AND s."fechaInicio" <= NEW."fechaFin" AND s."fechaFin" >= NEW."fechaInicio"
  ) THEN
    RAISE EXCEPTION 'VACACION_SOLAPADA';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_vacacion_solapamiento_insert BEFORE INSERT ON "SolicitudVacacion"
FOR EACH ROW EXECUTE FUNCTION trg_vacacion_solapamiento_insert_fn();

CREATE OR REPLACE FUNCTION trg_vacacion_solapamiento_update_fn() RETURNS trigger AS $$
BEGIN
  IF NEW."estado" IN ('EN_REVISION', 'APROBADO') AND EXISTS (
    SELECT 1 FROM "SolicitudVacacion" s
    WHERE s."id" <> NEW."id" AND s."empleadoId" = NEW."empleadoId"
      AND s."estado" IN ('EN_REVISION', 'APROBADO')
      AND s."fechaInicio" <= NEW."fechaFin" AND s."fechaFin" >= NEW."fechaInicio"
  ) THEN
    RAISE EXCEPTION 'VACACION_SOLAPADA';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_vacacion_solapamiento_update BEFORE UPDATE ON "SolicitudVacacion"
FOR EACH ROW EXECUTE FUNCTION trg_vacacion_solapamiento_update_fn();

CREATE OR REPLACE FUNCTION trg_vacacion_transicion_valida_fn() RETURNS trigger AS $$
BEGIN
  IF OLD."estado" <> NEW."estado" AND NOT (
    (OLD."estado" = 'SOLICITADO' AND NEW."estado" IN ('EN_REVISION', 'CANCELADO'))
    OR (OLD."estado" = 'EN_REVISION' AND NEW."estado" IN ('APROBADO', 'RECHAZADO', 'SOLICITADO'))
  ) THEN
    RAISE EXCEPTION 'VACACION_TRANSICION_INVALIDA';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_vacacion_transicion_valida BEFORE UPDATE ON "SolicitudVacacion"
FOR EACH ROW EXECUTE FUNCTION trg_vacacion_transicion_valida_fn();

CREATE OR REPLACE FUNCTION trg_vacacion_estado_final_no_update_fn() RETURNS trigger AS $$
BEGIN
  IF OLD."estado" IN ('APROBADO', 'RECHAZADO', 'CANCELADO') THEN
    RAISE EXCEPTION 'VACACION_ESTADO_FINAL';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_vacacion_estado_final_no_update BEFORE UPDATE ON "SolicitudVacacion"
FOR EACH ROW EXECUTE FUNCTION trg_vacacion_estado_final_no_update_fn();

CREATE OR REPLACE FUNCTION trg_vacacion_historial_inmutable_fn() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'VACACION_HISTORIAL_INMUTABLE';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_vacacion_historial_no_update BEFORE UPDATE ON "VacacionHistorialEstado"
FOR EACH ROW EXECUTE FUNCTION trg_vacacion_historial_inmutable_fn();

CREATE TRIGGER trg_vacacion_historial_no_delete BEFORE DELETE ON "VacacionHistorialEstado"
FOR EACH ROW EXECUTE FUNCTION trg_vacacion_historial_inmutable_fn();

-- El movimiento solo puede ingresar si el saldo resultante permanece dentro
-- de [0, diasDerecho]. UPDATE/DELETE quedan prohibidos para reconstruibilidad.
CREATE OR REPLACE FUNCTION trg_movimiento_saldo_vacacion_limites_fn() RETURNS trigger AS $$
DECLARE saldo_actual REAL;
BEGIN
  SELECT COALESCE(SUM(m."dias"), 0) INTO saldo_actual FROM "MovimientoSaldoVacacion" m WHERE m."periodoId" = NEW."periodoId";
  IF saldo_actual + NEW."dias" < 0 THEN
    RAISE EXCEPTION 'SALDO_VACACIONES_INSUFICIENTE';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_movimiento_saldo_vacacion_limites BEFORE INSERT ON "MovimientoSaldoVacacion"
FOR EACH ROW EXECUTE FUNCTION trg_movimiento_saldo_vacacion_limites_fn();

CREATE OR REPLACE FUNCTION trg_movimiento_saldo_vacacion_excedido_fn() RETURNS trigger AS $$
DECLARE saldo_actual REAL; derecho REAL;
BEGIN
  SELECT COALESCE(SUM(m."dias"), 0) INTO saldo_actual FROM "MovimientoSaldoVacacion" m WHERE m."periodoId" = NEW."periodoId";
  SELECT p."diasDerecho" INTO derecho FROM "PeriodoVacacional" p WHERE p."id" = NEW."periodoId";
  IF saldo_actual + NEW."dias" > derecho THEN
    RAISE EXCEPTION 'SALDO_VACACIONES_EXCEDIDO';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_movimiento_saldo_vacacion_excedido BEFORE INSERT ON "MovimientoSaldoVacacion"
FOR EACH ROW EXECUTE FUNCTION trg_movimiento_saldo_vacacion_excedido_fn();

CREATE OR REPLACE FUNCTION trg_movimiento_saldo_inmutable_fn() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'MOVIMIENTO_SALDO_INMUTABLE';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_movimiento_saldo_vacacion_no_update BEFORE UPDATE ON "MovimientoSaldoVacacion"
FOR EACH ROW EXECUTE FUNCTION trg_movimiento_saldo_inmutable_fn();

CREATE TRIGGER trg_movimiento_saldo_vacacion_no_delete BEFORE DELETE ON "MovimientoSaldoVacacion"
FOR EACH ROW EXECUTE FUNCTION trg_movimiento_saldo_inmutable_fn();

CREATE OR REPLACE FUNCTION trg_periodo_vacacional_resumen_limites_fn() RETURNS trigger AS $$
BEGIN
  IF NEW."diasGozados" < 0 OR NEW."diasPagados" < 0
     OR NEW."diasGozados" + NEW."diasPagados" > NEW."diasDerecho" THEN
    RAISE EXCEPTION 'SALDO_VACACIONES_EXCEDIDO';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_periodo_vacacional_resumen_limites BEFORE UPDATE OF "diasGozados", "diasPagados" ON "PeriodoVacacional"
FOR EACH ROW EXECUTE FUNCTION trg_periodo_vacacional_resumen_limites_fn();

-- Indice parcial de solapamiento de vacaciones.
CREATE INDEX "SolicitudVacacion_solapamiento_idx"
  ON "SolicitudVacacion"("empleadoId", "fechaInicio", "fechaFin")
  WHERE "estado" IN ('EN_REVISION', 'APROBADO');

-- ─────────────── PLANILLA (CU05) ───────────────
-- Catalogo minimo inicial (antes vivia en la migracion SQLite de Fase 6).
INSERT INTO "Concepto" ("codigo", "nombre", "tipo", "gravableIsr", "afectaIhss", "formulaClave", "orden")
SELECT 'SUELDO', 'Sueldo ordinario', 'INGRESO', true, true, 'SUELDO', 10
WHERE NOT EXISTS (SELECT 1 FROM "Concepto" WHERE "codigo" = 'SUELDO');
INSERT INTO "Concepto" ("codigo", "nombre", "tipo", "gravableIsr", "afectaIhss", "formulaClave", "orden")
SELECT 'H_EXTRA_D', 'Hora extra diurna', 'INGRESO', true, true, 'H_EXTRA_D', 20
WHERE NOT EXISTS (SELECT 1 FROM "Concepto" WHERE "codigo" = 'H_EXTRA_D');
INSERT INTO "Concepto" ("codigo", "nombre", "tipo", "gravableIsr", "afectaIhss", "formulaClave", "orden")
SELECT 'H_EXTRA_N', 'Hora extra nocturna', 'INGRESO', true, true, 'H_EXTRA_N', 21
WHERE NOT EXISTS (SELECT 1 FROM "Concepto" WHERE "codigo" = 'H_EXTRA_N');
INSERT INTO "Concepto" ("codigo", "nombre", "tipo", "gravableIsr", "afectaIhss", "formulaClave", "orden")
SELECT 'IHSS_EM_TRAB', 'IHSS trabajador', 'DEDUCCION', false, false, 'IHSS_EM_TRAB', 40
WHERE NOT EXISTS (SELECT 1 FROM "Concepto" WHERE "codigo" = 'IHSS_EM_TRAB');
INSERT INTO "Concepto" ("codigo", "nombre", "tipo", "gravableIsr", "afectaIhss", "formulaClave", "orden")
SELECT 'RAP_TRAB', 'RAP trabajador', 'DEDUCCION', false, false, 'RAP_TRAB', 50
WHERE NOT EXISTS (SELECT 1 FROM "Concepto" WHERE "codigo" = 'RAP_TRAB');
INSERT INTO "Concepto" ("codigo", "nombre", "tipo", "gravableIsr", "afectaIhss", "formulaClave", "orden")
SELECT 'ISR', 'Impuesto sobre la renta', 'DEDUCCION', false, false, 'ISR', 60
WHERE NOT EXISTS (SELECT 1 FROM "Concepto" WHERE "codigo" = 'ISR');
INSERT INTO "Concepto" ("codigo", "nombre", "tipo", "gravableIsr", "afectaIhss", "formulaClave", "orden")
SELECT 'IHSS_EM_PATR', 'IHSS patronal', 'APORTE_PATRONAL', false, false, 'IHSS_EM_PATR', 70
WHERE NOT EXISTS (SELECT 1 FROM "Concepto" WHERE "codigo" = 'IHSS_EM_PATR');
INSERT INTO "Concepto" ("codigo", "nombre", "tipo", "gravableIsr", "afectaIhss", "formulaClave", "orden")
SELECT 'RAP_PATR', 'RAP patronal', 'APORTE_PATRONAL', false, false, 'RAP_PATR', 80
WHERE NOT EXISTS (SELECT 1 FROM "Concepto" WHERE "codigo" = 'RAP_PATR');

-- Parametros legales de planilla (tasas y techos de referencia 2026).
INSERT INTO "ParametroLegal" ("clave", "valor", "unidad", "descripcion", "baseLegal", "vigenciaDesde")
SELECT 'IHSS_EM_TRAB', '0.025', 'PORCENTAJE', 'IHSS Enfermedad y Maternidad trabajador', 'Ley de aportaciones y cotizaciones del IHSS', '2020-01-01T00:00:00'::timestamp
WHERE NOT EXISTS (SELECT 1 FROM "ParametroLegal" WHERE "clave" = 'IHSS_EM_TRAB' AND "vigenciaDesde" = '2020-01-01T00:00:00'::timestamp);
INSERT INTO "ParametroLegal" ("clave", "valor", "unidad", "descripcion", "baseLegal", "vigenciaDesde")
SELECT 'IHSS_IVM_TRAB', '0.025', 'PORCENTAJE', 'IHSS Invalidez, Vejez y Muerte trabajador', 'Ley de aportaciones y cotizaciones del IHSS', '2020-01-01T00:00:00'::timestamp
WHERE NOT EXISTS (SELECT 1 FROM "ParametroLegal" WHERE "clave" = 'IHSS_IVM_TRAB' AND "vigenciaDesde" = '2020-01-01T00:00:00'::timestamp);
INSERT INTO "ParametroLegal" ("clave", "valor", "unidad", "descripcion", "baseLegal", "vigenciaDesde")
SELECT 'IHSS_EM_PATR', '0.05', 'PORCENTAJE', 'IHSS Enfermedad y Maternidad patronal', 'Ley de aportaciones y cotizaciones del IHSS', '2020-01-01T00:00:00'::timestamp
WHERE NOT EXISTS (SELECT 1 FROM "ParametroLegal" WHERE "clave" = 'IHSS_EM_PATR' AND "vigenciaDesde" = '2020-01-01T00:00:00'::timestamp);
INSERT INTO "ParametroLegal" ("clave", "valor", "unidad", "descripcion", "baseLegal", "vigenciaDesde")
SELECT 'IHSS_IVM_PATR', '0.035', 'PORCENTAJE', 'IHSS Invalidez, Vejez y Muerte patronal', 'Ley de aportaciones y cotizaciones del IHSS', '2020-01-01T00:00:00'::timestamp
WHERE NOT EXISTS (SELECT 1 FROM "ParametroLegal" WHERE "clave" = 'IHSS_IVM_PATR' AND "vigenciaDesde" = '2020-01-01T00:00:00'::timestamp);
INSERT INTO "ParametroLegal" ("clave", "valor", "unidad", "descripcion", "baseLegal", "vigenciaDesde")
SELECT 'TECHO_IHSS', '1190313', 'MONTO_CENT', 'Techo mensual de cotizacion IHSS', 'PCM 048-2024; confirmar antes de cada ejercicio', '2020-01-01T00:00:00'::timestamp
WHERE NOT EXISTS (SELECT 1 FROM "ParametroLegal" WHERE "clave" = 'TECHO_IHSS' AND "vigenciaDesde" = '2020-01-01T00:00:00'::timestamp);
INSERT INTO "ParametroLegal" ("clave", "valor", "unidad", "descripcion", "baseLegal", "vigenciaDesde")
SELECT 'RAP_TRAB', '0.015', 'PORCENTAJE', 'RAP trabajador', 'Comunicado de techos y porcentajes RAP; confirmar antes de cada ejercicio', '2020-01-01T00:00:00'::timestamp
WHERE NOT EXISTS (SELECT 1 FROM "ParametroLegal" WHERE "clave" = 'RAP_TRAB' AND "vigenciaDesde" = '2020-01-01T00:00:00'::timestamp);
INSERT INTO "ParametroLegal" ("clave", "valor", "unidad", "descripcion", "baseLegal", "vigenciaDesde")
SELECT 'RAP_PATR', '0.015', 'PORCENTAJE', 'RAP patronal', 'Comunicado de techos y porcentajes RAP; confirmar antes de cada ejercicio', '2020-01-01T00:00:00'::timestamp
WHERE NOT EXISTS (SELECT 1 FROM "ParametroLegal" WHERE "clave" = 'RAP_PATR' AND "vigenciaDesde" = '2020-01-01T00:00:00'::timestamp);
INSERT INTO "ParametroLegal" ("clave", "valor", "unidad", "descripcion", "baseLegal", "vigenciaDesde")
SELECT 'RAP_PISO_CENT', '0', 'MONTO_CENT', 'Piso de cotizacion RAP', 'Parametrizado para ajustes normativos', '2020-01-01T00:00:00'::timestamp
WHERE NOT EXISTS (SELECT 1 FROM "ParametroLegal" WHERE "clave" = 'RAP_PISO_CENT' AND "vigenciaDesde" = '2020-01-01T00:00:00'::timestamp);
INSERT INTO "ParametroLegal" ("clave", "valor", "unidad", "descripcion", "baseLegal", "vigenciaDesde")
SELECT 'H_EXTRA_DIURNA_RECARGO', '0.25', 'PORCENTAJE', 'Recargo de hora extra diurna', 'Codigo de Trabajo; confirmar antes de cada ejercicio', '2020-01-01T00:00:00'::timestamp
WHERE NOT EXISTS (SELECT 1 FROM "ParametroLegal" WHERE "clave" = 'H_EXTRA_DIURNA_RECARGO' AND "vigenciaDesde" = '2020-01-01T00:00:00'::timestamp);
INSERT INTO "ParametroLegal" ("clave", "valor", "unidad", "descripcion", "baseLegal", "vigenciaDesde")
SELECT 'H_EXTRA_NOCTURNA_RECARGO', '0.5', 'PORCENTAJE', 'Recargo de hora extra nocturna', 'Codigo de Trabajo; confirmar antes de cada ejercicio', '2020-01-01T00:00:00'::timestamp
WHERE NOT EXISTS (SELECT 1 FROM "ParametroLegal" WHERE "clave" = 'H_EXTRA_NOCTURNA_RECARGO' AND "vigenciaDesde" = '2020-01-01T00:00:00'::timestamp);
INSERT INTO "ParametroLegal" ("clave", "valor", "unidad", "descripcion", "baseLegal", "vigenciaDesde")
SELECT 'ISR_EXENTO_ANUAL_CENT', '21749316', 'MONTO_CENT', 'Monto anual exento ISR persona natural', 'Acuerdo SAR-07-2025; confirmar la tabla del ejercicio vigente', '2025-01-01T00:00:00'::timestamp
WHERE NOT EXISTS (SELECT 1 FROM "ParametroLegal" WHERE "clave" = 'ISR_EXENTO_ANUAL_CENT' AND "vigenciaDesde" = '2025-01-01T00:00:00'::timestamp);
INSERT INTO "ParametroLegal" ("clave", "valor", "unidad", "descripcion", "baseLegal", "vigenciaDesde")
SELECT 'ISR_TRAMO_1_LIMITE_ANUAL_CENT', '33163850', 'MONTO_CENT', 'Limite superior tramo ISR 15%', 'Acuerdo SAR-07-2025; confirmar la tabla del ejercicio vigente', '2025-01-01T00:00:00'::timestamp
WHERE NOT EXISTS (SELECT 1 FROM "ParametroLegal" WHERE "clave" = 'ISR_TRAMO_1_LIMITE_ANUAL_CENT' AND "vigenciaDesde" = '2025-01-01T00:00:00'::timestamp);
INSERT INTO "ParametroLegal" ("clave", "valor", "unidad", "descripcion", "baseLegal", "vigenciaDesde")
SELECT 'ISR_TRAMO_1_TASA', '0.15', 'PORCENTAJE', 'Tasa ISR tramo 1', 'Acuerdo SAR-07-2025; confirmar la tabla del ejercicio vigente', '2025-01-01T00:00:00'::timestamp
WHERE NOT EXISTS (SELECT 1 FROM "ParametroLegal" WHERE "clave" = 'ISR_TRAMO_1_TASA' AND "vigenciaDesde" = '2025-01-01T00:00:00'::timestamp);
INSERT INTO "ParametroLegal" ("clave", "valor", "unidad", "descripcion", "baseLegal", "vigenciaDesde")
SELECT 'ISR_TRAMO_2_LIMITE_ANUAL_CENT', '77125238', 'MONTO_CENT', 'Limite superior tramo ISR 20%', 'Acuerdo SAR-07-2025; confirmar la tabla del ejercicio vigente', '2025-01-01T00:00:00'::timestamp
WHERE NOT EXISTS (SELECT 1 FROM "ParametroLegal" WHERE "clave" = 'ISR_TRAMO_2_LIMITE_ANUAL_CENT' AND "vigenciaDesde" = '2025-01-01T00:00:00'::timestamp);
INSERT INTO "ParametroLegal" ("clave", "valor", "unidad", "descripcion", "baseLegal", "vigenciaDesde")
SELECT 'ISR_TRAMO_2_TASA', '0.20', 'PORCENTAJE', 'Tasa ISR tramo 2', 'Acuerdo SAR-07-2025; confirmar la tabla del ejercicio vigente', '2025-01-01T00:00:00'::timestamp
WHERE NOT EXISTS (SELECT 1 FROM "ParametroLegal" WHERE "clave" = 'ISR_TRAMO_2_TASA' AND "vigenciaDesde" = '2025-01-01T00:00:00'::timestamp);
INSERT INTO "ParametroLegal" ("clave", "valor", "unidad", "descripcion", "baseLegal", "vigenciaDesde")
SELECT 'ISR_TRAMO_3_LIMITE_ANUAL_CENT', '999999999999', 'MONTO_CENT', 'Limite superior tramo ISR 25%', 'Acuerdo SAR-07-2025; tramo abierto superior', '2025-01-01T00:00:00'::timestamp
WHERE NOT EXISTS (SELECT 1 FROM "ParametroLegal" WHERE "clave" = 'ISR_TRAMO_3_LIMITE_ANUAL_CENT' AND "vigenciaDesde" = '2025-01-01T00:00:00'::timestamp);
INSERT INTO "ParametroLegal" ("clave", "valor", "unidad", "descripcion", "baseLegal", "vigenciaDesde")
SELECT 'ISR_TRAMO_3_TASA', '0.25', 'PORCENTAJE', 'Tasa ISR tramo 3', 'Acuerdo SAR-07-2025; confirmar la tabla del ejercicio vigente', '2025-01-01T00:00:00'::timestamp
WHERE NOT EXISTS (SELECT 1 FROM "ParametroLegal" WHERE "clave" = 'ISR_TRAMO_3_TASA' AND "vigenciaDesde" = '2025-01-01T00:00:00'::timestamp);

CREATE OR REPLACE FUNCTION trg_periodo_planilla_fechas_validas_fn() RETURNS trigger AS $$
BEGIN
  IF NEW."fechaFin" < NEW."fechaInicio" THEN
    RAISE EXCEPTION 'PLANILLA_RANGO_INVALIDO';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_periodo_planilla_fechas_validas BEFORE INSERT ON "PeriodoPlanilla"
FOR EACH ROW EXECUTE FUNCTION trg_periodo_planilla_fechas_validas_fn();

CREATE TRIGGER trg_periodo_planilla_fechas_validas_update BEFORE UPDATE ON "PeriodoPlanilla"
FOR EACH ROW EXECUTE FUNCTION trg_periodo_planilla_fechas_validas_fn();

CREATE OR REPLACE FUNCTION trg_periodo_planilla_transicion_valida_fn() RETURNS trigger AS $$
BEGIN
  IF OLD."estado" <> NEW."estado" AND NOT (
    (OLD."estado" = 'BORRADOR' AND NEW."estado" = 'CALCULADA')
    OR (OLD."estado" = 'CALCULADA' AND NEW."estado" = 'EN_APROBACION')
    OR (OLD."estado" = 'EN_APROBACION' AND NEW."estado" IN ('CALCULADA', 'CERRADA'))
    OR (OLD."estado" = 'CERRADA' AND NEW."estado" = 'PAGADA')
  ) THEN
    RAISE EXCEPTION 'PLANILLA_TRANSICION_INVALIDA';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_periodo_planilla_transicion_valida BEFORE UPDATE ON "PeriodoPlanilla"
FOR EACH ROW EXECUTE FUNCTION trg_periodo_planilla_transicion_valida_fn();

CREATE OR REPLACE FUNCTION trg_periodo_planilla_cierre_inmutable_fn() RETURNS trigger AS $$
BEGIN
  IF OLD."estado" IN ('CERRADA', 'PAGADA') AND NOT (
    OLD."estado" = 'CERRADA' AND NEW."estado" = 'PAGADA'
    AND NEW."codigo" = OLD."codigo" AND NEW."tipo" = OLD."tipo" AND NEW."periodicidad" = OLD."periodicidad"
    AND NEW."fechaInicio" = OLD."fechaInicio" AND NEW."fechaFin" = OLD."fechaFin" AND NEW."fechaPago" = OLD."fechaPago"
    AND NEW."periodoAjusteDeId" IS NOT DISTINCT FROM OLD."periodoAjusteDeId"
    AND NEW."totalBrutoCent" = OLD."totalBrutoCent" AND NEW."totalDeduccionesCent" = OLD."totalDeduccionesCent"
    AND NEW."totalNetoCent" = OLD."totalNetoCent" AND NEW."totalAportesPatronalesCent" = OLD."totalAportesPatronalesCent"
    AND NEW."calculadoPor" IS NOT DISTINCT FROM OLD."calculadoPor" AND NEW."calculadoEn" IS NOT DISTINCT FROM OLD."calculadoEn"
    AND NEW."errorCalculo" IS NOT DISTINCT FROM OLD."errorCalculo" AND NEW."cerradoPor" IS NOT DISTINCT FROM OLD."cerradoPor"
    AND NEW."cerradoEn" IS NOT DISTINCT FROM OLD."cerradoEn" AND NEW."hashCierre" IS NOT DISTINCT FROM OLD."hashCierre"
  ) THEN
    RAISE EXCEPTION 'PLANILLA_CERRADA_INMUTABLE';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_periodo_planilla_cierre_inmutable BEFORE UPDATE ON "PeriodoPlanilla"
FOR EACH ROW EXECUTE FUNCTION trg_periodo_planilla_cierre_inmutable_fn();

CREATE OR REPLACE FUNCTION trg_periodo_planilla_cerrar_con_hash_fn() RETURNS trigger AS $$
BEGIN
  IF NEW."estado" = 'CERRADA' AND (NEW."hashCierre" IS NULL OR length(NEW."hashCierre") < 64) THEN
    RAISE EXCEPTION 'PLANILLA_HASH_REQUERIDO';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_periodo_planilla_cerrar_con_hash BEFORE UPDATE ON "PeriodoPlanilla"
FOR EACH ROW EXECUTE FUNCTION trg_periodo_planilla_cerrar_con_hash_fn();

CREATE OR REPLACE FUNCTION trg_periodo_planilla_cuadre_fn() RETURNS trigger AS $$
BEGIN
  IF NEW."estado" IN ('CALCULADA', 'EN_APROBACION', 'CERRADA', 'PAGADA') AND (
    NEW."totalBrutoCent" <> (SELECT COALESCE(SUM(d."totalIngresosCent"), 0) FROM "DetallePlanilla" d WHERE d."periodoId" = NEW."id")
    OR NEW."totalDeduccionesCent" <> (SELECT COALESCE(SUM(d."totalDeduccionesCent"), 0) FROM "DetallePlanilla" d WHERE d."periodoId" = NEW."id")
    OR NEW."totalNetoCent" <> (SELECT COALESCE(SUM(d."netoPagarCent"), 0) FROM "DetallePlanilla" d WHERE d."periodoId" = NEW."id")
    OR NEW."totalAportesPatronalesCent" <> (SELECT COALESCE(SUM(d."totalAportesPatronalesCent"), 0) FROM "DetallePlanilla" d WHERE d."periodoId" = NEW."id")
  ) THEN
    RAISE EXCEPTION 'DESCUADRE_DETALLE_PLANILLA';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_periodo_planilla_cuadre BEFORE UPDATE ON "PeriodoPlanilla"
FOR EACH ROW EXECUTE FUNCTION trg_periodo_planilla_cuadre_fn();

CREATE OR REPLACE FUNCTION trg_periodo_planilla_no_delete_cerrada_fn() RETURNS trigger AS $$
BEGIN
  IF OLD."estado" IN ('CERRADA', 'PAGADA') THEN
    RAISE EXCEPTION 'PLANILLA_CERRADA_INMUTABLE';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_periodo_planilla_no_delete_cerrada BEFORE DELETE ON "PeriodoPlanilla"
FOR EACH ROW EXECUTE FUNCTION trg_periodo_planilla_no_delete_cerrada_fn();

CREATE OR REPLACE FUNCTION trg_detalle_planilla_no_insert_cerrada_fn() RETURNS trigger AS $$
DECLARE estado_periodo TEXT;
BEGIN
  SELECT "estado" INTO estado_periodo FROM "PeriodoPlanilla" WHERE "id" = NEW."periodoId";
  IF estado_periodo IN ('CERRADA', 'PAGADA') THEN
    RAISE EXCEPTION 'DETALLE_PLANILLA_INMUTABLE';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_detalle_planilla_no_insert_cerrada BEFORE INSERT ON "DetallePlanilla"
FOR EACH ROW EXECUTE FUNCTION trg_detalle_planilla_no_insert_cerrada_fn();

CREATE OR REPLACE FUNCTION trg_detalle_planilla_no_update_cerrada_fn() RETURNS trigger AS $$
DECLARE estado_periodo TEXT;
BEGIN
  SELECT "estado" INTO estado_periodo FROM "PeriodoPlanilla" WHERE "id" = OLD."periodoId";
  IF estado_periodo IN ('CERRADA', 'PAGADA') THEN
    RAISE EXCEPTION 'DETALLE_PLANILLA_INMUTABLE';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_detalle_planilla_no_update_cerrada BEFORE UPDATE ON "DetallePlanilla"
FOR EACH ROW EXECUTE FUNCTION trg_detalle_planilla_no_update_cerrada_fn();

CREATE OR REPLACE FUNCTION trg_detalle_planilla_no_delete_cerrada_fn() RETURNS trigger AS $$
DECLARE estado_periodo TEXT;
BEGIN
  SELECT "estado" INTO estado_periodo FROM "PeriodoPlanilla" WHERE "id" = OLD."periodoId";
  IF estado_periodo IN ('CERRADA', 'PAGADA') THEN
    RAISE EXCEPTION 'DETALLE_PLANILLA_INMUTABLE';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_detalle_planilla_no_delete_cerrada BEFORE DELETE ON "DetallePlanilla"
FOR EACH ROW EXECUTE FUNCTION trg_detalle_planilla_no_delete_cerrada_fn();

CREATE OR REPLACE FUNCTION trg_linea_planilla_no_insert_cerrada_fn() RETURNS trigger AS $$
DECLARE estado_periodo TEXT;
BEGIN
  SELECT p."estado" INTO estado_periodo
  FROM "PeriodoPlanilla" p JOIN "DetallePlanilla" d ON d."periodoId" = p."id"
  WHERE d."id" = NEW."detalleId";
  IF estado_periodo IN ('CERRADA', 'PAGADA') THEN
    RAISE EXCEPTION 'LINEA_PLANILLA_INMUTABLE';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_linea_planilla_no_insert_cerrada BEFORE INSERT ON "LineaConcepto"
FOR EACH ROW EXECUTE FUNCTION trg_linea_planilla_no_insert_cerrada_fn();

CREATE OR REPLACE FUNCTION trg_linea_planilla_no_update_cerrada_fn() RETURNS trigger AS $$
DECLARE estado_periodo TEXT;
BEGIN
  SELECT p."estado" INTO estado_periodo
  FROM "PeriodoPlanilla" p JOIN "DetallePlanilla" d ON d."periodoId" = p."id"
  WHERE d."id" = OLD."detalleId";
  IF estado_periodo IN ('CERRADA', 'PAGADA') THEN
    RAISE EXCEPTION 'LINEA_PLANILLA_INMUTABLE';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_linea_planilla_no_update_cerrada BEFORE UPDATE ON "LineaConcepto"
FOR EACH ROW EXECUTE FUNCTION trg_linea_planilla_no_update_cerrada_fn();

CREATE OR REPLACE FUNCTION trg_linea_planilla_no_delete_cerrada_fn() RETURNS trigger AS $$
DECLARE estado_periodo TEXT;
BEGIN
  SELECT p."estado" INTO estado_periodo
  FROM "PeriodoPlanilla" p JOIN "DetallePlanilla" d ON d."periodoId" = p."id"
  WHERE d."id" = OLD."detalleId";
  IF estado_periodo IN ('CERRADA', 'PAGADA') THEN
    RAISE EXCEPTION 'LINEA_PLANILLA_INMUTABLE';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_linea_planilla_no_delete_cerrada BEFORE DELETE ON "LineaConcepto"
FOR EACH ROW EXECUTE FUNCTION trg_linea_planilla_no_delete_cerrada_fn();

-- ─────────────── BUSQUEDA DE EMPLEADOS (ex FTS5) ───────────────
-- En Postgres la tabla de texto se mantiene con triggers y se consulta con
-- ILIKE desde el caso de uso de reportes. Nunca almacena datos sensibles.
CREATE TABLE IF NOT EXISTS "empleado_fts" (
  "empleadoId" INTEGER NOT NULL PRIMARY KEY,
  "texto" TEXT NOT NULL
);

CREATE OR REPLACE FUNCTION trg_empleado_fts_insert_fn() RETURNS trigger AS $$
BEGIN
  INSERT INTO "empleado_fts" ("empleadoId", "texto")
  VALUES (NEW."id", trim(NEW."nombres" || ' ' || NEW."apellidos"))
  ON CONFLICT ("empleadoId") DO UPDATE SET "texto" = EXCLUDED."texto";
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_empleado_fts_update_fn() RETURNS trigger AS $$
BEGIN
  INSERT INTO "empleado_fts" ("empleadoId", "texto")
  VALUES (NEW."id", trim(NEW."nombres" || ' ' || NEW."apellidos"))
  ON CONFLICT ("empleadoId") DO UPDATE SET "texto" = EXCLUDED."texto";
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_empleado_fts_delete_fn() RETURNS trigger AS $$
BEGIN
  DELETE FROM "empleado_fts" WHERE "empleadoId" = OLD."id";
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_empleado_fts_insert AFTER INSERT ON "Empleado"
FOR EACH ROW EXECUTE FUNCTION trg_empleado_fts_insert_fn();

CREATE TRIGGER trg_empleado_fts_update AFTER UPDATE OF "nombres", "apellidos" ON "Empleado"
FOR EACH ROW EXECUTE FUNCTION trg_empleado_fts_update_fn();

CREATE TRIGGER trg_empleado_fts_delete AFTER DELETE ON "Empleado"
FOR EACH ROW EXECUTE FUNCTION trg_empleado_fts_delete_fn();

INSERT INTO "empleado_fts" ("empleadoId", "texto")
SELECT "id", trim("nombres" || ' ' || "apellidos") FROM "Empleado"
ON CONFLICT ("empleadoId") DO NOTHING;

-- ─────────────── ANEXO DE AUTORIDAD PARA OTORGAR ROLES ───────────────
-- Jerarquia de autoridad (el seed tambien la estampa; aqui queda blindada).
CREATE OR REPLACE FUNCTION trg_ur_inv1_no_autoasignacion_fn() RETURNS trigger AS $$
BEGIN
  IF NEW."asignadoPorId" IS NOT NULL AND NEW."asignadoPorId" = NEW."usuarioId" THEN
    RAISE EXCEPTION 'INV1_AUTOASIGNACION';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ur_inv1_no_autoasignacion BEFORE INSERT ON "UsuarioRol"
FOR EACH ROW EXECUTE FUNCTION trg_ur_inv1_no_autoasignacion_fn();

-- Invariante 5: alcance obligatorio. GERENTE_DEPTO exige scope; los demas lo prohíben.
CREATE OR REPLACE FUNCTION trg_ur_inv5_scope_insert_fn() RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Rol" r WHERE r."id" = NEW."rolId"
      AND ( (r."codigo" = 'GERENTE_DEPTO' AND NEW."scopeDepartamentoId" IS NULL)
         OR (r."codigo" <> 'GERENTE_DEPTO' AND NEW."scopeDepartamentoId" IS NOT NULL) )
  ) THEN
    RAISE EXCEPTION 'INV5_ALCANCE_INVALIDO';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ur_inv5_scope_insert BEFORE INSERT ON "UsuarioRol"
FOR EACH ROW EXECUTE FUNCTION trg_ur_inv5_scope_insert_fn();

CREATE OR REPLACE FUNCTION trg_ur_inv5_scope_update_fn() RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Rol" r WHERE r."id" = NEW."rolId"
      AND ( (r."codigo" = 'GERENTE_DEPTO' AND NEW."scopeDepartamentoId" IS NULL)
         OR (r."codigo" <> 'GERENTE_DEPTO' AND NEW."scopeDepartamentoId" IS NOT NULL) )
  ) THEN
    RAISE EXCEPTION 'INV5_ALCANCE_INVALIDO';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ur_inv5_scope_update BEFORE UPDATE OF "scopeDepartamentoId" ON "UsuarioRol"
FOR EACH ROW EXECUTE FUNCTION trg_ur_inv5_scope_update_fn();

-- Invariantes 2/3/4: otorgamiento controlado para roles de nivel >= 30.
-- Exige AutorizacionRol AUTORIZADA, vigente y no consumida; el autorizador
-- no puede ser ni el ejecutor ni el beneficiario (doble control).
-- Exencion de acto de sistema: asignadoPorId NULL (seed / alta por puesto).
CREATE OR REPLACE FUNCTION trg_ur_inv3_autorizacion_previa_fn() RETURNS trigger AS $$
BEGIN
  IF NEW."asignadoPorId" IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM "Rol" r WHERE r."id" = NEW."rolId" AND r."nivelAutoridad" >= 30
     )
     AND NOT EXISTS (
       SELECT 1 FROM "AutorizacionRol" a
       WHERE a."beneficiarioId" = NEW."usuarioId"
         AND a."rolId" = NEW."rolId"
         AND a."estado" = 'AUTORIZADA'
         AND a."consumidaEn" IS NULL
         AND (a."venceEn" IS NULL OR a."venceEn" > now())
         AND a."autorizadaPorId" IS NOT NULL
         AND a."autorizadaPorId" <> NEW."asignadoPorId"
         AND a."autorizadaPorId" <> NEW."usuarioId"
     ) THEN
    RAISE EXCEPTION 'INV3_SIN_AUTORIZACION_VIGENTE';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ur_inv3_autorizacion_previa BEFORE INSERT ON "UsuarioRol"
FOR EACH ROW EXECUTE FUNCTION trg_ur_inv3_autorizacion_previa_fn();

-- Marca la autorizacion como consumida al otorgarse el rol.
CREATE OR REPLACE FUNCTION trg_ur_consumir_autorizacion_fn() RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Rol" r WHERE r."id" = NEW."rolId" AND r."nivelAutoridad" >= 30
  ) THEN
    UPDATE "AutorizacionRol"
    SET "consumidaEn" = now()
    WHERE "beneficiarioId" = NEW."usuarioId"
      AND "rolId" = NEW."rolId"
      AND "estado" = 'AUTORIZADA'
      AND "consumidaEn" IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ur_consumir_autorizacion AFTER INSERT ON "UsuarioRol"
FOR EACH ROW EXECUTE FUNCTION trg_ur_consumir_autorizacion_fn();

-- Invariante 6: incompatibilidad por segregacion de funciones.
CREATE OR REPLACE FUNCTION trg_ur_inv6_incompatibilidad_fn() RETURNS trigger AS $$
BEGIN
  IF EXISTS (
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
        WHERE x."activo"
          AND ((x."rolAId" = re."id" AND x."rolBId" = rn."id")
            OR (x."rolAId" = rn."id" AND x."rolBId" = re."id"))
          AND x."vigenciaDesde" <= now()
          AND (x."vigenciaHasta" IS NULL OR x."vigenciaHasta" > now())
      )
  ) THEN
    RAISE EXCEPTION 'INV6_ROLES_INCOMPATIBLES';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ur_inv6_incompatibilidad BEFORE INSERT ON "UsuarioRol"
FOR EACH ROW EXECUTE FUNCTION trg_ur_inv6_incompatibilidad_fn();

-- Invariante 7: continuidad administrativa. No puede retirarse el ultimo
-- ADMIN_TI ni el ultimo DIRECCION activo del sistema.
CREATE OR REPLACE FUNCTION trg_ur_inv7_continuidad_delete_fn() RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Rol" r WHERE r."id" = OLD."rolId"
      AND r."codigo" IN ('ADMIN_TI', 'DIRECCION')
  ) AND NOT EXISTS (
    SELECT 1
    FROM "UsuarioRol" ur2
    JOIN "Usuario" u2 ON u2."id" = ur2."usuarioId"
    WHERE ur2."rolId" = OLD."rolId"
      AND ur2."usuarioId" <> OLD."usuarioId"
      AND u2."estado" = 'ACTIVO'
  ) THEN
    RAISE EXCEPTION 'INV7_ULTIMO_ADMINISTRADOR';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ur_inv7_continuidad_delete BEFORE DELETE ON "UsuarioRol"
FOR EACH ROW EXECUTE FUNCTION trg_ur_inv7_continuidad_delete_fn();
