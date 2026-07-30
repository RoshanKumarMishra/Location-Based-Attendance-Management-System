import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, doc, getDoc, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

const Login = ({ onLogin }) => {
  const [credentials, setCredentials] = useState({ identifier: '', password: '' });
  const [userType, setUserType] = useState('employee');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const { identifier, password } = credentials;
    
    if (!identifier || !password) {
      alert('Please enter both fields');
      return;
    }

    setLoading(true);
    
    try {
      if (userType === 'employee') {
        await handleEmployeeLogin(identifier, password);
      } else if (userType === 'admin') {
        await handleAdminLogin(identifier, password);
      } else if (userType === 'supervisor') {
        await handleSupervisorLogin(identifier, password);
      }
    } catch (error) {
      console.error('Login error:', error);
      alert(error.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleEmployeeLogin = async (email, password) => {
    // Login with Firebase Auth first
    const userCred = await signInWithEmailAndPassword(auth, email, password);
    
    // Find employee by email (same logic as supervisor)
    const empQuery = query(
      collection(db, 'employee'),
      where('email', '==', email)
    );
    const empSnap = await getDocs(empQuery);
    
    if (empSnap.empty) {
      throw new Error('Employee not found');
    }
    
    const empData = empSnap.docs[0].data();
    
    // Check if employee is active
    if (!empData.active) {
      throw new Error('Employee account is inactive');
    }
    
    onLogin(userCred.user, 'employee', empData);
  };

  const handleAdminLogin = async (email, password) => {
    // Login with Firebase Auth
    const userCred = await signInWithEmailAndPassword(auth, email, password);
    
    // Check if admin exists (document ID is email)
    const adminRef = doc(db, 'admin', email);
    const adminSnap = await getDoc(adminRef);
    
    if (!adminSnap.exists()) {
      throw new Error('Admin not found');
    }
    
    onLogin(userCred.user, 'admin', adminSnap.data());
  };

  const handleSupervisorLogin = async (email, password) => {
    // Login with Firebase Auth
    const userCred = await signInWithEmailAndPassword(auth, email, password);
    
    // Find supervisor by email
    const supQuery = query(
      collection(db, 'supervisor'),
      where('email', '==', email)
    );
    const supSnap = await getDocs(supQuery);
    
    if (supSnap.empty) {
      throw new Error('Supervisor not found');
    }
    
    onLogin(userCred.user, 'supervisor', supSnap.docs[0].data());
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.header}>📍 Attendance Portal</h1>
      <div style={styles.loginBox}>
        <h2 style={styles.loginTitle}>Login</h2>
        
        {/* User Type Selection */}
        <div style={styles.userTypeContainer}>
          <label style={styles.radioLabel}>
            <input
              type="radio"
              value="employee"
              checked={userType === 'employee'}
              onChange={(e) => setUserType(e.target.value)}
              style={styles.radio}
            />
            Employee
          </label>
          <label style={styles.radioLabel}>
            <input
              type="radio"
              value="admin"
              checked={userType === 'admin'}
              onChange={(e) => setUserType(e.target.value)}
              style={styles.radio}
            />
            Admin
          </label>
          <label style={styles.radioLabel}>
            <input
              type="radio"
              value="supervisor"
              checked={userType === 'supervisor'}
              onChange={(e) => setUserType(e.target.value)}
              style={styles.radio}
            />
            Supervisor
          </label>
        </div>

        <input
          type="text"
          placeholder="Email"
          value={credentials.identifier}
          onChange={(e) => setCredentials({...credentials, identifier: e.target.value})}
          style={styles.input}
          disabled={loading}
        />
        <input
          type="password"
          placeholder="Password"
          value={credentials.password}
          onChange={(e) => setCredentials({...credentials, password: e.target.value})}
          style={styles.input}
          disabled={loading}
        />
        <button 
          onClick={handleLogin} 
          style={{
            ...styles.button,
            backgroundColor: loading ? '#6c757d' : '#007bff',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
          disabled={loading}
        >
          {loading ? '🔄 Logging in...' : '🔐 Login'}
        </button>
      </div>
    </div>
  );
};

const styles = {
  container: {
    backgroundColor: '#f4f7f9',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    color: '#333',
    fontSize: '28px',
    marginBottom: '30px',
  },
  loginBox: {
    backgroundColor: '#fff',
    padding: '30px',
    borderRadius: '12px',
    boxShadow: '0 0 20px rgba(0,0,0,0.1)',
    width: '320px',
    textAlign: 'center',
  },
  loginTitle: {
    marginBottom: '20px',
    color: '#222',
  },
  userTypeContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '20px',
    padding: '10px',
    backgroundColor: '#f8f9fa',
    borderRadius: '6px',
  },
  radioLabel: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '14px',
    cursor: 'pointer',
  },
  radio: {
    marginRight: '5px',
  },
  input: {
    width: '100%',
    padding: '10px',
    margin: '10px 0',
    fontSize: '16px',
    borderRadius: '6px',
    border: '1px solid #ccc',
    boxSizing: 'border-box',
  },
  button: {
    width: '100%',
    padding: '12px',
    fontSize: '16px',
    backgroundColor: '#007bff',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    marginTop: '10px',
  },
};

export default Login;