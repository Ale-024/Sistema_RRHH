import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';
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
import Layout from './components/Layout';

// Protect routes component
const ProtectedRoute = ({ children, allowedRole }) => {
  const { isAuthenticated, user } = useAuthStore();
  
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  
  // If role is required and it doesn't match
  if (allowedRole && user?.rol !== allowedRole) {
    return <Navigate to={user?.rol === 'ADMIN' ? '/admin' : '/employee'} replace />;
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
          element={isAuthenticated ? <Navigate to={user?.rol === 'ADMIN' ? '/admin' : '/employee'} replace /> : <Login />} 
        />
        
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/" element={<Navigate to={user?.rol === 'ADMIN' ? '/admin' : '/employee'} replace />} />
          
          {/* Employee Routes */}
          <Route 
            path="employee/*" 
            element={
              <ProtectedRoute allowedRole="EMPLOYEE">
                <Routes>
                  <Route path="" element={<EmployeeDashboard />} />
                  <Route path="profile" element={<EmployeeProfile />} />
                  <Route path="attendance" element={<EmployeeAttendance />} />
                  <Route path="requests" element={<EmployeeRequests />} />
                </Routes>
              </ProtectedRoute>
            } 
          />
          
          {/* Admin Routes */}
          <Route 
            path="admin/*" 
            element={
              <ProtectedRoute allowedRole="ADMIN">
                <Routes>
                  <Route path="" element={<AdminDashboard />} />
                  <Route path="employees" element={<AdminEmployees />} />
                  <Route path="attendance" element={<AdminAttendance />} />
                  <Route path="requests" element={<AdminRequests />} />
                  <Route path="payroll" element={<AdminPayroll />} />
                </Routes>
              </ProtectedRoute>
            } 
          />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
