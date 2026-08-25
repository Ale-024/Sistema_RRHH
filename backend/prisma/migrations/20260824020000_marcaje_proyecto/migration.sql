-- RF-16 / CU02.2: marcaje de campo vinculado al proyecto del encuestador.
ALTER TABLE "Marcaje" ADD COLUMN "proyectoId" INTEGER;

CREATE INDEX "Marcaje_proyectoId_idx" ON "Marcaje"("proyectoId");

ALTER TABLE "Marcaje" ADD CONSTRAINT "Marcaje_proyectoId_fkey"
  FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
