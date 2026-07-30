// Make sure to install: npm install react-select emailjs-com xlsx

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

const sendPasswordEmail = (supervisor, password) => {
    return emailjs.send(
        "service_bo2xhjl",
        "template_enf0ua8",
        {
            to_name: supervisor.name,
            to_email: supervisor.email,
            empId: supervisor.supId,
            password: password,
        },
        "1pu5ao58P1xbDV1Hb"
    );
};

const TeamsSection = () => {
    const [teams, setTeams] = useState([]);
    const [supervisors, setSupervisors] = useState([]);
    const [sites, setSites] = useState([]);
    const [employees, setEmployees] = useState([]);
    
    // Form states
    const [teamForm, setTeamForm] = useState({ name: "", assignedSites: [] });
    const [supervisorForm, setSupervisorForm] = useState({ name: "", email: "", teamId: "" });
    
    // Edit states
    const [editingTeamId, setEditingTeamId] = useState(null);
    const [editingSupervisorId, setEditingSupervisorId] = useState(null);
    const [editingTeamMembers, setEditingTeamMembers] = useState([]);
const [editingTeamSupervisor, setEditingTeamSupervisor] = useState("");
    // Search states
    const [teamSearch, setTeamSearch] = useState("");
    const [supervisorSearch, setSupervisorSearch] = useState("");
    
const [loading, setLoading] = useState(true);
const [dataLoading, setDataLoading] = useState(false); // For form operations
  const navigate = useNavigate();

    // Site options for dropdown
    const siteOptions = sites.map(site => ({
        value: site.siteId,
        label: site.name
    }));

    // Team options for supervisor dropdown
    const teamOptions = teams.map(team => ({
        value: team.teamId,
        label: team.name
    }));

    // Filtered data
    const filteredTeams = teams.filter(team =>
        team.name?.toLowerCase().includes(teamSearch.toLowerCase()) ||
        team.teamId?.toLowerCase().includes(teamSearch.toLowerCase())
    );

    const filteredSupervisors = supervisors.filter(sup =>
        sup.name?.toLowerCase().includes(supervisorSearch.toLowerCase()) ||
        sup.email?.toLowerCase().includes(supervisorSearch.toLowerCase()) ||
        sup.supId?.toLowerCase().includes(supervisorSearch.toLowerCase())
    );

    // Fetch functions
    const fetchTeams = useCallback(async () => {
        try {
            const teamDocs = await getDocs(collection(db, "teams"));
            const teamList = teamDocs.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setTeams(teamList);
        } catch (error) {
            console.error("Error fetching teams:", error);
        }
    }, []);

    const fetchSupervisors = useCallback(async () => {
        try {
            const supDocs = await getDocs(collection(db, "supervisor"));
            const supList = supDocs.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setSupervisors(supList);
        } catch (error) {
            console.error("Error fetching supervisors:", error);
        }
    }, []);

    const fetchSites = useCallback(async () => {
        try {
            const siteDocs = await getDocs(collection(db, "Sites"));
            const siteList = siteDocs.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setSites(siteList);
        } catch (error) {
            console.error("Error fetching sites:", error);
        }
    }, []);

    const fetchEmployees = useCallback(async () => {
        try {
            const empDocs = await getDocs(collection(db, "employee"));
            const empList = empDocs.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setEmployees(empList);
        } catch (error) {
            console.error("Error fetching employees:", error);
        }
    }, []);

  useEffect(() => {
    const fetchData = async () => {
        setLoading(true);
        try {
            await Promise.all([
                fetchTeams(),
                fetchSupervisors(),
                fetchSites(),
                fetchEmployees()
            ]);
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };
    fetchData();
}, [fetchTeams, fetchSupervisors, fetchSites, fetchEmployees]);

    // Helper functions
    const generateTeamId = (index) => `team${String(index + 1).padStart(3, "0")}`;
    const generateSupId = (index) => `sup${String(index + 1).padStart(3, "0")}`;
    const generatePassword = () => Math.random().toString(36).slice(-8);

    const getTeamName = (teamId) => {
        const team = teams.find(t => t.teamId === teamId);
        return team ? team.name : "No Team";
    };

    const getSiteNames = (siteIds) => {
        if (!siteIds || siteIds.length === 0) return "No sites assigned";
        return siteIds.map(siteId => {
            const site = sites.find(s => s.siteId === siteId);
            return site ? site.name : siteId;
        }).join(", ");
    };

    const getTeamMemberCount = (teamId) => {
        return employees.filter(emp => emp.teamId === teamId).length;
    };

    const getSupervisorName = (supId) => {
        const supervisor = supervisors.find(s => s.supId === supId);
        return supervisor ? supervisor.name : "No Supervisor";
    };

    // Team operations
    const addTeam = async () => {
        if (!teamForm.name.trim()) {
            return alert("Team name is required.");
        }

        setLoading(true);
        try {
            const newTeamId = generateTeamId(teams.length);
            const teamData = {
                teamId: newTeamId,
                name: teamForm.name.trim(),
                assignedsite: teamForm.assignedSites,
                members: []
            };

            await addDoc(collection(db, "teams"), teamData);
            alert("Team added successfully!");
            setTeamForm({ name: "", assignedSites: [] });
            fetchTeams();
        } catch (error) {
            console.error("Add team error:", error);
            alert("Failed to add team: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const updateTeam = async () => {
    if (!teamForm.name.trim()) {
        return alert("Team name is required.");
    }

    setLoading(true);
    try {
        const currentTeam = teams.find(t => t.id === editingTeamId);
        const teamId = currentTeam.teamId;
        
        // Update team basic info
        const teamRef = doc(db, "teams", editingTeamId);
        await updateDoc(teamRef, {
            name: teamForm.name.trim(),
            assignedsite: teamForm.assignedSites
        });

        // Handle member changes
        const currentMembers = employees.filter(emp => emp.teamId === teamId);
        const currentMemberIds = currentMembers.map(emp => emp.empId);
        
        // Remove employees that are no longer in the team
        const removedMembers = currentMemberIds.filter(id => !editingTeamMembers.includes(id));
        for (const empId of removedMembers) {
            const employee = employees.find(emp => emp.empId === empId);
            if (employee) {
                const empRef = doc(db, "employee", employee.id);
                await updateDoc(empRef, { teamId: "" });
            }
        }
        
        // Add new employees to the team
        const addedMembers = editingTeamMembers.filter(id => !currentMemberIds.includes(id));
        for (const empId of addedMembers) {
            const employee = employees.find(emp => emp.empId === empId);
            if (employee) {
                const empRef = doc(db, "employee", employee.id);
                await updateDoc(empRef, { teamId: teamId });
            }
        }

        // Handle supervisor changes
        const currentSupervisor = supervisors.find(sup => sup.teamId === teamId);
        const currentSupId = currentSupervisor ? currentSupervisor.supId : "";
        
        if (currentSupId !== editingTeamSupervisor) {
            // Remove old supervisor
            if (currentSupervisor) {
                const oldSupRef = doc(db, "supervisor", currentSupervisor.id);
                await updateDoc(oldSupRef, { teamId: "" });
            }
            
            // Add new supervisor
            if (editingTeamSupervisor) {
                const newSupervisor = supervisors.find(sup => sup.supId === editingTeamSupervisor);
                if (newSupervisor) {
                    const newSupRef = doc(db, "supervisor", newSupervisor.id);
                    await updateDoc(newSupRef, { teamId: teamId });
                }
            }
        }

        alert("Team updated successfully!");
        resetTeamForm();
        fetchTeams();
        fetchEmployees();
        fetchSupervisors();
        
    } catch (error) {
        console.error("Update team error:", error);
        alert("Failed to update team: " + error.message);
    } finally {
        setLoading(false);
    }
};


    const handleEditTeam = (team) => {
    setEditingTeamId(team.id);
    setTeamForm({
        name: team.name,
        assignedSites: team.assignedsite || []
    });
    
    // Get current team members
    const currentMembers = employees.filter(emp => emp.teamId === team.teamId);
    setEditingTeamMembers(currentMembers.map(emp => emp.empId));
    
    // Get current team supervisor
    const currentSupervisor = supervisors.find(sup => sup.teamId === team.teamId);
    setEditingTeamSupervisor(currentSupervisor ? currentSupervisor.supId : "");
};


    const handleDeleteTeam = async (teamId, teamDocId) => {
    if (!window.confirm("Are you sure you want to delete this team?")) return;

    setLoading(true);
    try {
        // Check if team has members
        const teamMembers = employees.filter(emp => emp.teamId === teamId);
        
        // Check if team has supervisor
        const teamSupervisor = supervisors.find(sup => sup.teamId === teamId);
        
        if (teamMembers.length > 0 || teamSupervisor) {
            const confirmMessage = `This team has ${teamMembers.length} member(s) and ${teamSupervisor ? '1 supervisor' : '0 supervisors'}. 
            
Options:
1. Cancel deletion
2. Delete team and reassign members/supervisor to "No Team"

Choose OK to reassign and delete, Cancel to abort.`;
            
            if (!window.confirm(confirmMessage)) {
                setLoading(false);
                return;
            }

            // Reassign members to no team
            for (const member of teamMembers) {
                const memberRef = doc(db, "employee", member.id);
                await updateDoc(memberRef, { teamId: "" });
            }

            // Reassign supervisor to no team
            if (teamSupervisor) {
                const supRef = doc(db, "supervisor", teamSupervisor.id);
                await updateDoc(supRef, { teamId: "" });
            }
        }

        // Delete the team
        await deleteDoc(doc(db, "teams", teamDocId));
        alert("Team deleted successfully!");
        
        // Refresh all data
        fetchTeams();
        fetchEmployees();
        fetchSupervisors();
        
    } catch (error) {
        console.error("Delete team error:", error);
        alert("Failed to delete team: " + error.message);
    } finally {
        setLoading(false);
    }
};

    // Supervisor operations
    const addSupervisor = async () => {
        if (!supervisorForm.name.trim() || !supervisorForm.email.trim()) {
            return alert("Name and email are required.");
        }

        setLoading(true);
        try {
            const newSupId = generateSupId(supervisors.length);
            const password = generatePassword();

            // Create user in Firebase Auth
            await createUserWithEmailAndPassword(auth, supervisorForm.email, password);

            const supervisorData = {
                supId: newSupId,
                name: supervisorForm.name.trim(),
                email: supervisorForm.email.trim(),
                teamId: supervisorForm.teamId
            };

            await addDoc(collection(db, "supervisor"), supervisorData);

            // Update team with supervisor ID if team is selected
            if (supervisorForm.teamId) {
                const teamQuery = query(collection(db, "teams"), where("teamId", "==", supervisorForm.teamId));
                const teamSnapshot = await getDocs(teamQuery);
                if (!teamSnapshot.empty) {
                    const teamDoc = teamSnapshot.docs[0];
                    await updateDoc(teamDoc.ref, { supId: newSupId });
                }
            }

            // Send password email
            await sendPasswordEmail({ ...supervisorForm, supId: newSupId }, password);

            alert(`Supervisor added successfully! Password sent to ${supervisorForm.email}`);
            setSupervisorForm({ name: "", email: "", teamId: "" });
            fetchSupervisors();
            fetchTeams();
        } catch (error) {
            console.error("Add supervisor error:", error);
            alert("Failed to add supervisor: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const updateSupervisor = async () => {
        if (!supervisorForm.name.trim() || !supervisorForm.email.trim()) {
            return alert("Name and email are required.");
        }

        setLoading(true);
        try {
            const supervisor = supervisors.find(s => s.id === editingSupervisorId);
            const oldTeamId = supervisor.teamId;

            const supRef = doc(db, "supervisor", editingSupervisorId);
            await updateDoc(supRef, {
                name: supervisorForm.name.trim(),
                email: supervisorForm.email.trim(),
                teamId: supervisorForm.teamId
            });

            // Update old team to remove supervisor
            if (oldTeamId) {
                const oldTeamQuery = query(collection(db, "teams"), where("teamId", "==", oldTeamId));
                const oldTeamSnapshot = await getDocs(oldTeamQuery);
                if (!oldTeamSnapshot.empty) {
                    const oldTeamDoc = oldTeamSnapshot.docs[0];
                    await updateDoc(oldTeamDoc.ref, { supId: "" });
                }
            }

            // Update new team with supervisor ID
            if (supervisorForm.teamId) {
                const newTeamQuery = query(collection(db, "teams"), where("teamId", "==", supervisorForm.teamId));
                const newTeamSnapshot = await getDocs(newTeamQuery);
                if (!newTeamSnapshot.empty) {
                    const newTeamDoc = newTeamSnapshot.docs[0];
                    await updateDoc(newTeamDoc.ref, { supId: supervisor.supId });
                }
            }

            alert("Supervisor updated successfully!");
            setSupervisorForm({ name: "", email: "", teamId: "" });
            setEditingSupervisorId(null);
            fetchSupervisors();
            fetchTeams();
        } catch (error) {
            console.error("Update supervisor error:", error);
            alert("Failed to update supervisor: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleEditSupervisor = (supervisor) => {
        setEditingSupervisorId(supervisor.id);
        setSupervisorForm({
            name: supervisor.name,
            email: supervisor.email,
            teamId: supervisor.teamId || ""
        });
    };

    const handleDeleteSupervisor = async (supId, supDocId) => {
        if (!window.confirm("Are you sure you want to delete this supervisor?")) return;

        setLoading(true);
        try {
            const supervisor = supervisors.find(s => s.id === supDocId);
            
            // Remove supervisor from team
            if (supervisor.teamId) {
                const teamQuery = query(collection(db, "teams"), where("teamId", "==", supervisor.teamId));
                const teamSnapshot = await getDocs(teamQuery);
                if (!teamSnapshot.empty) {
                    const teamDoc = teamSnapshot.docs[0];
                    await updateDoc(teamDoc.ref, { supId: "" });
                }
            }

            await deleteDoc(doc(db, "supervisor", supDocId));
            alert("Supervisor deleted successfully!");
            fetchSupervisors();
            fetchTeams();
        } catch (error) {
            console.error("Delete supervisor error:", error);
            alert("Failed to delete supervisor: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Excel upload functions
    const handleTeamExcelUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const fileType = file.name.split('.').pop().toLowerCase();
        if (!['xlsx', 'xls'].includes(fileType)) {
            alert("Please upload a valid Excel file (.xlsx or .xls)");
            return;
        }

        setLoading(true);
        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(sheet);

            let successCount = 0;
            let failCount = 0;
            const errors = [];

            for (let i = 0; i < json.length; i++) {
                const team = json[i];

                if (!team.name) {
                    errors.push(`Row ${i + 1}: Missing team name`);
                    failCount++;
                    continue;
                }

                try {
                    const teamId = generateTeamId(teams.length + successCount);
                    
                    // Process sites
                    let assignedSites = [];
                    if (team.sites) {
                        const siteNames = team.sites.split(',').map(s => s.trim());
                        assignedSites = siteNames.map(siteName => {
                            const site = sites.find(s => s.name.toLowerCase() === siteName.toLowerCase());
                            return site ? site.siteId : null;
                        }).filter(Boolean);
                    }

                    const teamData = {
                        teamId,
                        name: team.name.trim(),
                        assignedsite: assignedSites,
                        members: []
                    };

                    await addDoc(collection(db, "teams"), teamData);
                    successCount++;
                } catch (err) {
                    errors.push(`Row ${i + 1}: ${err.message}`);
                    failCount++;
                }
            }

            alert(`Team Excel upload completed!\nSuccessfully added: ${successCount}\nFailed: ${failCount}`);
            fetchTeams();
        } catch (error) {
            console.error("Team Excel upload error:", error);
            alert("Failed to process Excel file: " + error.message);
        } finally {
            setLoading(false);
            e.target.value = '';
        }
    };

    const handleSupervisorExcelUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const fileType = file.name.split('.').pop().toLowerCase();
        if (!['xlsx', 'xls'].includes(fileType)) {
            alert("Please upload a valid Excel file (.xlsx or .xls)");
            return;
        }

        setLoading(true);
        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(sheet);

            let successCount = 0;
            let failCount = 0;
            const errors = [];

            for (let i = 0; i < json.length; i++) {
                const sup = json[i];

                if (!sup.name || !sup.email) {
                    errors.push(`Row ${i + 1}: Missing name or email`);
                    failCount++;
                    continue;
                }

                try {
                    const supId = generateSupId(supervisors.length + successCount);
                    const password = generatePassword();

                    // Create user in Firebase Auth
                    await createUserWithEmailAndPassword(auth, sup.email, password);

                    // Find team by name
                    let teamId = "";
                    if (sup.team) {
                        const team = teams.find(t => t.name.toLowerCase() === sup.team.toLowerCase());
                        teamId = team ? team.teamId : "";
                    }

                    const supervisorData = {
                        supId,
                        name: sup.name.trim(),
                        email: sup.email.trim(),
                        teamId
                    };

                    await addDoc(collection(db, "supervisor"), supervisorData);

                    // Update team with supervisor ID
                    if (teamId) {
                        const teamQuery = query(collection(db, "teams"), where("teamId", "==", teamId));
                        const teamSnapshot = await getDocs(teamQuery);
                        if (!teamSnapshot.empty) {
                            const teamDoc = teamSnapshot.docs[0];
                            await updateDoc(teamDoc.ref, { supId });
                        }
                    }

                    // Send password email
                    try {
                        await sendPasswordEmail({ ...sup, supId }, password);
                    } catch (emailError) {
                        console.warn(`Email failed for ${sup.email}:`, emailError);
                    }

                    successCount++;
                } catch (err) {
                    errors.push(`Row ${i + 1}: ${err.message}`);
                    failCount++;
                }
            }

            alert(`Supervisor Excel upload completed!\nSuccessfully added: ${successCount}\nFailed: ${failCount}`);
            fetchSupervisors();
            fetchTeams();
        } catch (error) {
            console.error("Supervisor Excel upload error:", error);
            alert("Failed to process Excel file: " + error.message);
        } finally {
            setLoading(false);
            e.target.value = '';
        }
    };

    // Reset forms
    const resetTeamForm = () => {
        setEditingTeamId(null);
        setTeamForm({ name: "", assignedSites: [] });
    };

    const resetSupervisorForm = () => {
        setEditingSupervisorId(null);
        setSupervisorForm({ name: "", email: "", teamId: "" });
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
                <h1>Teams & Supervisors Management</h1>
            </div>

            {/* Team Form */}
            <div style={styles.card}>
                <h2>{editingTeamId ? "Edit Team" : "Add New Team"}</h2>
                <div style={styles.formGrid}>
                    <input
                        placeholder="Team Name"
                        value={teamForm.name}
                        onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                        style={styles.input}
                        disabled={loading}
                    />
                </div>

                <div style={styles.selectContainer}>
                    <label>Assigned Sites:</label>
                    <Select
                        isMulti
                        options={siteOptions}
                        value={siteOptions.filter(option => teamForm.assignedSites.includes(option.value))}
                        onChange={(selectedOptions) => {
                            const selectedValues = selectedOptions ? selectedOptions.map(opt => opt.value) : [];
                            setTeamForm({ ...teamForm, assignedSites: selectedValues });
                        }}
                        placeholder="Select sites..."
                        isDisabled={loading}
                    />
                </div>

                <div style={styles.buttonGroup}>
                    <button
                        onClick={editingTeamId ? updateTeam : addTeam}
                        style={styles.primaryBtn}
                        disabled={loading}
                    >
                        {loading ? "Processing..." : (editingTeamId ? "Save Changes" : "Add Team")}
                    </button>
                    {editingTeamId && (
                        <button onClick={resetTeamForm} style={styles.secondaryBtn} disabled={loading}>
                            Cancel
                        </button>
                    )}
                </div>
            </div>

            {/* Supervisor Form */}
            <div style={styles.card}>
                <h2>{editingSupervisorId ? "Edit Supervisor" : "Add New Supervisor"}</h2>
                <div style={styles.formGrid}>
                    <input
                        placeholder="Supervisor Name"
                        value={supervisorForm.name}
                        onChange={(e) => setSupervisorForm({ ...supervisorForm, name: e.target.value })}
                        style={styles.input}
                        disabled={loading}
                    />
                    <input
                        placeholder="Email Address"
                        type="email"
                        value={supervisorForm.email}
                        onChange={(e) => setSupervisorForm({ ...supervisorForm, email: e.target.value })}
                        style={styles.input}
                        disabled={loading}
                    />
                </div>

                <div style={styles.selectContainer}>
                    <label>Assign to Team:</label>
                    <Select
                        options={teamOptions}
                        value={teamOptions.find(t => t.value === supervisorForm.teamId) || null}
                        onChange={(val) => setSupervisorForm({ ...supervisorForm, teamId: val ? val.value : "" })}
                        placeholder="Select team..."
                        isDisabled={loading}
                        isClearable
                    />
                </div>

                <div style={styles.buttonGroup}>
                    <button
                        onClick={editingSupervisorId ? updateSupervisor : addSupervisor}
                        style={styles.primaryBtn}
                        disabled={loading}
                    >
                        {loading ? "Processing..." : (editingSupervisorId ? "Save Changes" : "Add Supervisor")}
                    </button>
                    {editingSupervisorId && (
                        <button onClick={resetSupervisorForm} style={styles.secondaryBtn} disabled={loading}>
                            Cancel
                        </button>
                    )}
                </div>
            </div>

            {/* Bulk Upload */}
            <div style={styles.card}>
                <h2>Bulk Upload</h2>
                <div style={styles.uploadSection}>
                    <div style={styles.uploadItem}>
                        <h3>Teams Upload</h3>
                        <input
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={handleTeamExcelUpload}
                            style={styles.fileInput}
                            disabled={loading}
                        />
                        <p>Upload Excel file with columns: <strong>name</strong>, <strong>sites</strong> (comma-separated site names)</p>
                    </div>
                    <div style={styles.uploadItem}>
                        <h3>Supervisors Upload</h3>
                        <input
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={handleSupervisorExcelUpload}
                            style={styles.fileInput}
                            disabled={loading}
                        />
                        <p>Upload Excel file with columns: <strong>name</strong>, <strong>email</strong>, <strong>team</strong> (team name)</p>
                    </div>
                </div>
            </div>

            {/* Teams Table */}
            <div style={styles.card}>
                <div style={styles.cardHeader}>
                    <h2>Teams ({teams.length})</h2>
                    <input
                        placeholder="Search teams..."
                        value={teamSearch}
                        onChange={(e) => setTeamSearch(e.target.value)}
                        style={styles.searchInput}
                    />
                </div>

                <div style={styles.tableContainer}>
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th>Team ID</th>
                                <th>Team Name</th>
                                <th>Supervisor</th>
                                <th>Assigned Sites</th>
                                <th>Members</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTeams.map((team) => (
                                <tr key={team.id}>
                                    <td>{team.teamId}</td>
                                    <td>{team.name}</td>
                                    <td>{team.supId ? getSupervisorName(team.supId) : "No Supervisor"}</td>
                                    <td>{getSiteNames(team.assignedsite)}</td>
                                    <td>{getTeamMemberCount(team.teamId)} members</td>
                                    <td>
                                        <div style={styles.actionButtons}>
                                            <button
                                                onClick={() => handleEditTeam(team)}
                                                style={styles.editBtn}
                                                disabled={loading}
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDeleteTeam(team.teamId, team.id)}
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
                    {filteredTeams.length === 0 && (
                        <div style={styles.noData}>
                            {teamSearch ? "No teams found matching your search." : "No teams added yet."}
                        </div>
                    )}
                </div>
            </div>

            {/* Supervisors Table */}
            <div style={styles.card}>
                <div style={styles.cardHeader}>
                    <h2>Supervisors ({supervisors.length})</h2>
                    <input
                        placeholder="Search supervisors..."
                        value={supervisorSearch}
                        onChange={(e) => setSupervisorSearch(e.target.value)}
                        style={styles.searchInput}
                    />
                </div>

                <div style={styles.tableContainer}>
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th>Supervisor ID</th>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Assigned Team</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredSupervisors.map((supervisor) => (
                                <tr key={supervisor.id}>
                                    <td>{supervisor.supId}</td>
                                    <td>{supervisor.name}</td>
                                    <td>{supervisor.email}</td>
                                    <td>{supervisor.teamId ? getTeamName(supervisor.teamId) : "No Team"}</td>
                                    <td>
                                        <div style={styles.actionButtons}>
                                            <button
                                                onClick={() => handleEditSupervisor(supervisor)}
                                                style={styles.editBtn}
                                                disabled={loading}
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDeleteSupervisor(supervisor.supId, supervisor.id)}
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
                    {filteredSupervisors.length === 0 && (
                        <div style={styles.noData}>
                            {supervisorSearch ? "No supervisors found matching your search." : "No supervisors added yet."}
                        </div>
                    )}
                </div>
            </div>
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
        gap: '15px',
        marginBottom: '15px',
    },
    input: {
        padding: '10px',
        border: '1px solid #ddd',
        borderRadius: '4px',
        fontSize: '14px',
    },
    selectContainer: {
        marginBottom: '15px',
    },
    buttonGroup: {
        display: 'flex',
        gap: '10px',
        marginTop: '15px',
    },
    primaryBtn: {
        padding: '10px 20px',
        backgroundColor: '#007bff',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '14px',
    },
    secondaryBtn: {
        padding: '10px 20px',
        backgroundColor: '#6c757d',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '14px',
    },
    uploadSection: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '20px',
    },
    uploadItem: {
        padding: '15px',
        border: '1px solid #eee',
        borderRadius: '4px',
        backgroundColor: '#f9f9f9',
    },
    fileInput: {
        width: '100%',
        padding: '8px',
        border: '1px solid #ddd',
        borderRadius: '4px',
        marginBottom: '10px',
    },
    cardHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
    },
    searchInput: {
        padding: '8px',
        border: '1px solid #ddd',
        borderRadius: '4px',
        width: '250px',
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
        gap: '8px',
    },
    editBtn: {
        padding: '5px 10px',
        backgroundColor: '#28a745',
        color: 'white',
        border: 'none',
        borderRadius: '3px',
        cursor: 'pointer',
        fontSize: '12px',
    },
    deleteBtn: {
        padding: '5px 10px',
        backgroundColor: '#dc3545',
        color: 'white',
        border: 'none',
        borderRadius: '3px',
        cursor: 'pointer',
        fontSize: '12px',
    },
    noData: {
        textAlign: 'center',
        padding: '40px',
        color: '#666',
        fontStyle: 'italic',
    },
};

// Add these CSS styles to make the table look better
const tableStyles = `
    table th, table td {
        padding: 12px;
        text-align: left;
        border-bottom: 1px solid #ddd;
    }
    
    table th {
        background-color: #f8f9fa;
        font-weight: 600;
    }
    
    table tr:hover {
        background-color: #f5f5f5;
    }
    
    button:hover {
        opacity: 0.9;
    }
    
    button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
    
    @media (max-width: 768px) {
        .formGrid {
            grid-template-columns: 1fr;
        }
        
        .uploadSection {
            grid-template-columns: 1fr;
        }
        
        .searchInput {
            width: 100%;
        }
    }
`;

export default TeamsSection;