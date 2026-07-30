import React, { useEffect, useState } from 'react';
import { db } from '../../firebaseConfig';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

const AttendanceLogs = () => {
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [employees, setEmployees] = useState([]);
  const [teams, setTeams] = useState([]);
  const [sites, setSites] = useState([]);
  const [selectedLogs, setSelectedLogs] = useState([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch all required data in parallel
        const [attendanceSnap, employeeSnap, teamSnap, siteSnap] = await Promise.all([
          getDocs(collection(db, 'attendance')),
          getDocs(collection(db, 'employee')),
          getDocs(collection(db, 'teams')),
          getDocs(collection(db, 'Sites'))
        ]);

        // Process employees
        const employeeData = {};
        employeeSnap.forEach(doc => {
          const data = doc.data();
          employeeData[data.empId] = {
            name: data.name,
            teamId: data.teamId
          };
        });

        // Process teams
        const teamData = {};
        teamSnap.forEach(doc => {
          const data = doc.data();
          teamData[data.teamId] = data.name;
        });

        // Process sites
        const siteData = {};
        siteSnap.forEach(doc => {
          const data = doc.data();
          siteData[data.siteId] = data.name;
        });

        // Process attendance logs
        const logsArray = [];
        attendanceSnap.forEach(doc => {
          const data = doc.data();
          
          const empId = data.empId?.trim();
          const employee = employeeData[empId] || {};
          const teamName = teamData[employee.teamId] || 'Unknown Team';
          const siteName = siteData[data.siteId?.trim()] || 'Unknown Site';

          logsArray.push({
            id: doc.id,
            empId: empId,
            empName: employee.name || 'Unknown Employee',
            siteName: siteName,
            teamName: teamName,
            type: data.type?.trim(),
            timestamp: data.timestamp?.toDate() || new Date(),
            timestampString: data.timestamp?.toDate().toLocaleString() || 'Unknown Time'
          });
        });

        // Sort by timestamp (newest first)
        logsArray.sort((a, b) => b.timestamp - a.timestamp);

        setLogs(logsArray);
        setFilteredLogs(logsArray);
        setEmployees(Object.values(employeeData));
        setTeams(Object.values(teamData));
        setSites(Object.values(siteData));
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    let filtered = logs;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(log =>
        log.empName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.empId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.siteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.teamName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.type.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply date range filter
    if (dateFrom || dateTo) {
      filtered = filtered.filter(log => {
        const logDate = new Date(log.timestamp);
        const fromDate = dateFrom ? new Date(dateFrom) : null;
        const toDate = dateTo ? new Date(dateTo + 'T23:59:59') : null;

        if (fromDate && toDate) {
          return logDate >= fromDate && logDate <= toDate;
        } else if (fromDate) {
          return logDate >= fromDate;
        } else if (toDate) {
          return logDate <= toDate;
        }
        return true;
      });
    }

    setFilteredLogs(filtered);
  }, [searchTerm, logs, dateFrom, dateTo]);

  const getTypeColor = (type) => {
    const normalizedType = type.toLowerCase();
    if (normalizedType.includes('check in') || normalizedType.includes('checkin')) {
      return '#28a745'; // Green
    } else if (normalizedType.includes('check out') || normalizedType.includes('checkout')) {
      return '#dc3545'; // Red
    }
    return '#6c757d'; // Gray for unknown types
  };

  const formatType = (type) => {
    const normalizedType = type.toLowerCase();
    if (normalizedType.includes('check in') || normalizedType.includes('checkin')) {
      return 'Check In';
    } else if (normalizedType.includes('check out') || normalizedType.includes('checkout')) {
      return 'Check Out';
    }
    return type;
  };

  const handleSelectLog = (logId) => {
    setSelectedLogs(prev => 
      prev.includes(logId) 
        ? prev.filter(id => id !== logId)
        : [...prev, logId]
    );
  };

  const handleSelectAll = () => {
    if (selectedLogs.length === filteredLogs.length) {
      setSelectedLogs([]);
    } else {
      setSelectedLogs(filteredLogs.map(log => log.id));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedLogs.length === 0) {
      alert('Please select logs to delete');
      return;
    }

    const confirmMessage = `Are you sure you want to delete ${selectedLogs.length} selected log(s)? This action cannot be undone.`;
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setDeleteLoading(true);
    try {
      // Delete selected logs
      await Promise.all(
        selectedLogs.map(logId => deleteDoc(doc(db, 'attendance', logId)))
      );

      // Update local state
      setLogs(prev => prev.filter(log => !selectedLogs.includes(log.id)));
      setSelectedLogs([]);
      alert(`Successfully deleted ${selectedLogs.length} log(s)`);
    } catch (error) {
      console.error('Error deleting logs:', error);
      alert('Failed to delete logs: ' + error.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteOldLogs = async () => {
    const daysToKeep = prompt('Enter number of days to keep logs for (older logs will be deleted):');
    
    if (!daysToKeep || isNaN(daysToKeep) || daysToKeep <= 0) {
      alert('Please enter a valid number of days');
      return;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(daysToKeep));

    const logsToDelete = logs.filter(log => log.timestamp < cutoffDate);

    if (logsToDelete.length === 0) {
      alert(`No logs found older than ${daysToKeep} days`);
      return;
    }

    const confirmMessage = `This will delete ${logsToDelete.length} logs older than ${daysToKeep} days. Are you sure?`;
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setDeleteLoading(true);
    try {
      await Promise.all(
        logsToDelete.map(log => deleteDoc(doc(db, 'attendance', log.id)))
      );

      setLogs(prev => prev.filter(log => log.timestamp >= cutoffDate));
      setSelectedLogs([]);
      alert(`Successfully deleted ${logsToDelete.length} old log(s)`);
    } catch (error) {
      console.error('Error deleting old logs:', error);
      alert('Failed to delete old logs: ' + error.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const clearDateFilter = () => {
    setDateFrom('');
    setDateTo('');
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading attendance logs...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <button onClick={() => navigate(-1)} style={styles.backButton}>
            ← Back
          </button>
          <h2>📋 Attendance Logs</h2>
        </div>
        <div style={styles.stats}>
          <span>Total Records: {logs.length}</span>
          <span>Filtered: {filteredLogs.length}</span>
          {selectedLogs.length > 0 && (
            <span style={styles.selectedCount}>Selected: {selectedLogs.length}</span>
          )}
        </div>
      </div>

      <div style={styles.filtersContainer}>
        <div style={styles.searchContainer}>
          <input
            type="text"
            placeholder="Search by employee name, ID, site, team, or type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
        </div>

        <div style={styles.dateFilters}>
          <div style={styles.dateInputGroup}>
            <label>From Date:</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={styles.dateInput}
            />
          </div>
          <div style={styles.dateInputGroup}>
            <label>To Date:</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={styles.dateInput}
            />
          </div>
          <button onClick={clearDateFilter} style={styles.clearDateButton}>
            Clear Dates
          </button>
        </div>
      </div>

      <div style={styles.actionsContainer}>
        <div style={styles.bulkActions}>
          <button
            onClick={handleSelectAll}
            style={styles.selectAllButton}
            disabled={filteredLogs.length === 0}
          >
            {selectedLogs.length === filteredLogs.length ? 'Deselect All' : 'Select All'}
          </button>
          <button
            onClick={handleDeleteSelected}
            style={styles.deleteButton}
            disabled={selectedLogs.length === 0 || deleteLoading}
          >
            {deleteLoading ? 'Deleting...' : `Delete Selected (${selectedLogs.length})`}
          </button>
        </div>
        
        <div style={styles.smartActions}>
          <button
            onClick={handleDeleteOldLogs}
            style={styles.smartDeleteButton}
            disabled={deleteLoading}
          >
            🧹 Smart Delete Old Logs
          </button>
        </div>
      </div>

      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>
                <input
                  type="checkbox"
                  checked={selectedLogs.length === filteredLogs.length && filteredLogs.length > 0}
                  onChange={handleSelectAll}
                  style={styles.checkbox}
                />
              </th>
              <th style={styles.th}>Employee Name</th>
              <th style={styles.th}>Employee ID</th>
              <th style={styles.th}>Site</th>
              <th style={styles.th}>Team</th>
              <th style={styles.th}>Type</th>
              <th style={styles.th}>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.map(log => (
              <tr key={log.id} style={styles.tr}>
                <td style={styles.td}>
                  <input
                    type="checkbox"
                    checked={selectedLogs.includes(log.id)}
                    onChange={() => handleSelectLog(log.id)}
                    style={styles.checkbox}
                  />
                </td>
                <td style={styles.td}>
                  <strong>{log.empName}</strong>
                </td>
                <td style={styles.td}>{log.empId}</td>
                <td style={styles.td}>{log.siteName}</td>
                <td style={styles.td}>{log.teamName}</td>
                <td style={styles.td}>
                  <span style={{
                    ...styles.typeBadge,
                    backgroundColor: getTypeColor(log.type)
                  }}>
                    {formatType(log.type)}
                  </span>
                </td>
                <td style={styles.td}>{log.timestampString}</td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {filteredLogs.length === 0 && (
          <div style={styles.noData}>
            {searchTerm ? 'No attendance logs found matching your search.' : 'No attendance logs available.'}
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: '20px',
    fontFamily: 'Arial, sans-serif',
    maxWidth: '1400px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
  },
  backButton: {
    padding: '8px 16px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  stats: {
    display: 'flex',
    gap: '20px',
    fontSize: '14px',
    color: '#666',
  },
  selectedCount: {
    color: '#007bff',
    fontWeight: 'bold',
  },
  loading: {
    textAlign: 'center',
    padding: '50px',
    fontSize: '18px',
    color: '#666',
  },
  filtersContainer: {
    backgroundColor: '#f8f9fa',
    padding: '20px',
    borderRadius: '8px',
    marginBottom: '20px',
  },
  searchContainer: {
    marginBottom: '15px',
  },
  searchInput: {
    width: '100%',
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '16px',
    boxSizing: 'border-box',
  },
  dateFilters: {
    display: 'flex',
    gap: '15px',
    alignItems: 'end',
    flexWrap: 'wrap',
  },
  dateInputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
  },
  dateInput: {
    padding: '8px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
  },
  clearDateButton: {
    padding: '8px 16px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  actionsContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    flexWrap: 'wrap',
    gap: '10px',
  },
  bulkActions: {
    display: 'flex',
    gap: '10px',
  },
  selectAllButton: {
    padding: '8px 16px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  deleteButton: {
    padding: '8px 16px',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  smartActions: {
    display: 'flex',
    gap: '10px',
  },
  smartDeleteButton: {
    padding: '8px 16px',
    backgroundColor: '#fd7e14',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  tableContainer: {
    overflowX: 'auto',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: '900px',
  },
  th: {
    backgroundColor: '#f8f9fa',
    padding: '15px 12px',
    textAlign: 'left',
    fontWeight: '600',
    borderBottom: '2px solid #dee2e6',
    fontSize: '14px',
    color: '#495057',
  },
  td: {
    padding: '12px',
    borderBottom: '1px solid #dee2e6',
    fontSize: '14px',
    color: '#212529',
  },
  tr: {
    ':hover': {
      backgroundColor: '#f8f9fa',
    },
  },
  checkbox: {
    width: '16px',
    height: '16px',
    cursor: 'pointer',
  },
  typeBadge: {
    padding: '4px 8px',
    borderRadius: '4px',
    color: 'white',
    fontSize: '12px',
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  noData: {
    textAlign: 'center',
    padding: '40px',
    color: '#666',
    fontStyle: 'italic',
    fontSize: '16px',
  },
};

export default AttendanceLogs;