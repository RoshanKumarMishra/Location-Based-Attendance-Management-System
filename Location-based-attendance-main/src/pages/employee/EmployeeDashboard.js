// src/pages/EmployeeDashboard.js
import React, { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, addDoc, query, where, orderBy, limit } from 'firebase/firestore';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { db } from '../../firebaseConfig';

const EmployeeDashboard = ({ user, userData, onLogout }) => {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [nearestSite, setNearestSite] = useState(null);
  const [canCheckIn, setCanCheckIn] = useState(false);
  const [lastAttendance, setLastAttendance] = useState(null);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [sites, setSites] = useState([]);
  const [assignedSites, setAssignedSites] = useState([]);
  const [teamData, setTeamData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [watchId, setWatchId] = useState(null);
  // Date filter states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filteredHistory, setFilteredHistory] = useState([]);
  const [inOtherSite, setInOtherSite] = useState(null);

  // Change password states
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    startLocationWatch();
    fetchTeamAndSites();
    fetchAttendanceHistory();
    fetchLastAttendance();

    // Cleanup on unmount
    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);

  const startLocationWatch = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by this browser');
      return;
    }

    const id = navigator.geolocation.watchPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        };
        setCurrentLocation(location);
        setLocationError(null);
      },
      (error) => {
        console.error('Location error:', error);
        setLocationError(`Location error: ${error.message}`);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000 // 1 minute
      }
    );

    setWatchId(id);
  };

  const fetchTeamAndSites = useCallback(async () => {
    try {
      // 1. Fetch team data using employee's teamId
      const teamQuery = query(
        collection(db, 'teams'),
        where('teamId', '==', userData.teamId)
      );
      const teamSnap = await getDocs(teamQuery);

      if (teamSnap.empty) {
        console.error('Team not found');
        return;
      }

      const teamDoc = teamSnap.docs[0].data();
      setTeamData(teamDoc);

      // 2. Fetch all sites
      const sitesSnap = await getDocs(collection(db, 'Sites'));
      const allSites = sitesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSites(allSites);

      // 3. Filter sites that match team's assignedsite
      const employeeAssignedSites = allSites.filter(site =>
        teamDoc.assignedsite && teamDoc.assignedsite.includes(site.siteId)
      );
      setAssignedSites(employeeAssignedSites);

    } catch (error) {
      console.error('Error fetching team and sites:', error);
    }
  }, [userData.teamId]);

const fetchLastAttendance = useCallback(async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const attendanceQuery = query(
        collection(db, 'attendance'),
        where('empId', '==', userData.empId),
        orderBy('timestamp', 'desc'),
        limit(1)
      );
      const attendanceSnap = await getDocs(attendanceQuery);

      if (!attendanceSnap.empty) {
        const lastRecord = attendanceSnap.docs[0].data();
        setLastAttendance({
          ...lastRecord,
          timestamp: lastRecord.timestamp?.toDate()
        });
      }
    } catch (error) {
      console.error('Error fetching last attendance:', error);
    }
}, [userData.empId]);

const fetchAttendanceHistory = useCallback(async () => {
    try {
      const attendanceQuery = query(
        collection(db, 'attendance'),
        where('empId', '==', userData.empId),
        orderBy('timestamp', 'desc'),
        limit(30)
      );
      const attendanceSnap = await getDocs(attendanceQuery);

      const history = attendanceSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate()
      }));

      setAttendanceHistory(history);
    } catch (error) {
      console.error('Error fetching attendance history:', error);
    }
}, [userData.empId]);

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c * 1000; // Convert to meters
  };

  useEffect(() => {
    if (currentLocation && assignedSites.length > 0) {
      checkNearestSite();
    }
  }, [currentLocation, assignedSites]);
  useEffect(() => {
    filterAttendanceByDate();
  }, [startDate, endDate, attendanceHistory]);
const checkNearestSite = useCallback(() => {
    if (!currentLocation || assignedSites.length === 0) return;


    let nearestAssigned = null;
    let minAssignedDistance = Infinity;
    let nearestOtherSite = null;
    let minOtherSiteDistance = Infinity;

    // Check distance to assigned sites
    assignedSites.forEach(site => {
      const distance = calculateDistance(
        currentLocation.lat,
        currentLocation.lng,
        site.lat,
        site.lng
      );

      if (distance < minAssignedDistance) {
        minAssignedDistance = distance;
        nearestAssigned = { ...site, distance };
      }
    });

    // Check distance to all other sites (non-assigned)
    sites.forEach(site => {
      const distance = calculateDistance(
        currentLocation.lat,
        currentLocation.lng,
        site.lat,
        site.lng
      );

      // Check if this is not an assigned site
      const isAssigned = assignedSites.some(assignedSite => assignedSite.siteId === site.siteId);

      if (!isAssigned && distance < minOtherSiteDistance) {
        minOtherSiteDistance = distance;
        nearestOtherSite = { ...site, distance };
      }
    });

    // Determine the overall nearest site and status
    if (nearestAssigned && minAssignedDistance <= 100) {
      // User is within assigned site
      setNearestSite(nearestAssigned);
      setCanCheckIn(true);
      setInOtherSite(null);
    } else if (nearestOtherSite && minOtherSiteDistance <= 100) {
      // User is within another site (not assigned)
      setNearestSite(nearestAssigned); // Keep assigned site as nearest for distance reference
      setCanCheckIn(false);
      setInOtherSite(nearestOtherSite);
    } else {
      // User is not in any site
      setNearestSite(nearestAssigned);
      setCanCheckIn(false);
      setInOtherSite(null);
    }
}, [currentLocation, assignedSites, sites]);

  const handleAttendance = async (type) => {
    if (!nearestSite) {
      alert('No nearby assigned site found');
      return;
    }

    if (!canCheckIn) {
      alert(`You are ${Math.round(nearestSite.distance)}m away from ${nearestSite.name}. You must be within 100m to mark attendance.`);
      return;
    }

    setLoading(true);
    try {
      // Create attendance record matching your database structure
      await addDoc(collection(db, 'attendance'), {
        empId: userData.empId,
        siteId: nearestSite.siteId,
        teamId: userData.teamId,
        timestamp: new Date(),
        type: type.toLowerCase() === 'check in' ? 'in' : 'out' // Convert to match your DB
      });

      alert(`${type} recorded successfully at ${nearestSite.name}!`);
      await fetchLastAttendance();
      await fetchAttendanceHistory();
    } catch (error) {
      console.error('Error recording attendance:', error);
      alert('Failed to record attendance. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      alert('Password must be at least 6 characters long');
      return;
    }

    setPasswordLoading(true);
    try {
      // Re-authenticate user
      const credential = EmailAuthProvider.credential(
        user.email,
        passwordData.currentPassword
      );
      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, passwordData.newPassword);

      alert('Password updated successfully!');
      setShowChangePassword(false);
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error) {
      console.error('Error updating password:', error);
      alert('Failed to update password. Please check your current password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const canCheckOut = () => {
    if (!lastAttendance) return false;

    const today = new Date();
    const lastAttendanceDate = new Date(lastAttendance.timestamp);
    const isToday = today.toDateString() === lastAttendanceDate.toDateString();

    return isToday &&
      lastAttendance.type === 'in' &&
      canCheckIn;
  };

  const canCheckInNow = () => {
    if (!canCheckIn) return false;

    if (!lastAttendance) return true;

    const today = new Date();
    const lastAttendanceDate = new Date(lastAttendance.timestamp);
    const isToday = today.toDateString() === lastAttendanceDate.toDateString();

    return !isToday || lastAttendance.type === 'out';
  };

  const getTodaysAttendance = () => {
    const today = new Date();
    return attendanceHistory.filter(record => {
      const recordDate = new Date(record.timestamp);
      return recordDate.toDateString() === today.toDateString();
    });
  };

  const getSiteNameById = (siteId) => {
    const site = sites.find(s => s.siteId === siteId);
    return site ? site.name : siteId;
  };
const filterAttendanceByDate = useCallback(() => {
    if (!startDate && !endDate) {
      setFilteredHistory(attendanceHistory);
      return;
    }

    const filtered = attendanceHistory.filter(record => {
      const recordDate = new Date(record.timestamp);
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;

      // Set end date to end of day if provided
      if (end) {
        end.setHours(23, 59, 59, 999);
      }

      if (start && end) {
        return recordDate >= start && recordDate <= end;
      } else if (start) {
        return recordDate >= start;
      } else if (end) {
        return recordDate <= end;
      }

      return true;
    });

    setFilteredHistory(filtered);
}, [startDate, endDate, attendanceHistory]);

  const clearDateFilters = () => {
    setStartDate('');
    setEndDate('');
  };
  const renderDashboard = () => (
    <div style={styles.content}>
      <div style={styles.dashboardGrid}>
        {/* Location Status Card */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>📍 Location Status</h3>
          </div>
          <div style={styles.cardContent}>
            {locationError ? (
              <div style={styles.errorState}>
                <p style={styles.errorText}>{locationError}</p>
                <button onClick={startLocationWatch} style={styles.retryButton}>
                  🔄 Retry
                </button>
              </div>
            ) : currentLocation ? (
              <div style={styles.locationInfo}>
                <div style={styles.statusIndicator}>
                  <span style={styles.statusDot}></span>
                  <span>Location Active</span>
                </div>
                <p style={styles.accuracy}>Accuracy: ±{Math.round(currentLocation.accuracy)}m</p>

                {inOtherSite ? (
                  <div style={styles.currentSiteInfo}>
                    <div style={styles.currentSiteCard}>
                      <strong>Current Site: {inOtherSite.name}</strong>
                      <span style={styles.notAssignedBadge}>Not Assigned</span>
                    </div>
                    {nearestSite && (
                      <div style={styles.nearestAssignedSite}>
                        <p>Nearest assigned site:</p>
                        <strong>{nearestSite.name}</strong>
                        <span style={styles.distance}>({Math.round(nearestSite.distance)}m away)</span>
                      </div>
                    )}
                  </div>
                ) : nearestSite ? (
                  <div style={styles.nearestSite}>
                    <strong>{nearestSite.name}</strong>
                    <span style={styles.distance}>({Math.round(nearestSite.distance)}m away)</span>
                    {canCheckIn && (
                      <span style={styles.inRangeBadge}>In Range</span>
                    )}
                  </div>
                ) : (
                  <p style={styles.noSiteNearby}>No sites nearby</p>
                )}
              </div>
            ) : (
              <div style={styles.loadingState}>
                <div style={styles.spinner}></div>
                <p>Getting location...</p>
              </div>
            )}
          </div>
        </div>

        {/* Today's Summary */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>📅 Today's Summary</h3>
          </div>
          <div style={styles.cardContent}>
            {getTodaysAttendance().length === 0 ? (
              <p style={styles.noData}>No attendance records for today</p>
            ) : (
              <div style={styles.todaySummary}>
                {getTodaysAttendance().map((record, index) => (
                  <div key={index} style={styles.summaryItem}>
                    <span style={{
                      ...styles.typeBadge,
                      backgroundColor: record.type === 'in' ? '#10b981' : '#f59e0b'
                    }}>
                      {record.type === 'in' ? 'IN' : 'OUT'}
                    </span>
                    <div style={styles.summaryDetails}>
                      <p style={styles.siteName}>{getSiteNameById(record.siteId)}</p>
                      <p style={styles.timeStamp}>{record.timestamp?.toLocaleTimeString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Attendance Actions */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <h3 style={styles.cardTitle}>⏰ Mark Attendance</h3>
        </div>
        <div style={styles.cardContent}>
          <div style={styles.attendanceActions}>
            <button
              onClick={() => handleAttendance('Check In')}
              disabled={loading || !canCheckInNow()}
              style={{
                ...styles.actionButton,
                ...styles.checkInButton,
                opacity: canCheckInNow() ? 1 : 0.5
              }}
            >
              {loading ? (
                <><div style={styles.buttonSpinner}></div> Processing...</>
              ) : (
                <>✅ Check In</>
              )}
            </button>

            <button
              onClick={() => handleAttendance('Check Out')}
              disabled={loading || !canCheckOut()}
              style={{
                ...styles.actionButton,
                ...styles.checkOutButton,
                opacity: canCheckOut() ? 1 : 0.5
              }}
            >
              {loading ? (
                <><div style={styles.buttonSpinner}></div> Processing...</>
              ) : (
                <>🚪 Check Out</>
              )}
            </button>
          </div>

          {assignedSites.length === 0 ? (
            <div style={styles.warningMessage}>
              <span style={styles.warningIcon}>⚠️</span>
              No assigned sites found. Please contact your supervisor.
            </div>
          ) : inOtherSite ? (
            <div style={styles.errorMessage}>
              <span style={styles.errorIcon}>🚫</span>
              You are not in your assigned site. You are currently in {inOtherSite.name}.
            </div>
          ) : !canCheckIn && nearestSite ? (
            <div style={styles.warningMessage}>
              <span style={styles.warningIcon}>⚠️</span>
              You are {Math.round(nearestSite.distance)}m away from {nearestSite.name}. Move closer to mark attendance.
            </div>
          ) : null}
        </div>
      </div>

      {/* Assigned Sites */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <h3 style={styles.cardTitle}>🏗️ Your Assigned Sites</h3>
        </div>
        <div style={styles.cardContent}>
          <div style={styles.sitesList}>
            {assignedSites.map((site, index) => (
              <div key={index} style={styles.siteCard}>
                <div style={styles.siteInfo}>
                  <h4 style={styles.siteName}>{site.name}</h4>
                  <p style={styles.siteId}>ID: {site.siteId}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderProfile = () => (
    <div style={styles.content}>
      <div style={styles.profileContainer}>
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>👤 Profile Information</h3>
          </div>
          <div style={styles.cardContent}>
            <div style={styles.profileGrid}>
              <div style={styles.profileItem}>
                <label style={styles.profileLabel}>Name</label>
                <span style={styles.profileValue}>{userData.name}</span>
              </div>
              <div style={styles.profileItem}>
                <label style={styles.profileLabel}>Employee ID</label>
                <span style={styles.profileValue}>{userData.empId}</span>
              </div>
              <div style={styles.profileItem}>
                <label style={styles.profileLabel}>Email</label>
                <span style={styles.profileValue}>{userData.email}</span>
              </div>
              <div style={styles.profileItem}>
                <label style={styles.profileLabel}>Team ID</label>
                <span style={styles.profileValue}>{userData.teamId}</span>
              </div>
              <div style={styles.profileItem}>
                <label style={styles.profileLabel}>Supervisor ID</label>
                <span style={styles.profileValue}>{userData.supId}</span>
              </div>
              <div style={styles.profileItem}>
                <label style={styles.profileLabel}>Status</label>
                <span style={{
                  ...styles.profileValue,
                  ...styles.statusBadge,
                  backgroundColor: userData.active ? '#10b981' : '#ef4444'
                }}>
                  {userData.active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div style={styles.profileItem}>
                <label style={styles.profileLabel}>Team</label>
                <span style={styles.profileValue}>{teamData?.name || 'Loading...'}</span>
              </div>
            </div>
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>🏗️ Assigned Sites</h3>
          </div>
          <div style={styles.cardContent}>
            <div style={styles.assignedSitesGrid}>
              {assignedSites.map((site, index) => (
                <div key={index} style={styles.assignedSiteCard}>
                  <h4 style={styles.assignedSiteName}>{site.name}</h4>
                  <p style={styles.assignedSiteId}>ID: {site.siteId}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>🔐 Security</h3>
          </div>
          <div style={styles.cardContent}>
            <button
              onClick={() => setShowChangePassword(true)}
              style={styles.changePasswordButton}
            >
              🔑 Change Password
            </button>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      {showChangePassword && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>🔑 Change Password</h3>
              <button
                onClick={() => setShowChangePassword(false)}
                style={styles.closeButton}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleChangePassword} style={styles.passwordForm}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Current Password</label>
                <input
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  style={styles.formInput}
                  required
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>New Password</label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  style={styles.formInput}
                  required
                  minLength="6"
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Confirm New Password</label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  style={styles.formInput}
                  required
                  minLength="6"
                />
              </div>
              <div style={styles.modalActions}>
                <button
                  type="button"
                  onClick={() => setShowChangePassword(false)}
                  style={styles.cancelButton}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={passwordLoading}
                  style={styles.submitButton}
                >
                  {passwordLoading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  const renderAttendanceHistory = () => (
    <div style={styles.content}>
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <h3 style={styles.cardTitle}>📊 Attendance History</h3>
          <p style={styles.cardSubtitle}>Filter and view your attendance records</p>
        </div>
        <div style={styles.cardContent}>
          {/* Date Filter Form */}
          <div style={styles.filterContainer}>
            <div style={styles.filterForm}>
              <div style={styles.filterGroup}>
                <label style={styles.filterLabel}>From Date:</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={styles.filterInput}
                />
              </div>
              <div style={styles.filterGroup}>
                <label style={styles.filterLabel}>To Date:</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={styles.filterInput}
                />
              </div>
              <button
                onClick={clearDateFilters}
                style={styles.clearButton}
              >
                🗑️ Clear
              </button>
            </div>
            <div style={styles.filterSummary}>
              <span style={styles.filterSummaryText}>
                Showing {filteredHistory.length} of {attendanceHistory.length} records
              </span>
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <div style={styles.noDataState}>
              <p style={styles.noDataText}>
                {attendanceHistory.length === 0 ? 'No attendance records found' : 'No records found for the selected date range'}
              </p>
            </div>
          ) : (
            <div style={styles.tableContainer}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableHeaderRow}>
                    <th style={styles.tableHeader}>Type</th>
                    <th style={styles.tableHeader}>Site</th>
                    <th style={styles.tableHeader}>Date</th>
                    <th style={styles.tableHeader}>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((record, index) => (
                    <tr key={record.id} style={styles.tableRow}>
                      <td style={styles.tableCell}>
                        <span style={{
                          ...styles.tableTypeBadge,
                          backgroundColor: record.type === 'in' ? '#10b981' : '#f59e0b',
                          color: 'white'
                        }}>
                          {record.type === 'in' ? 'Check In' : 'Check Out'}
                        </span>
                      </td>
                      <td style={styles.tableCell}>
                        <div>
                          <div style={styles.tableSiteName}>
                            {getSiteNameById(record.siteId)}
                          </div>
                          <div style={styles.tableSiteId}>
                            ID: {record.siteId}
                          </div>
                        </div>
                      </td>
                      <td style={styles.tableCell}>
                        {record.timestamp?.toLocaleDateString()}
                      </td>
                      <td style={styles.tableCell}>
                        {record.timestamp?.toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.headerLeft}>
            <h1 style={styles.headerTitle}>Employee Dashboard</h1>
            <p style={styles.headerSubtitle}>Welcome back, {userData.name}</p>
          </div>
          <button onClick={onLogout} style={styles.logoutButton}>
            🚪 Logout
          </button>
        </div>
      </div>

      {/* Navigation */}
      <div style={styles.navigation}>
        <div style={styles.navContainer}>
          <button
            onClick={() => setCurrentView('dashboard')}
            style={{
              ...styles.navButton,
              ...(currentView === 'dashboard' ? styles.navButtonActive : {})
            }}
          >
            📍 Dashboard
          </button>
          <button
            onClick={() => setCurrentView('profile')}
            style={{
              ...styles.navButton,
              ...(currentView === 'profile' ? styles.navButtonActive : {})
            }}
          >
            👤 Profile
          </button>
          <button
            onClick={() => setCurrentView('history')}
            style={{
              ...styles.navButton,
              ...(currentView === 'history' ? styles.navButtonActive : {})
            }}
          >
            📊 History
          </button>
        </div>
      </div>

      {/* Content */}
      {currentView === 'dashboard' && renderDashboard()}
      {currentView === 'profile' && renderProfile()}
      {currentView === 'history' && renderAttendanceHistory()}
    </div>
  );
};

const styles = {
  container: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    backgroundColor: '#f8fafc',
    minHeight: '100vh',
    color: '#1f2937',
  },
  header: {
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e5e7eb',
    padding: '0',
  },
  headerContent: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '24px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  headerTitle: {
    margin: 0,
    fontSize: '28px',
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    margin: 0,
    fontSize: '16px',
    color: '#6b7280',
  },
  logoutButton: {
    padding: '12px 24px',
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s ease',
  },
  navigation: {
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e5e7eb',
    padding: '0',
  },
  navContainer: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 20px',
    display: 'flex',
    gap: '0',
  },
  navButton: {
    padding: '16px 24px',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    color: '#6b7280',
    borderBottom: '3px solid transparent',
    transition: 'all 0.2s ease',
  },
  navButtonActive: {
    color: '#2563eb',
    borderBottom: '3px solid #2563eb',
    backgroundColor: '#f8fafc',
  },
  content: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '32px 20px',
  },
  dashboardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '24px',
    marginBottom: '32px',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    border: '1px solid #e5e7eb',
    overflow: 'hidden',
  },
  cardHeader: {
    padding: '24px 24px 16px',
    borderBottom: '1px solid #f3f4f6',
  },
  cardTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '600',
    color: '#111827',
  },
  cardSubtitle: {
    margin: '4px 0 0 0',
    fontSize: '14px',
    color: '#6b7280',
  },
  cardContent: {
    padding: '24px',
  },
  statusIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '12px',
  },
  statusDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    backgroundColor: '#10b981',
    animation: 'pulse 2s infinite',
  },
  accuracy: {
    fontSize: '14px',
    color: '#6b7280',
    margin: '8px 0',
  },
  nearestSite: {
    padding: '12px',
    backgroundColor: '#f0f9ff',
    borderRadius: '8px',
    border: '1px solid #e0f2fe',
  },
  distance: {
    fontSize: '14px',
    color: '#6b7280',
    marginLeft: '8px',
  },
  errorState: {
    textAlign: 'center',
    padding: '20px',
  },
  errorText: {
    color: '#ef4444',
    marginBottom: '16px',
  },
  retryButton: {
    padding: '8px 16px',
    backgroundColor: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  loadingState: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '20px',
    justifyContent: 'center',
  },
  spinner: {
    width: '20px',
    height: '20px',
    border: '2px solid #e5e7eb',
    borderTop: '2px solid #2563eb',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  todaySummary: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  summaryItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
  },
  typeBadge: {
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    color: 'white',
    minWidth: '50px',
    textAlign: 'center',
  },
  summaryDetails: {
    flex: 1,
  },
  siteName: {
    margin: 0,
    fontSize: '14px',
    fontWeight: '500',
    color: '#111827',
  },
  timeStamp: {
    margin: '4px 0 0 0',
    fontSize: '12px',
    color: '#6b7280',
  },
  attendanceActions: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
    marginBottom: '20px',
  },
  actionButton: {
    padding: '16px 24px',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '600',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  checkInButton: {
    backgroundColor: '#10b981',
    color: 'white',
  },
  checkOutButton: {
    backgroundColor: '#f59e0b',
    color: 'white',
  },
  buttonSpinner: {
    width: '16px',
    height: '16px',
    border: '2px solid transparent',
    borderTop: '2px solid currentColor',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  warningMessage: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    backgroundColor: '#fef3c7',
    borderRadius: '8px',
    border: '1px solid #fbbf24',
    color: '#92400e',
    fontSize: '14px',
  },
  warningIcon: {
    fontSize: '16px',
  },
  sitesList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '16px',
  },
  siteCard: {
    padding: '16px',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
  },
  siteInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  siteId: {
    fontSize: '12px',
    color: '#6b7280',
    margin: 0,
  },
  noData: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: '14px',
    padding: '20px',
  },
  profileContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  profileGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '24px',
  },
  profileItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  profileLabel: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151',
  },
  profileValue: {
    fontSize: '16px',
    color: '#111827',
    fontWeight: '400',
  },
  statusBadge: {
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    color: 'white',
    display: 'inline-block',
    width: 'fit-content',
  },
  assignedSitesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
  },
  assignedSiteCard: {
    padding: '16px',
    backgroundColor: '#f0f9ff',
    borderRadius: '8px',
    border: '1px solid #bae6fd',
  },
  assignedSiteName: {
    margin: '0 0 8px 0',
    fontSize: '16px',
    fontWeight: '600',
    color: '#0c4a6e',
  },
  assignedSiteId: {
    margin: 0,
    fontSize: '12px',
    color: '#075985',
  },
  changePasswordButton: {
    padding: '12px 24px',
    backgroundColor: '#6366f1',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s ease',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '12px',
    width: '90%',
    maxWidth: '400px',
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '24px 24px 16px',
    borderBottom: '1px solid #e5e7eb',
  },
  modalTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '600',
    color: '#111827',
  },
  closeButton: {
    padding: '8px',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '18px',
    color: '#6b7280',
    borderRadius: '4px',
  },
  passwordForm: {
    padding: '24px',
  },
  formGroup: {
    marginBottom: '20px',
  },
  formLabel: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151',
    marginBottom: '8px',
  },
  formInput: {
    width: '100%',
    padding: '12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '16px',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s ease',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '24px',
  },
  cancelButton: {
    padding: '10px 20px',
    backgroundColor: '#f3f4f6',
    color: '#374151',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
  },
  submitButton: {
    padding: '10px 20px',
    backgroundColor: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
  },
  tableContainer: {
    overflow: 'auto',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    backgroundColor: 'white',
  },
  tableHeaderRow: {
    backgroundColor: '#f9fafb',
  },
  tableHeader: {
    padding: '16px',
    textAlign: 'left',
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151',
    borderBottom: '1px solid #e5e7eb',
  },
  tableRow: {
    borderBottom: '1px solid #f3f4f6',
    transition: 'background-color 0.2s ease',
  },
  tableCell: {
    padding: '16px',
    fontSize: '14px',
    color: '#374151',
    verticalAlign: 'middle',
  },
  tableTypeBadge: {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '600',
    display: 'inline-block',
  },
  tableSiteName: {
    fontWeight: '500',
    color: '#111827',
  },
  tableSiteId: {
    fontSize: '12px',
    color: '#6b7280',
    marginTop: '2px',
  },
  noDataState: {
    textAlign: 'center',
    padding: '40px 20px',
  },
  noDataText: {
    fontSize: '16px',
    color: '#6b7280',
    margin: 0,
  },
  filterContainer: {
    marginBottom: '24px',
    padding: '20px',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
  },
  filterForm: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '16px',
    alignItems: 'end',
    marginBottom: '12px',
  },
  filterGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    minWidth: '150px',
  },
  filterLabel: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151',
  },
  filterInput: {
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    backgroundColor: 'white',
    transition: 'border-color 0.2s ease',
  },
  clearButton: {
    padding: '8px 16px',
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s ease',
    height: 'fit-content',
  },
  filterSummary: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filterSummaryText: {
    fontSize: '14px',
    color: '#6b7280',
    fontWeight: '500',
  },errorMessage: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    backgroundColor: '#fee2e2',
    borderRadius: '8px',
    border: '1px solid #f87171',
    color: '#991b1b',
    fontSize: '14px',
    fontWeight: '500',
  },
  errorIcon: {
    fontSize: '16px',
  },
  currentSiteInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  currentSiteCard: {
    padding: '12px',
    backgroundColor: '#fee2e2',
    borderRadius: '8px',
    border: '1px solid #f87171',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notAssignedBadge: {
    padding: '4px 8px',
    backgroundColor: '#ef4444',
    color: 'white',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '600',
  },
  nearestAssignedSite: {
    padding: '12px',
    backgroundColor: '#f0f9ff',
    borderRadius: '8px',
    border: '1px solid #e0f2fe',
  },
  inRangeBadge: {
    padding: '4px 8px',
    backgroundColor: '#10b981',
    color: 'white',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '600',
    marginLeft: '8px',
  },
  noSiteNearby: {
    fontSize: '14px',
    color: '#6b7280',
    fontStyle: 'italic',
  },
  locationHeader: {
  display: 'flex',
  justifyContent: 'flex-end',
  marginBottom: '16px',
},
refreshButton: {
  padding: '8px 16px',
  backgroundColor: '#2563eb',
  color: 'white',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: '500',
  transition: 'all 0.2s ease',
},
};

// Add CSS animations
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  
  .table-row:hover {
    background-color: #f9fafb;
  }
  
  .action-button:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
  
  .nav-button:hover {
    color: #2563eb;
    background-color: #f8fafc;
  }
  
  .logout-button:hover {
    background-color: #dc2626;
  }
  
  .change-password-button:hover {
    background-color: #4f46e5;
  }
  
  .form-input:focus {
    outline: none;
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }
  
  .close-button:hover {
    background-color: #f3f4f6;
  }
  
  .cancel-button:hover {
    background-color: #e5e7eb;
  }
  
  .submit-button:hover:not(:disabled) {
    background-color: #1d4ed8;
  }
  
  .retry-button:hover {
    background-color: #1d4ed8;
  }
    .clear-button:hover {
  background-color: #dc2626;
}

.filter-input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}
  // Add this to your existing styleSheet.textContent
.refresh-button:hover {
  background-color: #1d4ed8;
  transform: translateY(-1px);
}
`;

if (!document.head.querySelector('style[data-dashboard-styles]')) {
  styleSheet.setAttribute('data-dashboard-styles', 'true');
  document.head.appendChild(styleSheet);
}

export default EmployeeDashboard;