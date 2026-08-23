const prisma = require('../db/prisma');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email y contraseña son requeridos.' });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { email },
      include: {
        empleado: true // Traemos también datos del empleado
      }
    });

    if (!usuario) {
      return res.status(401).json({ message: 'Credenciales inválidas.' });
    }

    if (!usuario.activo) {
      return res.status(403).json({ message: 'Cuenta desactivada. Contacte a RRHH.' });
    }

    const validPassword = await bcrypt.compare(password, usuario.password_hash);

    if (!validPassword) {
      return res.status(401).json({ message: 'Credenciales inválidas.' });
    }

    // Generar Token JWT
    const token = jwt.sign(
      { 
        id: usuario.id, 
        rol: usuario.rol, 
        empleado_id: usuario.empleado?.id 
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      message: 'Inicio de sesión exitoso',
      token,
      user: {
        id: usuario.id,
        email: usuario.email,
        rol: usuario.rol,
        nombres: usuario.empleado?.nombres,
        apellidos: usuario.empleado?.apellidos
      }
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};
