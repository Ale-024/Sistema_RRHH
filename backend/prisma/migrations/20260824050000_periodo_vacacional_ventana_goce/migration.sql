-- Ventana de goce vacacional: el derecho del ano N se disfruta durante los
-- 12 meses siguientes al aniversario (antes la ventana era el propio ano
-- trabajado, siempre en el pasado). Se recorre un ano la ventana de los
-- periodos existentes para conservar el derecho ya devengado.
UPDATE "PeriodoVacacional"
SET "desde" = "desde" + INTERVAL '1 year',
    "hasta" = "hasta" + INTERVAL '1 year';
