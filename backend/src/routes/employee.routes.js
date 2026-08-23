const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employee.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

router.use(verifyToken);

// Perfil
router.get('/profile', employeeController.getProfile);
router.put('/profile', employeeController.updateProfile);
router.put('/profile/password', employeeController.updatePassword);

// Asistencia
router.post('/attendance', employeeController.registerAttendance);
router.get('/attendance', employeeController.getAttendanceHistory);

// Solicitudes
router.post('/requests', employeeController.createRequest);
router.get('/requests', employeeController.getRequests);

// Nómina
router.get('/payroll', employeeController.getPayroll);

// Notificaciones
router.get('/notifications', employeeController.getNotifications);
router.put('/notifications/:id/read', employeeController.markNotificationRead);

module.exports = router;
