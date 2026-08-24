CREATE TABLE "Proyecto" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "codigo" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "descripcion" TEXT,
  "departamentoId" INTEGER,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Proyecto_departamentoId_fkey" FOREIGN KEY ("departamentoId") REFERENCES "Departamento" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Proyecto_codigo_key" ON "Proyecto"("codigo");
CREATE INDEX "Proyecto_departamentoId_activo_idx" ON "Proyecto"("departamentoId", "activo");

CREATE TABLE "AsignacionProyecto" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "proyectoId" INTEGER NOT NULL,
  "empleadoId" INTEGER NOT NULL,
  "porcentajeDedicacion" REAL NOT NULL DEFAULT 1,
  "desde" DATETIME NOT NULL,
  "hasta" DATETIME,
  "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AsignacionProyecto_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AsignacionProyecto_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AsignacionProyecto_proyectoId_empleadoId_desde_key" ON "AsignacionProyecto"("proyectoId", "empleadoId", "desde");
CREATE INDEX "AsignacionProyecto_empleadoId_desde_hasta_idx" ON "AsignacionProyecto"("empleadoId", "desde", "hasta");

CREATE TABLE "ProyeccionAsistenciaMensual" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "empleadoId" INTEGER NOT NULL,
  "departamentoId" INTEGER NOT NULL,
  "anio" INTEGER NOT NULL,
  "mes" INTEGER NOT NULL,
  "diasPresente" INTEGER NOT NULL,
  "diasAusente" INTEGER NOT NULL,
  "diasTardanza" INTEGER NOT NULL,
  "minutosTardanza" INTEGER NOT NULL,
  "pctAusentismo" REAL NOT NULL,
  "calculadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProyeccionAsistenciaMensual_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProyeccionAsistenciaMensual_empleadoId_anio_mes_key" ON "ProyeccionAsistenciaMensual"("empleadoId", "anio", "mes");
CREATE INDEX "ProyeccionAsistenciaMensual_departamentoId_anio_mes_idx" ON "ProyeccionAsistenciaMensual"("departamentoId", "anio", "mes");

CREATE TABLE "ProyeccionCostoPlanilla" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "departamentoId" INTEGER NOT NULL,
  "anio" INTEGER NOT NULL,
  "mes" INTEGER NOT NULL,
  "empleados" INTEGER NOT NULL,
  "totalBrutoCent" INTEGER NOT NULL,
  "totalDeduccionesCent" INTEGER NOT NULL,
  "totalNetoCent" INTEGER NOT NULL,
  "totalAportesCent" INTEGER NOT NULL,
  "calculadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProyeccionCostoPlanilla_departamentoId_fkey" FOREIGN KEY ("departamentoId") REFERENCES "Departamento" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProyeccionCostoPlanilla_departamentoId_anio_mes_key" ON "ProyeccionCostoPlanilla"("departamentoId", "anio", "mes");
CREATE INDEX "ProyeccionCostoPlanilla_anio_mes_idx" ON "ProyeccionCostoPlanilla"("anio", "mes");

-- FTS5 conserva únicamente el texto de búsqueda; nunca almacena datos sensibles.
CREATE VIRTUAL TABLE IF NOT EXISTS "empleado_fts" USING fts5(
  "empleadoId" UNINDEXED,
  "texto"
);
INSERT INTO "empleado_fts" ("empleadoId", "texto")
SELECT CAST("id" AS TEXT), trim("nombres" || ' ' || "apellidos" || ' ' || "dni") FROM "Empleado";

CREATE TRIGGER "trg_empleado_fts_insert" AFTER INSERT ON "Empleado"
BEGIN
  INSERT INTO "empleado_fts" ("empleadoId", "texto")
  VALUES (CAST(NEW."id" AS TEXT), trim(NEW."nombres" || ' ' || NEW."apellidos" || ' ' || NEW."dni"));
END;

CREATE TRIGGER "trg_empleado_fts_update" AFTER UPDATE OF "nombres", "apellidos", "dni" ON "Empleado"
BEGIN
  DELETE FROM "empleado_fts" WHERE "empleadoId" = CAST(OLD."id" AS TEXT);
  INSERT INTO "empleado_fts" ("empleadoId", "texto")
  VALUES (CAST(NEW."id" AS TEXT), trim(NEW."nombres" || ' ' || NEW."apellidos" || ' ' || NEW."dni"));
END;

CREATE TRIGGER "trg_empleado_fts_delete" AFTER DELETE ON "Empleado"
BEGIN
  DELETE FROM "empleado_fts" WHERE "empleadoId" = CAST(OLD."id" AS TEXT);
END;
