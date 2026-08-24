DROP TRIGGER IF EXISTS "trg_empleado_fts_insert";
DROP TRIGGER IF EXISTS "trg_empleado_fts_update";
DROP TRIGGER IF EXISTS "trg_empleado_fts_delete";
DROP TABLE IF EXISTS "empleado_fts";

CREATE VIRTUAL TABLE "empleado_fts" USING fts5(
  "empleadoId" UNINDEXED,
  "texto"
);
INSERT INTO "empleado_fts" ("empleadoId", "texto")
SELECT CAST("id" AS TEXT), trim("nombres" || ' ' || "apellidos") FROM "Empleado";

CREATE TRIGGER "trg_empleado_fts_insert" AFTER INSERT ON "Empleado"
BEGIN
  INSERT INTO "empleado_fts" ("empleadoId", "texto")
  VALUES (CAST(NEW."id" AS TEXT), trim(NEW."nombres" || ' ' || NEW."apellidos"));
END;

CREATE TRIGGER "trg_empleado_fts_update" AFTER UPDATE OF "nombres", "apellidos" ON "Empleado"
BEGIN
  DELETE FROM "empleado_fts" WHERE "empleadoId" = CAST(OLD."id" AS TEXT);
  INSERT INTO "empleado_fts" ("empleadoId", "texto")
  VALUES (CAST(NEW."id" AS TEXT), trim(NEW."nombres" || ' ' || NEW."apellidos"));
END;

CREATE TRIGGER "trg_empleado_fts_delete" AFTER DELETE ON "Empleado"
BEGIN
  DELETE FROM "empleado_fts" WHERE "empleadoId" = CAST(OLD."id" AS TEXT);
END;
