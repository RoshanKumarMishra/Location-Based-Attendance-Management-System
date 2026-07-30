// src/pages/SupervisorDashboard.js
import React, { useEffect, useState } from 'react';
import { db } from '../../firebaseConfig';
import { collection, query, where, getDocs, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { getAuth, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';

const SupervisorDashboard = ({ user, onLogout }) => {
  const [supervisorData, setSupervisorData] = useState(null);
  const [teamData, setTeamData] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [attendanceData, setAttendanceData] = useState([]);
  const [sitesData, setSitesData] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [profileData, setProfileData] = useState({});
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        console.log('🔍 Fetching supervisor data for:', user.email);

        // 1. Get supervisor data
        const supervisorQuery = query(
          collection(db, 'supervisor'),
          where('email', '==', user.email)
        );
        const supervisorSnap = await getDocs(supervisorQuery);

        if (supervisorSnap.empty) {
          console.log('❌ No supervisor data found');
          return;
        }

        const supData = supervisorSnap.docs[0].data();
        supData.docId = supervisorSnap.docs[0].id;
        console.log('✅ Supervisor data found:', supData);
        setSupervisorData(supData);
        setProfileData({
          name: supData.name || '',
          email: supData.email || '',
          supId: supData.supId || ''
        });

        // 2. Get team data
        const teamQuery = query(
          collection(db, 'teams'),
          where('supId', '==', supData.supId)
        );
        const teamSnap = await getDocs(teamQuery);

        if (!teamSnap.empty) {
          const teamInfo = teamSnap.docs[0].data();
          teamInfo.docId = teamSnap.docs[0].id;
          console.log('✅ Team data found:', teamInfo);
          setTeamData(teamInfo);

          // 3. Get team members based on supervisor's team
          const employeeQuery = query(
            collection(db, 'employee'),
            where('supId', '==', supData.supId)
          );
          const employeeSnap = await getDocs(employeeQuery);

          const filteredEmployees = employeeSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));

          console.log('👥 Team members found:', filteredEmployees);
          setTeamMembers(filteredEmployees);

          // 4. Get attendance data for team members
          const employeeIds = filteredEmployees.map(emp => emp.empId);
          if (employeeIds.length > 0) {
            // Set up real-time listener for attendance
            const attendanceQuery = query(
              collection(db, 'attendance'),
              where('empId', 'in', employeeIds)
            );

            const unsubscribe = onSnapshot(attendanceQuery, (snapshot) => {
              const attendanceRecords = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .sort((a, b) => {
                  if (a.timestamp && b.timestamp) {
                    return b.timestamp.toDate() - a.timestamp.toDate();
                  }
                  return 0;
                });

              setAttendanceData(attendanceRecords);

              // Check for new attendance records for notifications
              const now = new Date();
              const recentRecords = attendanceRecords.filter(record => {
                if (record.timestamp) {
                  const recordTime = record.timestamp.toDate();
                  return (now - recordTime) < 60000; // Last minute
                }
                return false;
              });

              recentRecords.forEach(record => {
                const employee = filteredEmployees.find(emp => emp.empId === record.empId);
                if (employee) {
                  addNotification(
                    `${employee.name} has marked ${record.type} at ${record.timestamp.toDate().toLocaleTimeString()}`,
                    'attendance'
                  );
                }
              });
            });

            // Clean up listener on unmount
            return () => unsubscribe();
          }
        }

        // 5. Get all sites data
        const sitesSnap = await getDocs(collection(db, 'Sites'));
        const allSites = sitesSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        console.log('🏢 Sites data found:', allSites);
        setSitesData(allSites);

      } catch (error) {
        console.error('❌ Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user?.email) {
      fetchAllData();
    }
  }, [user.email]);

  const addNotification = (message, type) => {
    const notification = {
      id: Date.now(),
      message,
      type,
      timestamp: new Date(),
      read: false
    };
    setNotifications(prev => [notification, ...prev.slice(0, 9)]); // Keep last 10
  };

  const markNotificationAsRead = (notificationId) => {
    setNotifications(prev =>
      prev.map(notif =>
        notif.id === notificationId ? { ...notif, read: true } : notif
      )
    );
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    try {
      if (supervisorData?.docId) {
        const supervisorRef = doc(db, 'supervisor', supervisorData.docId);
        await updateDoc(supervisorRef, {
          name: profileData.name,
          email: profileData.email
        });

        setSupervisorData(prev => ({
          ...prev,
          name: profileData.name,
          email: profileData.email
        }));

        addNotification('Profile updated successfully!', 'success');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      addNotification('Error updating profile', 'error');
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      addNotification('New passwords do not match!', 'error');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      addNotification('Password must be at least 6 characters long!', 'error');
      return;
    }

    setIsChangingPassword(true);

    try {
      const auth = getAuth();
      const user = auth.currentUser;

      // Re-authenticate user
      const credential = EmailAuthProvider.credential(
        user.email,
        passwordData.currentPassword
      );

      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, passwordData.newPassword);

      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });

      addNotification('Password changed successfully!', 'success');
    } catch (error) {
      console.error('Error changing password:', error);
      addNotification('Error changing password. Please check your current password.', 'error');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
      return timestamp.toDate().toLocaleString();
    } catch (error) {
      return 'Invalid date';
    }
  };

  const getEmployeeAttendance = (empId) => {
    return attendanceData.filter(record => record.empId === empId);
  };

  const getSiteInfo = (siteId) => {
    return sitesData.find(site => site.siteId === siteId);
  };

  const getAssignedSites = () => {
    return teamData?.assignedsite || [];
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loading}>
          <div style={styles.loadingSpinner}></div>
          <h2>Loading Dashboard...</h2>
          <p>Please wait while we fetch your data.</p>
        </div>
      </div>
    );
  }

  if (!supervisorData) {
    return (
      <div style={styles.container}>
        <div style={styles.errorCard}>
          <h1>❌ Error</h1>
          <p>Could not load supervisor data. Please try logging in again.</p>
          <button style={styles.primaryButton} onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.headerTitle}>Supervisor Dashboard</h1>
          <p style={styles.headerSubtitle}>Welcome back, {supervisorData.name}</p>
        </div>
        <div style={styles.headerRight}>
          <div style={styles.notificationBadge}>
            <span style={styles.notificationIcon}>🔔</span>
            {notifications.filter(n => !n.read).length > 0 && (
              <span style={styles.notificationCount}>
                {notifications.filter(n => !n.read).length}
              </span>
            )}
          </div>
          <button style={styles.logoutButton} onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={styles.tabContainer}>
        <button
          style={activeTab === 'dashboard' ? styles.activeTab : styles.tab}
          onClick={() => setActiveTab('dashboard')}
        >
          📊 Dashboard
        </button>
        <button
          style={activeTab === 'team' ? styles.activeTab : styles.tab}
          onClick={() => setActiveTab('team')}
        >
          👥 Team Details
        </button>
        <button
          style={activeTab === 'notifications' ? styles.activeTab : styles.tab}
          onClick={() => setActiveTab('notifications')}
        >
          🔔 Notifications ({notifications.filter(n => !n.read).length})
        </button>
        <button
          style={activeTab === 'profile' ? styles.activeTab : styles.tab}
          onClick={() => setActiveTab('profile')}
        >
          👤 Profile
        </button>
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <>
          {/* Summary Cards */}
          <div style={styles.summaryGrid}>
            <div style={styles.summaryCard}>
              <div style={styles.summaryIcon}>👥</div>
              <div style={styles.summaryContent}>
                <h3>Team Members</h3>
                <p style={styles.summaryNumber}>{teamMembers.length}</p>
              </div>
            </div>
            <div style={styles.summaryCard}>
              <div style={styles.summaryIcon}>✅</div>
              <div style={styles.summaryContent}>
                <h3>Active Members</h3>
                <p style={styles.summaryNumber}>
                  {teamMembers.filter(emp => emp.active).length}
                </p>
              </div>
            </div>
            <div style={styles.summaryCard}>
              <div style={styles.summaryIcon}>📋</div>
              <div style={styles.summaryContent}>
                <h3>Attendance Today</h3>
                <p style={styles.summaryNumber}>
                  {attendanceData.filter(record => {
                    if (record.timestamp) {
                      const today = new Date();
                      const recordDate = record.timestamp.toDate();
                      return recordDate.toDateString() === today.toDateString();
                    }
                    return false;
                  }).length}
                </p>
              </div>
            </div>
            <div style={styles.summaryCard}>
              <div style={styles.summaryIcon}>🏢</div>
              <div style={styles.summaryContent}>
                <h3>Assigned Sites</h3>
                <p style={styles.summaryNumber}>{getAssignedSites().length}</p>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Recent Activity</h2>
            <div style={styles.activityList}>
              {attendanceData.slice(0, 10).map((record, idx) => {
                const employee = teamMembers.find(emp => emp.empId === record.empId);
                const site = getSiteInfo(record.siteId);
                return (
                  <div key={idx} style={styles.activityItem}>
                    <div style={styles.activityIcon}>
                      {record.type === 'in' ? '🟢' : '🔴'}
                    </div>
                    <div style={styles.activityContent}>
                      <p style={styles.activityText}>
                        <strong>{employee?.name || 'Unknown'}</strong> marked {record.type}
                        {site && ` at ${site.name}`}
                      </p>
                      <p style={styles.activityTime}>{formatDate(record.timestamp)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Team Details Tab */}
      {activeTab === 'team' && (
        <>
          {/* Team Info */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Team Information</h2>
            <div style={styles.teamInfoGrid}>
              <div style={styles.teamInfoCard}>
                <h3>Team Name</h3>
                <p>{teamData?.name || 'N/A'}</p>
              </div>
              <div style={styles.teamInfoCard}>
                <h3>Team ID</h3>
                <p>{teamData?.teamId || 'N/A'}</p>
              </div>
              <div style={styles.teamInfoCard}>
                <h3>Total Members</h3>
                <p>{teamMembers.length}</p>
              </div>
              <div style={styles.teamInfoCard}>
                <h3>Assigned Sites</h3>
                <p>{getAssignedSites().length}</p>
              </div>
            </div>
          </div>

          {/* Assigned Sites */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Assigned Sites</h2>
            <div style={styles.sitesGrid}>
              {getAssignedSites().map((siteId, idx) => {
                const site = getSiteInfo(siteId);
                return (
                  <div key={idx} style={styles.siteCard}>
                    <h3>{site?.name || siteId}</h3>
                    <p><strong>Site ID:</strong> {siteId}</p>
                    <p><strong>Address:</strong> {site?.address || 'N/A'}</p>
                    <p><strong>Coordinates:</strong> {site?.lat && site?.lng
                      ? `${site.lat}, ${site.lng}`
                      : 'N/A'}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Team Members */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Team Members</h2>
            <div style={styles.membersGrid}>
              {teamMembers.map((emp, idx) => {
                const empAttendance = getEmployeeAttendance(emp.empId);
                return (
                  <div key={idx} style={styles.memberCard}>
                    <div style={styles.memberHeader}>
                      <h3>{emp.name}</h3>
                    </div>
                    <div style={styles.memberInfo}>
                      <p><strong>ID:</strong> {emp.empId}</p>
                      <p><strong>Email:</strong> {emp.email}</p>
                      <p><strong>Team:</strong> {emp.teamId}</p>
                    </div>
                    <div style={styles.memberAttendance}>
                      <h4>Recent Attendance</h4>
                      {empAttendance.length === 0 ? (
                        <p style={styles.noData}>No records found</p>
                      ) : (
                        <div style={styles.attendanceList}>
                          {empAttendance.slice(0, 3).map((record, recIdx) => (
                            <div key={recIdx} style={styles.attendanceItem}>
                              <span style={styles.attendanceType}>
                                {record.type === 'in' ? '🟢' : '🔴'} {record.type}
                              </span>
                              <span style={styles.attendanceTime}>
                                {formatDate(record.timestamp)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Notifications</h2>
          {notifications.length === 0 ? (
            <div style={styles.noData}>
              <p>No notifications yet</p>
            </div>
          ) : (
            <div style={styles.notificationsList}>
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  style={notification.read ? styles.readNotification : styles.unreadNotification}
                  onClick={() => markNotificationAsRead(notification.id)}
                >
                  <div style={styles.notificationContent}>
                    <p>{notification.message}</p>
                    <small>{notification.timestamp.toLocaleString()}</small>
                  </div>
                  <div style={styles.notificationIndicator}>
                    {!notification.read && <div style={styles.unreadDot}></div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div style={styles.profileContainer}>
          {/* Profile Update */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Profile Information</h2>
            <form onSubmit={handleProfileUpdate} style={styles.form}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Name</label>
                <input
                  type="text"
                  value={profileData.name}
                  onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                  style={styles.input}
                  required
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Email</label>
                <input
                  type="email"
                  value={profileData.email}
                  onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                  style={styles.input}
                  required
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Supervisor ID</label>
                <input
                  type="text"
                  value={profileData.supId}
                  style={styles.disabledInput}
                  disabled
                />
              </div>
              <button type="submit" style={styles.primaryButton}>
                Update Profile
              </button>
            </form>
          </div>

          {/* Password Change */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Change Password</h2>
            <form onSubmit={handlePasswordChange} style={styles.form}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Current Password</label>
                <input
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  style={styles.input}
                  required
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>New Password</label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  style={styles.input}
                  required
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Confirm New Password</label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  style={styles.input}
                  required
                />
              </div>
              <button
                type="submit"
                style={styles.primaryButton}
                disabled={isChangingPassword}
              >
                {isChangingPassword ? 'Changing...' : 'Change Password'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    padding: '15px',
    fontFamily: "'Segoe UI', 'Roboto', 'Arial', sans-serif",
    backgroundColor: '#f5f7fa',
    minHeight: '100vh',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    padding: '20px',
    backgroundColor: '#fff',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
  },
  headerTitle: {
    margin: 0,
    fontSize: '24px',
    fontWeight: '600',
    color: '#2c3e50',
  },
  headerSubtitle: {
    margin: '3px 0 0 0',
    fontSize: '14px',
    color: '#7f8c8d',
  },
  tabContainer: {
    display: 'flex',
    gap: '2px',
    backgroundColor: '#fff',
    borderRadius: '8px',
    padding: '4px',
    marginBottom: '20px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
  },
  tab: {
    flex: 1,
    padding: '10px 15px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    color: '#7f8c8d',
    transition: 'all 0.3s',
  },
  activeTab: {
    flex: 1,
    padding: '10px 15px',
    backgroundColor: '#007bff',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    transition: 'all 0.3s',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '15px',
    marginBottom: '20px',
  },
  summaryCard: {
    backgroundColor: '#fff',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    transition: 'transform 0.3s',
  },
  summaryIcon: {
    fontSize: '32px',
    opacity: 0.8,
  },
  summaryNumber: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#007bff',
    margin: '5px 0 0 0',
  },
  section: {
    backgroundColor: '#fff',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    marginBottom: '20px',
  },
  sectionTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: '15px',
  },
  teamInfoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '15px',
  },
  teamInfoCard: {
    padding: '15px',
    backgroundColor: '#f8f9fa',
    borderRadius: '6px',
    border: '1px solid #e9ecef',
  },
  sitesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '15px',
  },
  siteCard: {
    padding: '15px',
    backgroundColor: '#f8f9fa',
    borderRadius: '6px',
    border: '1px solid #e9ecef',
  },
  membersGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '15px',
  },
  memberCard: {
    padding: '15px',
    backgroundColor: '#f8f9fa',
    borderRadius: '6px',
    border: '1px solid #e9ecef',
  },
  memberHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  memberInfo: {
    marginBottom: '12px',
  },
  memberAttendance: {
    borderTop: '1px solid #e9ecef',
    paddingTop: '12px',
  },
  activityList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  activityItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    backgroundColor: '#f8f9fa',
    borderRadius: '6px',
    border: '1px solid #e9ecef',
  },
  profileContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
    gap: '20px',
  },
  // Keep all other existing styles as they are
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    backgroundColor: '#f5f7fa',
  },
  loading: {
    textAlign: 'center',
    padding: '40px',
    backgroundColor: '#fff',
    borderRadius: '12px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
  },
  loadingSpinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #f3f3f3',
    borderTop: '4px solid #007bff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    margin: '0 auto 20px',
  },
  errorCard: {
    backgroundColor: '#fff',
    padding: '40px',
    borderRadius: '12px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
    textAlign: 'center',
    margin: '50px auto',
    maxWidth: '500px',
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  notificationBadge: {
    position: 'relative',
    cursor: 'pointer',
  },
  notificationIcon: {
    fontSize: '24px',
  },
  notificationCount: {
    position: 'absolute',
    top: '-8px',
    right: '-8px',
    backgroundColor: '#e74c3c',
    color: 'white',
    borderRadius: '50%',
    width: '20px',
    height: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 'bold',
  },
  logoutButton: {
    padding: '10px 20px',
    backgroundColor: '#e74c3c',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'background-color 0.3s',
  },
  summaryContent: {
    flex: 1,
  },
  activityIcon: {
    fontSize: '20px',
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    margin: 0,
    fontSize: '14px',
    color: '#2c3e50',
  },
  activityTime: {
    margin: '5px 0 0 0',
    fontSize: '12px',
    color: '#7f8c8d',
  },
  activeStatus: {
    padding: '4px 8px',
    backgroundColor: '#28a745',
    color: 'white',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '500',
  },
  inactiveStatus: {
    padding: '4px 8px',
    backgroundColor: '#dc3545',
    color: 'white',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '500',
  },
  attendanceList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  attendanceItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    backgroundColor: '#fff',
    borderRadius: '4px',
    fontSize: '12px',
  },
  attendanceType: {
    fontWeight: '500',
  },
  attendanceTime: {
    color: '#7f8c8d',
  },
  notificationsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  unreadNotification: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '15px',
    backgroundColor: '#e3f2fd',
    borderRadius: '8px',
    border: '1px solid #2196f3',
    cursor: 'pointer',
    transition: 'background-color 0.3s',
  },
  readNotification: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '15px',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
    border: '1px solid #e9ecef',
    cursor: 'pointer',
    opacity: 0.7,
  },
  notificationContent: {
    flex: 1,
  },
  notificationIndicator: {
    width: '20px',
    display: 'flex',
    justifyContent: 'center',
  },
  unreadDot: {
    width: '8px',
    height: '8px',
    backgroundColor: '#2196f3',
    borderRadius: '50%',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#2c3e50',
  },
  input: {
    padding: '12px',
    border: '1px solid #e9ecef',
    borderRadius: '8px',
    fontSize: '14px',
    transition: 'border-color 0.3s',
  },
  disabledInput: {
    padding: '12px',
    border: '1px solid #e9ecef',
    borderRadius: '8px',
    fontSize: '14px',
    backgroundColor: '#f8f9fa',
    color: '#7f8c8d',
    cursor: 'not-allowed',
  },
  primaryButton: {
    padding: '12px 24px',
    backgroundColor: '#007bff',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'background-color 0.3s',
  },
  noData: {
    textAlign: 'center',
    padding: '20px',
    color: '#7f8c8d',
    fontStyle: 'italic',
  },
};

// CSS for spinner animation
const spinnerStyles = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

// Inject spinner styles
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = spinnerStyles;
  document.head.appendChild(style);
}


export default SupervisorDashboard;