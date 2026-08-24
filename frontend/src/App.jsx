import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';
import { esRolAdministrativo } from './shared/roles';
import Login from './pages/Login';
import EmployeeDashboard from './pages/EmployeeDashboard';
import EmployeeProfile from './pages/EmployeeProfile';
import EmployeeRequests from './pages/EmployeeRequests';
import EmployeeAttendance from './pages/EmployeeAttendance';
import AdminDashboard from './pages/AdminDashboard';
import AdminEmployees from './pages/AdminEmployees';
import AdminAttendance from './pages/AdminAttendance';
import AdminRequests from './pages/AdminRequests';
import AdminPayroll from './pages/AdminPayroll';
import AdminUsuarios from './pages/AdminUsuarios';
import Layout from './components/Layout';

const rutaSegunRol = (user) => (esRolAdministrativo(user) ? '/admin' : '/employee');

// Protege la ruta y, si se indican, valida los roles permitidos.
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (allowedRoles && !allowedRoles.includes(user?.rol)) {
    return <Navigate to={rutaSegunRol(user)} replace />;
  }

  return children;
};

function App() {
  const { isAuthenticated, user } = useAuthStore();

  return (
    <Router>
      <Routes>
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to={rutaSegunRol(user)} replace /> : <Login />}
        />

        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/" element={<Navigate to={rutaSegunRol(user)} replace />} />

          {/* Zona administrativa: solo roles con funciones de gestion */}
          <Route
            path="admin/*"
            element={
              <ProtectedRoute allowedRoles={['ADMIN_TI', 'RRHH_SUP', 'DIRECCION']}>
                <Routes>
                  <Route path="" element={<AdminDashboard />} />
                  <Route path="employees" element={<AdminEmployees />} />
                  <Route path="attendance" element={<AdminAttendance />} />
                  <Route path="requests" element={<AdminRequests />} />
                  <Route path="payroll" element={<AdminPayroll />} />
                  <Route path="usuarios" element={<AdminUsuarios />} />
                </Routes>
              </ProtectedRoute>
            }
          />

          {/* Autoservicio del empleado: cualquier usuario autenticado */}
          <Route
            path="employee/*"
            element={
              <Routes>
                <Route path="" element={<EmployeeDashboard />} />
                <Route path="profile" element={<EmployeeProfile />} />
                <Route path="attendance" element={<EmployeeAttendance />} />
                <Route path="requests" element={<EmployeeRequests />} />
              </Routes>
            }
          />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
