//admin dashboard
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from 'react-router-dom';

const Dashboard = ({ user, onLogout }) => {
    const navigate = useNavigate();
    const [totalEmployees, setTotalEmployees] = useState(0);
    const [totalTeams, setTotalTeams] = useState(0);
    const [totalSites, setTotalSites] = useState(0);
    const [loading, setLoading] = useState(true);

    const fetchTotals = useCallback(async () => {
        try {
            setLoading(true);
            // Fetch all required collections
            const empDocs = await getDocs(collection(db, "employee"));
            const siteDocs = await getDocs(collection(db, "Sites"));
            const teamDocs = await getDocs(collection(db, "teams"));

            setTotalEmployees(empDocs.size);
            setTotalSites(siteDocs.size);
            setTotalTeams(teamDocs.size);
        } catch (error) {
            console.error("Error fetching totals:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTotals();
    }, [fetchTotals]);

    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <div style={styles.headerContent}>
                    <div style={styles.titleSection}>
                        <h1 style={styles.title}>
                            <span style={styles.titleIcon}>📍</span>
                            Attendance Portal
                        </h1>
                        <p style={styles.subtitle}>Location-Based Employee Management</p>
                    </div>
                    <button onClick={onLogout} style={styles.logoutButton}>
                        <span style={styles.logoutIcon}>🚪</span>
                        Logout
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div style={styles.mainContent}>
                {/* Welcome Section */}
                <div style={styles.welcomeCard}>
                    <h2 style={styles.welcomeTitle}>
                        <span style={styles.waveIcon}>👋</span>
                        Welcome back, {user.email.split('@')[0]}!
                    </h2>
                    <p style={styles.welcomeText}>
                        Manage your team's attendance and monitor site activities from your dashboard.
                    </p>
                </div>

                {/* Stats Cards */}
                <div style={styles.statsGrid}>
                    <div style={styles.statCard}>
                        <div style={styles.statIcon}>👥</div>
                        <div style={styles.statContent}>
                            <h3 style={styles.statNumber}>{loading ? '...' : totalEmployees}</h3>
                            <p style={styles.statLabel}>Total Employees</p>
                        </div>
                    </div>
                    <div style={styles.statCard}>
                        <div style={styles.statIcon}>👨‍👩‍👧‍👦</div>
                        <div style={styles.statContent}>
                            <h3 style={styles.statNumber}>{loading ? '...' : totalTeams}</h3>
                            <p style={styles.statLabel}>Total Teams</p>
                        </div>
                    </div>
                    <div style={styles.statCard}>
                        <div style={styles.statIcon}>🏗️</div>
                        <div style={styles.statContent}>
                            <h3 style={styles.statNumber}>{loading ? '...' : totalSites}</h3>
                            <p style={styles.statLabel}>Total Sites</p>
                        </div>
                    </div>
                </div>

                {/* Navigation Cards */}
                <div style={styles.navGrid}>
                    <div style={styles.navCard} onClick={() => navigate('/employees')}>
                        <div style={styles.navIcon}>👥</div>
                        <h3 style={styles.navTitle}>Employees</h3>
                        <p style={styles.navDescription}>Manage employee profiles and information</p>
                        <div style={styles.navArrow}>→</div>
                    </div>
                    <div style={styles.navCard} onClick={() => navigate('/sites')}>
                        <div style={styles.navIcon}>🏗️</div>
                        <h3 style={styles.navTitle}>Sites</h3>
                        <p style={styles.navDescription}>Configure and monitor work sites</p>
                        <div style={styles.navArrow}>→</div>
                    </div>
                    <div style={styles.navCard} onClick={() => navigate('/teams')}>
                        <div style={styles.navIcon}>👨‍👩‍👧‍👦</div>
                        <h3 style={styles.navTitle}>Teams</h3>
                        <p style={styles.navDescription}>Organize and manage team structures</p>
                        <div style={styles.navArrow}>→</div>
                    </div>
                    <div style={styles.navCard} onClick={() => navigate('/attendance')}>
                        <div style={styles.navIcon}>📅</div>
                        <h3 style={styles.navTitle}>Attendance</h3>
                        <p style={styles.navDescription}>Track and review attendance records</p>
                        <div style={styles.navArrow}>→</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const styles = {
    container: {
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
    header: {
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
    },
    headerContent: {
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '1rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    titleSection: {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
    },
    title: {
        fontSize: '28px',
        fontWeight: '700',
        color: '#1e293b',
        margin: 0,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
    },
    titleIcon: {
        fontSize: '32px',
    },
    subtitle: {
        fontSize: '14px',
        color: '#64748b',
        margin: 0,
        fontWeight: '500',
    },
    logoutButton: {
        padding: '10px 20px',
        backgroundColor: '#ef4444',
        color: '#ffffff',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '600',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        transition: 'all 0.2s ease',
        boxShadow: '0 2px 4px rgba(239, 68, 68, 0.2)',
    },
    logoutIcon: {
        fontSize: '16px',
    },
    mainContent: {
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '2rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem',
    },
    welcomeCard: {
        backgroundColor: '#ffffff',
        padding: '2rem',
        borderRadius: '12px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
        border: '1px solid #e2e8f0',
    },
    welcomeTitle: {
        fontSize: '24px',
        fontWeight: '700',
        color: '#1e293b',
        margin: '0 0 8px 0',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
    },
    waveIcon: {
        fontSize: '28px',
    },
    welcomeText: {
        fontSize: '16px',
        color: '#64748b',
        margin: 0,
        lineHeight: '1.5',
    },
    statsGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '1.5rem',
    },
    statCard: {
        backgroundColor: '#ffffff',
        padding: '1.5rem',
        borderRadius: '12px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
        border: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
    },
    statIcon: {
        fontSize: '36px',
        padding: '12px',
        backgroundColor: '#f1f5f9',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    statContent: {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
    },
    statNumber: {
        fontSize: '24px',
        fontWeight: '700',
        color: '#1e293b',
        margin: 0,
    },
    statLabel: {
        fontSize: '14px',
        color: '#64748b',
        margin: 0,
        fontWeight: '500',
    },
    navGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '1.5rem',
    },
    navCard: {
        backgroundColor: '#ffffff',
        padding: '1.5rem',
        borderRadius: '12px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
        border: '1px solid #e2e8f0',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
    },
    navIcon: {
        fontSize: '32px',
        marginBottom: '8px',
    },
    navTitle: {
        fontSize: '18px',
        fontWeight: '600',
        color: '#1e293b',
        margin: 0,
    },
    navDescription: {
        fontSize: '14px',
        color: '#64748b',
        margin: 0,
        lineHeight: '1.4',
    },
    navArrow: {
        position: 'absolute',
        top: '1.5rem',
        right: '1.5rem',
        fontSize: '18px',
        color: '#94a3b8',
        fontWeight: '600',
    },
    activeSection: {
        backgroundColor: '#ffffff',
        padding: '2rem',
        borderRadius: '12px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
        border: '1px solid #e2e8f0',
    },
    sectionHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
    },
    sectionTitle: {
        fontSize: '20px',
        fontWeight: '600',
        color: '#1e293b',
        margin: 0,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
    },
    sectionIcon: {
        fontSize: '24px',
    },
    refreshButton: {
        padding: '8px 16px',
        backgroundColor: '#3b82f6',
        color: '#ffffff',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '600',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        transition: 'all 0.2s ease',
    },
    refreshIcon: {
        fontSize: '16px',
    },
    loadingCard: {
        textAlign: 'center',
        padding: '3rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem',
    },
    loadingSpinner: {
        width: '40px',
        height: '40px',
        border: '4px solid #e2e8f0',
        borderTop: '4px solid #3b82f6',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
    },
    loadingText: {
        fontSize: '16px',
        color: '#64748b',
        margin: 0,
    },
    emptyStateCard: {
        textAlign: 'center',
        padding: '3rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem',
    },
    emptyStateIcon: {
        fontSize: '64px',
        opacity: 0.6,
    },
    emptyStateTitle: {
        fontSize: '18px',
        fontWeight: '600',
        color: '#1e293b',
        margin: 0,
    },
    emptyStateText: {
        fontSize: '14px',
        color: '#64748b',
        margin: 0,
        lineHeight: '1.5',
    },
    siteGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '1.5rem',
    },
    siteCard: {
        backgroundColor: '#f8fafc',
        padding: '1.5rem',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
    },
    siteHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem',
    },
    siteName: {
        fontSize: '16px',
        fontWeight: '600',
        color: '#1e293b',
        margin: 0,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    siteIcon: {
        fontSize: '20px',
    },
    employeeCount: {
        fontSize: '12px',
        color: '#64748b',
        fontWeight: '500',
        backgroundColor: '#ffffff',
        padding: '4px 8px',
        borderRadius: '6px',
        border: '1px solid #e2e8f0',
    },
    employeeList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
    },
    employeeItem: {
        fontSize: '14px',
        color: '#475569',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        backgroundColor: '#ffffff',
        borderRadius: '6px',
        border: '1px solid #e2e8f0',
    },
    employeeIcon: {
        fontSize: '16px',
        opacity: 0.7,
    },
};

// Add CSS animation for loading spinner
const styleSheet = document.createElement('style');
styleSheet.textContent = `
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(styleSheet);

export default Dashboard;