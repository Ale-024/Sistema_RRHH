#!/usr/bin/env node
/**
 * CLI: consolidar asistencia de una fecha.
 * Uso: node scripts/consolidar-asistencia.js --fecha=2026-08-24
 */
require('dotenv').config();
const { cargarEntorno } = require('../src/config/entorno');
const { crearClientePrisma } = require('../src/db/prisma');

async function main() {
  cargarEntorno();
  const prisma = await crearClientePrisma();

  const argFecha = process.argv.find((a) => a.startsWith('--fecha='));
  const fecha = argFecha ? new Date(argFecha.split('=')[1]) : (() => {
    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 1);
    return ayer;
  })();

  if (Number.isNaN(fecha.getTime())) {
    console.error('Fecha invalida. Uso: --fecha=YYYY-MM-DD');
    process.exit(1);
  }

  const { consolidarDia } = require('../src/modules/asistencia/application/consolidar-dia.usecase');
  const resultado = await consolidarDia(fecha, { prisma });
  console.log(`Consolidado ${resultado.fecha}: ${resultado.empleados} empleados procesados.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
