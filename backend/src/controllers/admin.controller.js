const prisma = require('../db/prisma');
const bcrypt = require('bcryptjs');

// EMPLEADOS Y USUARIOS
exports.getEmployees = async (req, res) => {
  try {
    const employees = await prisma.empleado.findMany({
      include: { 
        usuario: { select: { email: true, rol: true, activo: true } },
        puesto: { include: { departamento: true } }
      }
    });
    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching employees' });
  }
};

exports.createEmployee = async (req, res) => {
  try {
    const { email, password, nombres, apellidos, dni, fecha_ingreso, telefono, puesto_id, salario, direccion } = req.body;
    
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.usuario.create({
      data: {
        email,
        password_hash: hashedPassword,
        rol: 'EMPLOYEE',
        empleado: {
          create: {
            nombres,
            apellidos,
            dni,
            fecha_ingreso: new Date(fecha_ingreso),
            telefono,
            direccion,
            puesto_id: Number(puesto_id)
          }
        }
      },
      include: { empleado: true }
    });

    // Enviar notificación al empleado con su contraseña inicial
    await prisma.notificacion.create({
      data: {
        empleado_id: newUser.empleado.id,
        mensaje: `¡Bienvenido/a ${nombres} ${apellidos}! Tu cuenta ha sido creada exitosamente. Tu contraseña temporal es: ${password}. Por favor, cámbiala desde tu perfil lo antes posible.`
      }
    });

    res.json({ message: 'Empleado creado', data: newUser });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error creating employee: ' + error.message });
  }
};

exports.updateEmployee = async (req, res) => {
  try {
    const { nombres, apellidos, telefono, puesto_id, activo } = req.body;
    const empleado = await prisma.empleado.update({
      where: { id: Number(req.params.id) },
      data: { nombres, apellidos, telefono, puesto_id }
    });
    
    if (activo !== undefined) {
      await prisma.usuario.update({
        where: { id: empleado.usuario_id },
        data: { activo }
      });
    }
    
    res.json(empleado);
  } catch (error) {
    res.status(500).json({ message: 'Error updating employee' });
  }
};

exports.deactivateEmployee = async (req, res) => {
  try {
    // Find the user associated with this employee
    const empleado = await prisma.empleado.findUnique({ where: { id: Number(req.params.id) } });
    if (!empleado) return res.status(404).json({ message: 'Empleado no encontrado' });

    const user = await prisma.usuario.update({
      where: { id: empleado.usuario_id },
      data: { activo: false }
    });
    res.json({ message: 'Empleado desactivado (Baja lógica)', data: user });
  } catch (error) {
    res.status(500).json({ message: 'Error deactivating employee' });
  }
};

// DEPARTAMENTOS
exports.getDepartments = async (req, res) => {
  try {
    const depts = await prisma.departamento.findMany();
    res.json(depts);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching departments' });
  }
};

exports.createDepartment = async (req, res) => {
  try {
    const { nombre, descripcion } = req.body;
    const dept = await prisma.departamento.create({ data: { nombre, descripcion } });
    res.json(dept);
  } catch (error) {
    res.status(500).json({ message: 'Error creating department' });
  }
};

// PUESTOS
exports.getPositions = async (req, res) => {
  try {
    const positions = await prisma.puesto.findMany({ include: { departamento: true } });
    res.json(positions);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching positions' });
  }
};

exports.createPosition = async (req, res) => {
  try {
    const { titulo, departamento_id } = req.body;
    const pos = await prisma.puesto.create({ data: { titulo, departamento_id } });
    res.json(pos);
  } catch (error) {
    res.status(500).json({ message: 'Error creating position' });
  }
};

// ASISTENCIA (Global)
exports.getGlobalAttendance = async (req, res) => {
  try {
    const history = await prisma.asistencia.findMany({
      include: { empleado: true },
      orderBy: { fecha_hora_entrada: 'desc' }
    });
    res.json(history);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching global attendance' });
  }
};

// SOLICITUDES
exports.getGlobalRequests = async (req, res) => {
  try {
    const requests = await prisma.solicitud.findMany({
      include: { empleado: true },
      orderBy: { fecha_solicitud: 'desc' }
    });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching global requests' });
  }
};

exports.updateRequestStatus = async (req, res) => {
  try {
    const { estado } = req.body; // APROBADA o RECHAZADA
    const request = await prisma.solicitud.update({
      where: { id: Number(req.params.id) },
      data: { estado }
    });
    
    // Create a notification for the employee
    await prisma.notificacion.create({
      data: {
        empleado_id: request.empleado_id,
        mensaje: `Tu solicitud de ${request.tipo} ha sido ${estado}.`
      }
    });

    res.json(request);
  } catch (error) {
    res.status(500).json({ message: 'Error updating request status' });
  }
};

// NÓMINA (CRUD)
exports.getGlobalPayroll = async (req, res) => {
  try {
    const payroll = await prisma.nomina.findMany({
      include: { empleado: true },
      orderBy: { periodo_inicio: 'desc' }
    });
    res.json(payroll);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching global payroll' });
  }
};

exports.createPayroll = async (req, res) => {
  try {
    const { empleado_id, periodo_inicio, periodo_fin, fecha_pago, salario_bruto, deducciones } = req.body;
    const neto = parseFloat(salario_bruto) - parseFloat(deducciones);
    
    const payroll = await prisma.nomina.create({
      data: {
        empleado_id,
        periodo_inicio: new Date(periodo_inicio),
        periodo_fin: new Date(periodo_fin),
        fecha_pago: new Date(fecha_pago),
        salario_bruto,
        deducciones,
        salario_neto: neto
      }
    });
    res.json(payroll);
  } catch (error) {
    res.status(500).json({ message: 'Error creating payroll' });
  }
};

exports.updatePayroll = async (req, res) => {
  try {
    const { salario_bruto, deducciones } = req.body;
    const neto = parseFloat(salario_bruto) - parseFloat(deducciones);
    
    const payroll = await prisma.nomina.update({
      where: { id: Number(req.params.id) },
      data: {
        salario_bruto,
        deducciones,
        salario_neto: neto
      }
    });
    res.json(payroll);
  } catch (error) {
    res.status(500).json({ message: 'Error updating payroll' });
  }
};

exports.deletePayroll = async (req, res) => {
  try {
    await prisma.nomina.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'Nómina eliminada' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting payroll' });
  }
};
