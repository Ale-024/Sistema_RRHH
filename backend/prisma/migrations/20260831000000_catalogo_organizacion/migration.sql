-- ═══════════════ FASE DE LIMPIEZA · CATÁLOGO ORGANIZACIONAL ═══════════════
-- Fusiona filas duplicadas de Puesto y Departamento conservando el id menor,
-- re-apuntando todas las claves foráneas antes de borrar, y agrega índices
-- únicos para impedir duplicados futuros.
-- Todas las operaciones son idempotentes: en una base limpia no alteran nada.

-- 1) Empleados apuntando a puestos duplicados → puesto canónico (menor id por título)
UPDATE "Empleado"
SET "puesto_id" = (
  SELECT MIN(p2."id") FROM "Puesto" p2
  WHERE p2."titulo" = (SELECT p3."titulo" FROM "Puesto" p3 WHERE p3."id" = "Empleado"."puesto_id")
)
WHERE "puesto_id" NOT IN (SELECT MIN("id") FROM "Puesto" GROUP BY "titulo");

DELETE FROM "Puesto"
WHERE "id" NOT IN (SELECT MIN("id") FROM "Puesto" GROUP BY "titulo");

-- 2) Re-apuntar FKs de departamentos duplicados al canónico (menor id por nombre)
UPDATE "Puesto"
SET "departamento_id" = (
  SELECT MIN(d2."id") FROM "Departamento" d2
  WHERE d2."nombre" = (SELECT d3."nombre" FROM "Departamento" d3 WHERE d3."id" = "Puesto"."departamento_id")
)
WHERE "departamento_id" NOT IN (SELECT MIN("id") FROM "Departamento" GROUP BY "nombre");

UPDATE "UsuarioRol"
SET "scopeDepartamentoId" = (
  SELECT MIN(d2."id") FROM "Departamento" d2
  WHERE d2."nombre" = (SELECT d3."nombre" FROM "Departamento" d3 WHERE d3."id" = "UsuarioRol"."scopeDepartamentoId")
)
WHERE "scopeDepartamentoId" IS NOT NULL
  AND "scopeDepartamentoId" NOT IN (SELECT MIN("id") FROM "Departamento" GROUP BY "nombre");

UPDATE "Proyecto"
SET "departamentoId" = (
  SELECT MIN(d2."id") FROM "Departamento" d2
  WHERE d2."nombre" = (SELECT d3."nombre" FROM "Departamento" d3 WHERE d3."id" = "Proyecto"."departamentoId")
)
WHERE "departamentoId" IS NOT NULL
  AND "departamentoId" NOT IN (SELECT MIN("id") FROM "Departamento" GROUP BY "nombre");

UPDATE "ProyeccionCostoPlanilla"
SET "departamentoId" = (
  SELECT MIN(d2."id") FROM "Departamento" d2
  WHERE d2."nombre" = (SELECT d3."nombre" FROM "Departamento" d3 WHERE d3."id" = "ProyeccionCostoPlanilla"."departamentoId")
)
WHERE "departamentoId" NOT IN (SELECT MIN("id") FROM "Departamento" GROUP BY "nombre");

DELETE FROM "Departamento"
WHERE "id" NOT IN (SELECT MIN("id") FROM "Departamento" GROUP BY "nombre");

-- 3) Restricciones de unicidad para el catálogo
CREATE UNIQUE INDEX "Departamento_nombre_key" ON "Departamento"("nombre");
CREATE UNIQUE INDEX "Puesto_titulo_key" ON "Puesto"("titulo");
