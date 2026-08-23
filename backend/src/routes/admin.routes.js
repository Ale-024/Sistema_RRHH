const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { verifyToken, isAdmin } = require('../middlewares/auth.middleware');

router.use(verifyToken, isAdmin);

// Empleados y Usuarios
router.get('/employees', adminController.getEmployees);
router.post('/employees', adminController.createEmployee);
router.put('/employees/:id', adminController.updateEmployee);
router.put('/employees/:id/deactivate', adminController.deactivateEmployee);

// Departamentos
router.get('/departments', adminController.getDepartments);
router.post('/departments', adminController.createDepartment);

// Puestos
router.get('/positions', adminController.getPositions);
router.post('/positions', adminController.createPosition);

// Asistencia
router.get('/attendance', adminController.getGlobalAttendance);

// Solicitudes
router.get('/requests', adminController.getGlobalRequests);
router.put('/requests/:id/status', adminController.updateRequestStatus);

// Nómina
router.get('/payroll', adminController.getGlobalPayroll);
router.post('/payroll', adminController.createPayroll);
router.put('/payroll/:id', adminController.updatePayroll);
router.delete('/payroll/:id', adminController.deletePayroll);

module.exports = router;
