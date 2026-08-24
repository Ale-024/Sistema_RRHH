require('dotenv').config();

const { cargarEntorno } = require('./config/entorno');
const BusEventos = require('./shared/event-bus');
const reloj = require('./shared/reloj');
const { crearClientePrisma } = require('./db/prisma');
const { crearApp } = require('./app');

async function main() {
  let entorno;
  try {
    entorno = cargarEntorno();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  const prisma = await crearClientePrisma();
  const ctx = {
    prisma,
    bus: new BusEventos(),
    clock: reloj,
    entorno,
  };

  const app = crearApp(ctx);
  const server = app.listen(entorno.PORT, () => {
    console.log(`SIRH-MKT API escuchando en el puerto ${entorno.PORT}`);
  });

  // Tareas programadas (desactivables con RUN_CRON=false).
  if (process.env.RUN_CRON !== 'false') {
    const cron = require('node-cron');
    const { registrarTareasProgramadas } = require('./jobs/index');
    registrarTareasProgramadas(ctx, cron);
  }

  async function apagar() {
    server.close();
    await prisma.$disconnect();
  }

  process.on('SIGINT', apagar);
  process.on('SIGTERM', apagar);
}

main().catch((error) => {
  console.error('Fallo el arranque:', error);
  process.exit(1);
});
