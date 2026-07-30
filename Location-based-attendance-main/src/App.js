import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import Login from './pages/Login'; // Updated import
import Dashboard from './pages/admin/Dashboard'; // Updated import
import EmployeeSection from './pages/admin/EmployeeSection';
import SiteSection from './pages/admin/SiteSection';
import AttendanceLogs from './pages/admin/AttendanceLogs';
import TeamsSection from './pages/admin/TeamsSection';
import SupervisorDashboard from './pages/supervisor/SupervisorDashboard';
import EmployeeDashboard from './pages/employee/EmployeeDashboard'; // You'll need to create this

function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [userData, setUserData] = useState(null);

  const handleLogin = (loggedInUser, userRole, userDetails) => {
    setUser(loggedInUser);
    setRole(userRole);
    setUserData(userDetails);
  };

  const handleLogout = () => {
    setUser(null);
    setRole(null);
    setUserData(null);
  };

  return (
    <Router>
      <Routes>
        {/* Not logged in */}
        {!user ? (
          <Route path="*" element={<Login onLogin={handleLogin} />} />
        ) : role === 'admin' ? (
          <>
            <Route path="/" element={<Dashboard user={user} userData={userData} onLogout={handleLogout} />} />
            <Route path="/employees" element={<EmployeeSection />} />
            <Route path="/sites" element={<SiteSection />} />
            <Route path="/teams" element={<TeamsSection />} />

            <Route path="/attendance" element={<AttendanceLogs />} />
            <Route path="*" element={<Dashboard user={user} userData={userData} onLogout={handleLogout} />} />
          </>
        ) : role === 'supervisor' ? (
          <>
            <Route path="/" element={<SupervisorDashboard user={user} userData={userData} onLogout={handleLogout} />} />
            <Route path="*" element={<SupervisorDashboard user={user} userData={userData} onLogout={handleLogout} />} />
          </>
        ) : role === 'employee' ? (
          <>
            <Route path="/" element={<EmployeeDashboard user={user} userData={userData} onLogout={handleLogout} />} />
            <Route path="*" element={<EmployeeDashboard user={user} userData={userData} onLogout={handleLogout} />} />
          </>
        ) : (
          <Route path="*" element={<div>🔒 Unauthorized Access</div>} />
        )}
      </Routes>
    </Router>
  );
}

export default App;