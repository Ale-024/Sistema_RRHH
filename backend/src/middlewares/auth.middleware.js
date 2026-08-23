const jwt = require('jsonwebtoken');

exports.verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]; // Bearer <token>
  
  if (!token) {
    return res.status(401).json({ message: 'Acceso denegado. No hay token.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(403).json({ message: 'Token inválido o expirado.' });
  }
};

exports.isAdmin = (req, res, next) => {
  if (req.user && req.user.rol === 'ADMIN') {
    next();
  } else {
    res.status(403).json({ message: 'Se requiere rol de Administrador para esta acción.' });
  }
};
