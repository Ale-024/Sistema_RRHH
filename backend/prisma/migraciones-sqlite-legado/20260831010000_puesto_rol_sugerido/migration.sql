-- ═══════════ ROL POR DEFECTO SEGÚN PUESTO (CU01) ═══════════
-- Al contratar a alguien con un puesto que tiene rolSugerido, el sistema
-- asigna ese rol RBAC automaticamente dentro de la misma transaccion.
ALTER TABLE "Puesto" ADD COLUMN "rolSugerido" TEXT;

-- Respaldo del catalogo vigente (coincide con prisma/seeds/catalogo-organizacion.js)
UPDATE "Puesto" SET "rolSugerido" = 'DIRECCION'      WHERE "titulo" = 'Director General';
UPDATE "Puesto" SET "rolSugerido" = 'GERENTE_DEPTO'  WHERE "titulo" = 'Gerente de Departamento';
UPDATE "Puesto" SET "rolSugerido" = 'RRHH_SUP'       WHERE "titulo" = 'Director de RRHH';
UPDATE "Puesto" SET "rolSugerido" = 'RRHH_SUP'       WHERE "titulo" = 'Supervisor de RRHH';
UPDATE "Puesto" SET "rolSugerido" = 'EMPLEADO'       WHERE "titulo" = 'Analista de RRHH';
UPDATE "Puesto" SET "rolSugerido" = 'GERENTE_DEPTO'  WHERE "titulo" = 'Coordinador de Encuestadores';
UPDATE "Puesto" SET "rolSugerido" = 'ENCUESTADOR'    WHERE "titulo" = 'Encuestador de Campo';
UPDATE "Puesto" SET "rolSugerido" = 'GERENTE_DEPTO'  WHERE "titulo" = 'Gerente de Marketing';
UPDATE "Puesto" SET "rolSugerido" = 'EMPLEADO'       WHERE "titulo" = 'Analista de Marketing';
UPDATE "Puesto" SET "rolSugerido" = 'ADMIN_TI'       WHERE "titulo" = 'Administrador TI';
