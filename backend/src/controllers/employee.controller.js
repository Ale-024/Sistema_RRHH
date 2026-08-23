const prisma = require('../db/prisma');

// PERFIL
exports.getProfile = async (req, res) => {
  try {
    const empleado = await prisma.empleado.findUnique({
      where: { id: req.user.empleado_id },
      include: { puesto: { include: { departamento: true } } }
    });
    res.json(empleado);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching profile' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { telefono, direccion, contacto_emergencia, telefono_emergencia } = req.body;
    const empleado = await prisma.empleado.update({
      where: { id: req.user.empleado_id },
      data: { telefono, direccion, contacto_emergencia, telefono_emergencia }
    });
    res.json(empleado);
  } catch (error) {
    res.status(500).json({ message: 'Error updating profile' });
  }
};

exports.updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await prisma.usuario.findUnique({ where: { id: req.user.id } });
    
    const isValid = await require('bcryptjs').compare(currentPassword, user.password_hash);
    if (!isValid) {
      return res.status(400).json({ message: 'La contraseña actual es incorrecta' });
    }

    const newHash = await require('bcryptjs').hash(newPassword, 10);
    await prisma.usuario.update({
      where: { id: req.user.id },
      data: { password_hash: newHash }
    });

    res.json({ message: 'Contraseña actualizada exitosamente' });
  } catch (error) {
    res.status(500).json({ message: 'Error al cambiar contraseña' });
  }
};

// ASISTENCIA
exports.registerAttendance = async (req, res) => {
  try {
    const empleadoId = req.user.empleado_id;
    const now = new Date();
    
    // Check if there is already an entry for today
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const existing = await prisma.asistencia.findFirst({
      where: {
        empleado_id: empleadoId,
        fecha_hora_entrada: { gte: startOfDay, lt: endOfDay }
      }
    });

    if (existing) {
      if (!existing.fecha_hora_salida) {
        // Register checkout
        const updated = await prisma.asistencia.update({
          where: { id: existing.id },
          data: { fecha_hora_salida: now }
        });
        return res.json({ message: 'Salida registrada', data: updated });
      } else {
        return res.status(400).json({ message: 'Ya registraste entrada y salida hoy' });
      }
    }

    // Register check-in
    // Logica simple para estado: si es antes de las 9:15 es PRESENTE, si es antes de 10:00 es RETARDO
    const hour = now.getHours();
    const minutes = now.getMinutes();
    let estado = 'FALTA';
    
    if (hour < 9 || (hour === 9 && minutes <= 15)) {
      estado = 'PRESENTE';
    } else if (hour < 10) {
      estado = 'RETARDO';
    }

    const asistencia = await prisma.asistencia.create({
      data: {
        empleado_id: empleadoId,
        fecha_hora_entrada: now,
        estado: estado
      }
    });

    res.json({ message: 'Entrada registrada', data: asistencia });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error registering attendance: ' + error.message });
  }
};

exports.getAttendanceHistory = async (req, res) => {
  try {
    const history = await prisma.asistencia.findMany({
      where: { empleado_id: req.user.empleado_id },
      orderBy: { fecha_hora_entrada: 'desc' }
    });
    res.json(history);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching attendance' });
  }
};

// SOLICITUDES
exports.createRequest = async (req, res) => {
  try {
    const { tipo, fecha_inicio, fecha_fin, motivo } = req.body;
    const request = await prisma.solicitud.create({
      data: {
        empleado_id: req.user.empleado_id,
        tipo,
        fecha_inicio: new Date(fecha_inicio),
        fecha_fin: new Date(fecha_fin),
        motivo,
        estado: 'PENDIENTE'
      }
    });
    res.json({ message: 'Solicitud creada exitosamente', data: request });
  } catch (error) {
    res.status(500).json({ message: 'Error creating request' });
  }
};

exports.getRequests = async (req, res) => {
  try {
    const requests = await prisma.solicitud.findMany({
      where: { empleado_id: req.user.empleado_id },
      orderBy: { fecha_solicitud: 'desc' }
    });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching requests' });
  }
};

// NÓMINA
exports.getPayroll = async (req, res) => {
  try {
    const payroll = await prisma.nomina.findMany({
      where: { empleado_id: req.user.empleado_id },
      orderBy: { periodo_inicio: 'desc' }
    });
    res.json(payroll);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching payroll' });
  }
};

// NOTIFICACIONES
exports.getNotifications = async (req, res) => {
  try {
    const notifications = await prisma.notificacion.findMany({
      where: { empleado_id: req.user.empleado_id },
      orderBy: { fecha_creacion: 'desc' }
    });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching notifications' });
  }
};

exports.markNotificationRead = async (req, res) => {
  try {
    const notif = await prisma.notificacion.update({
      where: { id: Number(req.params.id) },
      data: { leida: true }
    });
    res.json(notif);
  } catch (error) {
    res.status(500).json({ message: 'Error updating notification' });
  }
};
