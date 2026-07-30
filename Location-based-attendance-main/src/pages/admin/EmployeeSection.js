//employee dadsboard
import React, { useEffect, useState, useCallback } from "react";
import { db, auth } from "../../firebaseConfig";
import {
    collection,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    query,
    where,
} from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import * as XLSX from "xlsx";
import emailjs from "emailjs-com";
import { useNavigate } from "react-router-dom";
import Select from "react-select";

const sendPasswordEmail = (employee, password) => {
    return emailjs.send(
        "service_bo2xhjl",
        "template_enf0ua8",
        {
            to_name: employee.name,
            to_email: employee.email,
            empId: employee.empId,
            password: password,
        },
        "1pu5ao58P1xbDV1Hb"
    );
};

const Employees = () => {
    const [employees, setEmployees] = useState([]);
    const [form, setForm] = useState({ name: "", email: "", teamId: "" });
    const [editingId, setEditingId] = useState(null);
    const [teamOptions, setTeamOptions] = useState([]);
    const [sitesData, setSitesData] = useState([]);
    const [search, setSearch] = useState("");
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [employeeLogs, setEmployeeLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showLogs, setShowLogs] = useState(false);
    const navigate = useNavigate();
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    const filteredEmployees = employees.filter(emp =>
        emp.name?.toLowerCase().includes(search.toLowerCase()) ||
        emp.email?.toLowerCase().includes(search.toLowerCase()) ||
        emp.empId?.toLowerCase().includes(search.toLowerCase())
    );

    const fetchEmployees = async () => {
        try {
            const empSnap = await getDocs(collection(db, "employee"));
            const list = empSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            setEmployees(list);
        } catch (error) {
            console.error("Error fetching employees:", error);
            alert("Failed to fetch employees");
        }
    };

    const fetchTeams = useCallback(async () => {
        try {
            const snap = await getDocs(collection(db, "teams"));
            const teams = snap.docs.map((d) => ({
                id: d.id,
                ...d.data()
            }));
            setTeamOptions(
                teams.map((d) => ({
                    label: d.name,
                    value: d.teamId,
                    supId: d.supId,
                    assignedSites: d.assignedsite || d.assignedSites || [] // Handle both field names
                }))
            );
        } catch (error) {
            console.error("Error fetching teams:", error);
        }
    }, []);
    const fetchSites = async () => {
        try {
            const snap = await getDocs(collection(db, "Sites"));
            const sites = snap.docs.map((d) => ({
                id: d.id,
                ...d.data()
            }));
            setSitesData(sites);
        } catch (error) {
            console.error("Error fetching sites:", error);
        }
    };

    const getTeamName = (teamId) => {
        if (!teamId) return "No team assigned";
        const team = teamOptions.find(t => t.value === teamId);
        return team ? team.label : "No team assigned";
    };

    const getSupervisorId = (teamId) => {
        const team = teamOptions.find(t => t.value === teamId);
        return team ? team.supId : null;
    };

    const getTeamSites = (teamId) => {
        if (!teamId) return [];
        const team = teamOptions.find(t => t.value === teamId);
        if (!team || !team.assignedSites || team.assignedSites.length === 0) return [];

        return team.assignedSites.map(siteId => {
            const site = sitesData.find(s => s.siteId === siteId);
            return site ? site.name : siteId;
        }).filter(Boolean); // Remove any undefined values
    };

    const viewLogs = async (emp, fromDate = null, toDate = null) => {
        if (!emp.empId) {
            alert("Employee ID is missing. Cannot fetch logs.");
            return;
        }

        setLoading(true);
        try {
            let q = query(
                collection(db, "attendance"),
                where("empId", "==", emp.empId.trim()) // Added trim() to handle spaces
            );

            const querySnapshot = await getDocs(q);
            let logs = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            logs.sort((a, b) => {
                const timeA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
                const timeB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
                return timeB - timeA;
            });

            if (fromDate || toDate) {
                logs = logs.filter((log) => {
                    const logDate = log.timestamp?.toDate ?
                        log.timestamp.toDate().toISOString().slice(0, 10) :
                        new Date(log.timestamp).toISOString().slice(0, 10);

                    let includeLog = true;

                    if (fromDate && logDate < fromDate) {
                        includeLog = false;
                    }

                    if (toDate && logDate > toDate) {
                        includeLog = false;
                    }

                    return includeLog;
                });
            }

            setSelectedEmployee(emp);
            setEmployeeLogs(logs);
            setShowLogs(true);

        } catch (error) {
            console.error("Error fetching logs:", error);
            alert("Failed to fetch attendance logs: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEmployees();
        fetchTeams();
        fetchSites();
    }, [fetchTeams]);

    const generateEmpId = (index) => `emp${String(index + 1).padStart(3, "0")}`;
    const generatePassword = () => Math.random().toString(36).slice(-8);

    const addEmployee = async () => {
        if (!form.name.trim() || !form.email.trim()) {
            return alert("Name and Email are required.");
        }

        setLoading(true);
        try {
            const newId = generateEmpId(employees.length);
            const password = generatePassword();
            const supId = getSupervisorId(form.teamId);

            // Create user in Firebase Auth
            await createUserWithEmailAndPassword(auth, form.email, password);


            const employeeData = {
                empId: newId,
                name: form.name.trim(),
                email: form.email.trim(),
                teamId: form.teamId,
                active: true,
            };

            if (supId) {
                employeeData.supId = supId;
            }

            await addDoc(collection(db, "employee"), employeeData);

            // Add employee to team members array if team is selected
            if (form.teamId) {
                const teamQuery = query(collection(db, "teams"), where("teamId", "==", form.teamId));
                const teamSnapshot = await getDocs(teamQuery);

                if (!teamSnapshot.empty) {
                    const teamDoc = teamSnapshot.docs[0];
                    const currentMembers = teamDoc.data().members || [];
                    const updatedMembers = [...currentMembers, newId];

                    await updateDoc(teamDoc.ref, { members: updatedMembers });
                }
            }

            await sendPasswordEmail({ ...form, empId: newId }, password);

            alert(`Employee added successfully! Password sent to ${form.email}`);
            setForm({ name: "", email: "", teamId: "" });
            fetchEmployees();
        } catch (error) {
            console.error("Add Error:", error);
            alert("Failed to add employee: " + error.message);
        } finally {
            setLoading(false);
        }
    };
    const updateEmployee = async () => {
        if (!form.name.trim() || !form.email.trim()) {
            return alert("Name and Email are required.");
        }

        setLoading(true);
        try {
            const ref = doc(db, "employee", editingId);
            const supId = getSupervisorId(form.teamId);

            // Get the current employee data to check the old team
            const currentEmployee = employees.find(emp => emp.id === editingId);
            const oldTeamId = currentEmployee?.teamId;

            const updateData = {
                name: form.name.trim(),
                email: form.email.trim(),
                teamId: form.teamId,
            };

            if (supId) {
                updateData.supId = supId;
            }

            // Update employee document
            await updateDoc(ref, updateData);

            // Handle team members array updates
            if (oldTeamId !== form.teamId) {
                // Remove from old team if they had one
                if (oldTeamId) {
                    const oldTeamQuery = query(collection(db, "teams"), where("teamId", "==", oldTeamId));
                    const oldTeamSnapshot = await getDocs(oldTeamQuery);

                    if (!oldTeamSnapshot.empty) {
                        const oldTeamDoc = oldTeamSnapshot.docs[0];
                        const currentMembers = oldTeamDoc.data().members || [];
                        const updatedMembers = currentMembers.filter(memberId => memberId !== currentEmployee.empId);
                        await updateDoc(oldTeamDoc.ref, { members: updatedMembers });
                    }
                }

                // Add to new team if one is selected
                if (form.teamId) {
                    const newTeamQuery = query(collection(db, "teams"), where("teamId", "==", form.teamId));
                    const newTeamSnapshot = await getDocs(newTeamQuery);

                    if (!newTeamSnapshot.empty) {
                        const newTeamDoc = newTeamSnapshot.docs[0];
                        const currentMembers = newTeamDoc.data().members || [];

                        // Only add if not already in the array
                        if (!currentMembers.includes(currentEmployee.empId)) {
                            const updatedMembers = [...currentMembers, currentEmployee.empId];
                            await updateDoc(newTeamDoc.ref, { members: updatedMembers });
                        }
                    }
                }
            }

            alert("Employee updated successfully");
            setForm({ name: "", email: "", teamId: "" });
            setEditingId(null);
            fetchEmployees();
        } catch (error) {
            console.error("Update Error:", error);
            alert("Failed to update employee");
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (emp) => {
        setEditingId(emp.id);
        setForm({
            name: emp.name,
            email: emp.email,
            teamId: emp.teamId || "",
        });
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this employee?")) return;

        setLoading(true);
        try {
            const employee = employees.find(emp => emp.id === id);

            if (!employee) {
                alert("Employee not found");
                return;
            }

            // Remove employee from team members array if they have a team
            if (employee.teamId) {
                const teamQuery = query(collection(db, "teams"), where("teamId", "==", employee.teamId));
                const teamSnapshot = await getDocs(teamQuery);

                if (!teamSnapshot.empty) {
                    const teamDoc = teamSnapshot.docs[0];
                    const currentMembers = teamDoc.data().members || [];
                    const updatedMembers = currentMembers.filter(memberId => memberId !== employee.empId);
                    await updateDoc(teamDoc.ref, { members: updatedMembers });
                }
            }

            // Delete employee from database
            await deleteDoc(doc(db, "employee", id));

            alert("Employee deleted successfully");
            fetchEmployees();
        } catch (error) {
            console.error("Delete Error:", error);
            alert("Failed to delete employee: " + error.message);
        } finally {
            setLoading(false);
        }
    };


    const handleExcelUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const fileType = file.name.split('.').pop().toLowerCase();
        if (!['xlsx', 'xls'].includes(fileType)) {
            alert("Please upload a valid Excel file (.xlsx or .xls)");
            return;
        }

        if (teamOptions.length === 0) {
            alert("Please wait for teams to load before uploading.");
            return;
        }

        setLoading(true);
        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(sheet);

            if (json.length === 0) {
                alert("Excel file is empty or invalid format");
                return;
            }

            let successCount = 0;
            let failCount = 0;
            const errors = [];

            for (let i = 0; i < json.length; i++) {
                const emp = json[i];

                if (!emp.name || !emp.email) {
                    errors.push(`Row ${i + 1}: Missing name or email`);
                    failCount++;
                    continue;
                }

                const existingEmployee = employees.find(e => e.email.toLowerCase() === emp.email.toLowerCase());
                if (existingEmployee) {
                    errors.push(`Row ${i + 1}: Email ${emp.email} already exists`);
                    failCount++;
                    continue;
                }

                const empId = generateEmpId(employees.length + successCount);
                const password = generatePassword();

                try {
                    // Create user in Firebase Auth
                    await createUserWithEmailAndPassword(auth, emp.email, password);

                    // Find team by name instead of teamId
                    let teamId = "";
                    let supId = "";
                    if (emp.team) {
                        const team = teamOptions.find(t => t.label.toLowerCase() === emp.team.toLowerCase());
                        if (team) {
                            teamId = team.value;
                            supId = team.supId;
                        }
                    }

                    const employeeData = {
                        empId,
                        name: emp.name.trim(),
                        email: emp.email.trim(),
                        teamId: teamId || "",
                        active: true,
                    };

                    if (supId) {
                        employeeData.supId = supId;
                    }

                    // Add employee to database
                    await addDoc(collection(db, "employee"), employeeData);

                    // Add employee to team members array if team is selected
                    if (teamId) {
                        const teamQuery = query(collection(db, "teams"), where("teamId", "==", teamId));
                        const teamSnapshot = await getDocs(teamQuery);

                        if (!teamSnapshot.empty) {
                            const teamDoc = teamSnapshot.docs[0];
                            const currentMembers = teamDoc.data().members || [];
                            const updatedMembers = [...currentMembers, empId];
                            await updateDoc(teamDoc.ref, { members: updatedMembers });
                        }
                    }

                    // Send password email
                    try {
                        await sendPasswordEmail({ ...emp, empId }, password);
                    } catch (emailError) {
                        console.warn(`Email failed for ${emp.email}:`, emailError);
                    }

                    successCount++;
                } catch (err) {
                    console.warn(`Failed to add ${emp.email}:`, err);
                    errors.push(`Row ${i + 1}: ${err.message}`);
                    failCount++;
                }
            }

            let message = `Excel upload completed!\nSuccessfully added: ${successCount}\nFailed: ${failCount}`;
            if (errors.length > 0 && errors.length <= 5) {
                message += `\n\nErrors:\n${errors.join('\n')}`;
            } else if (errors.length > 5) {
                message += `\n\nFirst 5 errors:\n${errors.slice(0, 5).join('\n')}\n...and ${errors.length - 5} more`;
            }

            alert(message);
            fetchEmployees();
        } catch (error) {
            console.error("Excel upload error:", error);
            alert("Failed to process Excel file: " + error.message);
        } finally {
            setLoading(false);
            e.target.value = '';
        }
    };

    const resetForm = () => {
        setEditingId(null);
        setForm({ name: "", email: "", teamId: "" });
    };

    const closeLogs = () => {
        setShowLogs(false);
        setSelectedEmployee(null);
        setEmployeeLogs([]);
        setDateFrom("");
        setDateTo("");
    };

    if (loading) {
        return <div>Loading...</div>;
    }
    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <button onClick={() => navigate(-1)} style={styles.backBtn}>
                    ← Back
                </button>
                <h1>Employee Management</h1>
            </div>

            <div style={styles.card}>
                <h2>{editingId ? "Edit Employee" : "Add New Employee"}</h2>
                <div style={styles.formGrid}>
                    <input
                        placeholder="Full Name"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        style={styles.input}
                        disabled={loading}
                    />
                    <input
                        placeholder="Email Address"
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        style={styles.input}
                        disabled={loading}
                    />
                </div>

                <div style={styles.selectContainer}>
                    <label>Team:</label>
                    <Select
                        options={teamOptions}
                        value={teamOptions.find(t => t.value === form.teamId) || null}
                        onChange={(val) => setForm({ ...form, teamId: val ? val.value : "" })}
                        placeholder="Select team..."
                        isDisabled={loading}
                        isClearable
                    />
                </div>

                <div style={styles.buttonGroup}>
                    <button
                        onClick={editingId ? updateEmployee : addEmployee}
                        style={styles.primaryBtn}
                        disabled={loading}
                    >
                        {loading ? "Processing..." : (editingId ? "Save Changes" : "Add Employee")}
                    </button>
                    {editingId && (
                        <button onClick={resetForm} style={styles.secondaryBtn} disabled={loading}>
                            Cancel
                        </button>
                    )}
                </div>
            </div>

            <div style={styles.card}>
                <h2>Bulk Upload</h2>
                <div style={styles.uploadSection}>
                    <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleExcelUpload}
                        style={styles.fileInput}
                        disabled={loading}
                    />
                    <p>Upload Excel file with columns: <strong>name</strong>, <strong>email</strong>, <strong>team</strong> (team name)</p>
                </div>
            </div>

            <div style={styles.card}>
                <div style={styles.cardHeader}>
                    <h2>Employee List ({employees.length})</h2>
                    <input
                        placeholder="Search employees..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={styles.searchInput}
                    />
                </div>

                <div style={styles.tableContainer}>
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Team</th>
                                <th>Team Sites</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredEmployees.map((emp) => (
                                <tr key={emp.id}>
                                    <td>{emp.empId}</td>
                                    <td>{emp.name}</td>
                                    <td>{emp.email}</td>
                                    <td>{emp.teamId ? getTeamName(emp.teamId) : "No team assigned"}</td>
                                    <td>
                                        {emp.teamId ? (
                                            getTeamSites(emp.teamId).length > 0 ? (
                                                getTeamSites(emp.teamId).join(", ")
                                            ) : (
                                                "No sites assigned to team"
                                            )
                                        ) : (
                                            "No team assigned"
                                        )}
                                    </td>
                                    <td>
                                        <div style={styles.actionButtons}>
                                            <button
                                                onClick={() => handleEdit(emp)}
                                                style={styles.editBtn}
                                                disabled={loading}
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => viewLogs(emp)}
                                                style={styles.logsBtn}
                                                disabled={loading}
                                            >
                                                Logs
                                            </button>
                                            <button
                                                onClick={() => handleDelete(emp.id)}
                                                style={styles.deleteBtn}
                                                disabled={loading}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredEmployees.length === 0 && (
                        <div style={styles.noData}>
                            {search ? "No employees found matching your search." : "No employees added yet."}
                        </div>
                    )}
                </div>
            </div>

            {showLogs && selectedEmployee && (
                <div style={styles.modal}>
                    <div style={styles.modalContent}>
                        <div style={styles.modalHeader}>
                            <h2>Attendance Logs - {selectedEmployee.name}</h2>
                            <button onClick={closeLogs} style={styles.closeBtn}>
                                ✕
                            </button>
                        </div>

                        <div style={styles.filterSection}>
                            <div style={styles.filterTitle}>
                                <label>Filter by date range:</label>
                                <button
                                    onClick={() => {
                                        setDateFrom("");
                                        setDateTo("");
                                        if (selectedEmployee) {
                                            viewLogs(selectedEmployee);
                                        }
                                    }}
                                    style={styles.clearFilterBtn}
                                >
                                    Clear Filter
                                </button>
                            </div>
                            <div style={styles.dateRangeContainer}>
                                <div>
                                    <label>From:</label>
                                    <input
                                        type="date"
                                        value={dateFrom}
                                        onChange={(e) => {
                                            const newFromDate = e.target.value;
                                            setDateFrom(newFromDate);
                                            if (selectedEmployee) {
                                                viewLogs(selectedEmployee, newFromDate, dateTo);
                                            }
                                        }}
                                        style={styles.dateInput}
                                    />
                                </div>
                                <div>
                                    <label>To:</label>
                                    <input
                                        type="date"
                                        value={dateTo}
                                        onChange={(e) => {
                                            const newToDate = e.target.value;
                                            setDateTo(newToDate);
                                            if (selectedEmployee) {
                                                viewLogs(selectedEmployee, dateFrom, newToDate);
                                            }
                                        }}
                                        style={styles.dateInput}
                                    />
                                </div>
                            </div>
                        </div>

                        <div style={styles.logsContainer}>
                            {employeeLogs.length > 0 ? (
                                <table style={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>Date & Time</th>
                                            <th>Site</th>
                                            <th>Type</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {employeeLogs.map((log, i) => (
                                            <tr key={i}>
                                                <td>
                                                    {log.timestamp?.toDate ?
                                                        new Date(log.timestamp.toDate()).toLocaleString() :
                                                        new Date(log.timestamp).toLocaleString()
                                                    }
                                                </td>
                                                <td>{log.siteId || log.siteid || 'N/A'}</td>
                                                <td>
                                                    <span style={{
                                                        padding: '4px 8px',
                                                        borderRadius: '4px',
                                                        fontSize: '12px',
                                                        backgroundColor: log.type === 'check in' || log.type === 'checkin' ? '#e8f5e8' : '#ffe8e8',
                                                        color: log.type === 'check in' || log.type === 'checkin' ? '#2e7d32' : '#d32f2f'
                                                    }}>
                                                        {log.type}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div style={styles.noData}>
                                    No logs found for this employee.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const styles = {
    container: {
        padding: '20px',
        maxWidth: '1200px',
        margin: '0 auto',
        fontFamily: 'Arial, sans-serif',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        marginBottom: '20px',
        gap: '10px',
    },
    backBtn: {
        padding: '8px 12px',
        background: '#f0f0f0',
        border: '1px solid #ccc',
        borderRadius: '4px',
        cursor: 'pointer',
    },
    card: {
        backgroundColor: 'white',
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '20px',
    },
    formGrid: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '10px',
        marginBottom: '15px',
    },
    input: {
        padding: '10px',
        border: '1px solid #ddd',
        borderRadius: '4px',
    },
    searchInput: {
        padding: '8px',
        border: '1px solid #ddd',
        borderRadius: '4px',
        minWidth: '200px',
    },
    selectContainer: {
        marginBottom: '15px',
    },
    buttonGroup: {
        display: 'flex',
        gap: '10px',
    },
    primaryBtn: {
        padding: '10px 20px',
        backgroundColor: '#007bff',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
    },
    secondaryBtn: {
        padding: '10px 20px',
        backgroundColor: '#6c757d',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
    },
    uploadSection: {
        textAlign: 'center',
        padding: '20px',
        border: '2px dashed #ddd',
        borderRadius: '8px',
    },
    fileInput: {
        marginBottom: '10px',
    },
    cardHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '15px',
    },
    tableContainer: {
        overflowX: 'auto',
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse',
        border: '1px solid #ddd',
    },
    actionButtons: {
        display: 'flex',
        gap: '5px',
    },
    editBtn: {
        padding: '5px 10px',
        backgroundColor: '#ffc107',
        color: 'black',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '12px',
    },
    logsBtn: {
        padding: '5px 10px',
        backgroundColor: '#17a2b8',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '12px',
    },
    deleteBtn: {
        padding: '5px 10px',
        backgroundColor: '#dc3545',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '12px',
    },
    noData: {
        textAlign: 'center',
        padding: '20px',
        color: '#666',
    },
    modal: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: '8px',
        maxWidth: '800px',
        width: '90%',
        maxHeight: '80vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
    },
    modalHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px',
        borderBottom: '1px solid #ddd',
    },
    closeBtn: {
        background: 'none',
        border: 'none',
        fontSize: '20px',
        cursor: 'pointer',
    },
    filterSection: {
        padding: '15px 20px',
        borderBottom: '1px solid #ddd',
        backgroundColor: '#f8f9fa',
    },
    filterTitle: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '10px',
    },
    clearFilterBtn: {
        padding: '5px 10px',
        backgroundColor: '#6c757d',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '12px',
    },
    dateRangeContainer: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '10px',
    },
    dateInput: {
        padding: '8px',
        border: '1px solid #ddd',
        borderRadius: '4px',
        marginTop: '5px',
    },
    logsContainer: {
        flex: 1,
        overflow: 'auto',
        padding: '20px',
    },
};

export default Employees;