import React, { useState, useEffect } from "react";
import { db } from "../../firebaseConfig";
import {
    collection,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    query,
    where,
    orderBy,
    limit
} from "firebase/firestore";
import * as XLSX from "xlsx";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix for default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const SiteControlPage = () => {
    const [sites, setSites] = useState([]);
    const [siteForm, setSiteForm] = useState({ name: "", address: "", lat: "", lng: "" });
    const [expandedSiteId, setExpandedSiteId] = useState(null);
    const [mapVisible, setMapVisible] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [editingSite, setEditingSite] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        fetchSites();
    }, []);

    // Generate auto-incremented site ID like site001, site002, etc.
    const generateSiteId = async () => {
        const siteSnap = await getDocs(collection(db, "Sites"));
        const existingSiteIds = siteSnap.docs.map(doc => doc.data().siteId);
        
        // Extract numbers from existing site IDs and find the highest
        const maxNumber = existingSiteIds
            .filter(id => id && id.startsWith("site"))
            .map(id => parseInt(id.replace("site", "")))
            .filter(num => !isNaN(num))
            .reduce((max, current) => Math.max(max, current), 0);
        
        const nextNumber = maxNumber + 1;
        return `site${nextNumber.toString().padStart(3, '0')}`;
    };

    const fetchSites = async () => {
        setIsLoading(true);
        try {
            const siteSnap = await getDocs(collection(db, "Sites"));
            const siteData = [];

            for (let docSnap of siteSnap.docs) {
                const site = docSnap.data();
                site.docId = docSnap.id;

                // Get assigned employees based on site name
                const empSnap = await getDocs(
                    query(collection(db, "employee"), where("assigned", "array-contains", site.name))
                );
                site.employees = empSnap.docs.map(doc => doc.data());

                // Get active employees (those who are currently checked in)
                const activeEmployees = [];
                for (let emp of site.employees) {
                    // Get the latest attendance record for this employee at this site
                    const latestAttendanceSnap = await getDocs(
                        query(
                            collection(db, "attendance"),
                            where("empId", "==", emp.empId),
                            where("siteId", "==", site.siteId),
                            orderBy("timestamp", "desc"),
                            limit(1)
                        )
                    );
                    
                    if (!latestAttendanceSnap.empty) {
                        const latestRecord = latestAttendanceSnap.docs[0].data();
                        emp.lastCheckIn = latestRecord.timestamp?.toDate()?.toLocaleString() || "No record";
                        
                        // Employee is active if their last record is check in
                        if (latestRecord.type.toLowerCase().includes("check in")) {
                            activeEmployees.push(emp);
                        }
                    } else {
                        emp.lastCheckIn = "No record";
                    }
                }

                site.activeCount = activeEmployees.length;
                siteData.push(site);
            }

            setSites(siteData);
        } catch (error) {
            console.error("Error fetching sites:", error);
            alert("Error fetching sites. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddSite = async () => {
        const { name, address, lat, lng } = siteForm;
        if (!name || !address || !lat || !lng) {
            alert("Please fill all fields");
            return;
        }

        if (isNaN(parseFloat(lat)) || isNaN(parseFloat(lng))) {
            alert("Please enter valid latitude and longitude values");
            return;
        }

        setIsLoading(true);
        try {
            const siteId = await generateSiteId();
            
            await addDoc(collection(db, "Sites"), {
                siteId,
                name: name.trim(),
                address: address.trim(),
                lat: parseFloat(lat),
                lng: parseFloat(lng),
            });

            setSiteForm({ name: "", address: "", lat: "", lng: "" });
            await fetchSites();
            alert("Site added successfully!");
        } catch (error) {
            console.error("Error adding site:", error);
            alert("Error adding site. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditSite = async (site) => {
        const { name, address, lat, lng } = siteForm;
        if (!name || !address || !lat || !lng) {
            alert("Please fill all fields");
            return;
        }

        setIsLoading(true);
        try {
            await updateDoc(doc(db, "Sites", site.docId), {
                name: name.trim(),
                address: address.trim(),
                lat: parseFloat(lat),
                lng: parseFloat(lng),
            });

            setSiteForm({ name: "", address: "", lat: "", lng: "" });
            setEditingSite(null);
            await fetchSites();
            alert("Site updated successfully!");
        } catch (error) {
            console.error("Error updating site:", error);
            alert("Error updating site. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteSite = async (id, siteName) => {
    if (window.confirm(`Are you sure you want to delete site "${siteName}"?`)) {
        setIsLoading(true);
        try {
            // First, get the site document to get the siteId
            const siteDoc = await getDocs(query(collection(db, "Sites"), where("name", "==", siteName)));
            let siteId = null;
            
            if (!siteDoc.empty) {
                siteId = siteDoc.docs[0].data().siteId;
            }

            // Delete the site from Sites collection
            await deleteDoc(doc(db, "Sites", id));

            // If we found the siteId, remove it from teams collection
            if (siteId) {
                // Get all teams that have this site in their assignedsite array
                const teamsQuery = query(
                    collection(db, "teams"),
                    where("assignedsite", "array-contains", siteId)
                );
                
                const teamsSnapshot = await getDocs(teamsQuery);
                
                // Update each team to remove this site from assignedsite array
                const updatePromises = teamsSnapshot.docs.map(teamDoc => {
                    const teamData = teamDoc.data();
                    const updatedAssignedSites = teamData.assignedsite.filter(site => site !== siteId);
                    
                    return updateDoc(doc(db, "teams", teamDoc.id), {
                        assignedsite: updatedAssignedSites
                    });
                });
                
                // Wait for all team updates to complete
                await Promise.all(updatePromises);
                
                console.log(`Site ${siteId} removed from ${teamsSnapshot.docs.length} teams`);
            }

            await fetchSites();
            alert("Site deleted successfully and removed from all teams!");
        } catch (error) {
            console.error("Error deleting site:", error);
            alert("Error deleting site. Please try again.");
        } finally {
            setIsLoading(false);
        }
    }
};

    const handleUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsLoading(true);
        
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                // Get first worksheet
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                
                // Convert to JSON
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                // Skip header row and convert to objects
                const headers = jsonData[0];
                const rows = jsonData.slice(1).map(row => {
                    const obj = {};
                    headers.forEach((header, index) => {
                        obj[header.toLowerCase()] = row[index];
                    });
                    return obj;
                });

                const validRows = rows.filter(row => 
                    row.name && row.address && row.lat && row.lng &&
                    !isNaN(parseFloat(row.lat)) && !isNaN(parseFloat(row.lng))
                );

                if (validRows.length === 0) {
                    alert("No valid rows found in Excel file. Please check your file format.");
                    setIsLoading(false);
                    return;
                }

                const batch = [];
                for (let row of validRows) {
                    const siteId = await generateSiteId();
                    batch.push(addDoc(collection(db, "Sites"), {
                        name: row.name.toString().trim(),
                        address: row.address.toString().trim(),
                        lat: parseFloat(row.lat),
                        lng: parseFloat(row.lng),
                        siteId
                    }));
                }

                await Promise.all(batch);
                await fetchSites();
                alert(`${validRows.length} sites uploaded successfully!`);
            } catch (error) {
                console.error("Error processing Excel file:", error);
                alert("Error reading Excel file. Please check the file format.");
            } finally {
                setIsLoading(false);
            }
        };
        
        reader.readAsArrayBuffer(file);
    };

    const startEditing = (site) => {
        setEditingSite(site);
        setSiteForm({
            name: site.name,
            address: site.address,
            lat: site.lat.toString(),
            lng: site.lng.toString()
        });
    };

    const cancelEditing = () => {
        setEditingSite(null);
        setSiteForm({ name: "", address: "", lat: "", lng: "" });
    };

    // Filter sites based on search term
    const filteredSites = sites.filter(site => 
        site.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        site.siteId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        site.address.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleBackClick = () => {
        window.history.back();
    };

    return (
        <div style={{ 
            padding: "20px",
            fontFamily: "Arial, sans-serif",
            backgroundColor: "#f5f5f5",
            minHeight: "100vh"
        }}>
            <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
                {/* Header */}
                <div style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    marginBottom: "20px",
                    backgroundColor: "white",
                    padding: "15px",
                    borderRadius: "8px",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                }}>
                    <button 
                        onClick={handleBackClick}
                        style={{
                            padding: "8px 15px",
                            backgroundColor: "#007bff",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            marginRight: "15px"
                        }}
                    >
                        ← Back
                    </button>
                    <h1 style={{ margin: "0", color: "#333" }}>Site Control Panel</h1>
                </div>

                {/* Add/Edit Site Form */}
                <div style={{ 
                    backgroundColor: "white", 
                    padding: "20px", 
                    borderRadius: "8px", 
                    marginBottom: "20px",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                }}>
                    <h2 style={{ marginTop: "0", color: "#333" }}>
                        {editingSite ? "Edit Site" : "Add New Site"}
                    </h2>
                    <div style={{ 
                        display: "grid", 
                        gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", 
                        gap: "15px", 
                        marginBottom: "15px" 
                    }}>
                        <input 
                            placeholder="Site Name" 
                            value={siteForm.name} 
                            onChange={(e) => setSiteForm({ ...siteForm, name: e.target.value })}
                            style={{ 
                                padding: "10px", 
                                border: "1px solid #ddd", 
                                borderRadius: "4px",
                                fontSize: "14px"
                            }}
                        />
                        <input 
                            placeholder="Address" 
                            value={siteForm.address} 
                            onChange={(e) => setSiteForm({ ...siteForm, address: e.target.value })}
                            style={{ 
                                padding: "10px", 
                                border: "1px solid #ddd", 
                                borderRadius: "4px",
                                fontSize: "14px"
                            }}
                        />
                        <input 
                            placeholder="Latitude" 
                            type="number"
                            step="any"
                            value={siteForm.lat} 
                            onChange={(e) => setSiteForm({ ...siteForm, lat: e.target.value })}
                            style={{ 
                                padding: "10px", 
                                border: "1px solid #ddd", 
                                borderRadius: "4px",
                                fontSize: "14px"
                            }}
                        />
                        <input 
                            placeholder="Longitude" 
                            type="number"
                            step="any"
                            value={siteForm.lng} 
                            onChange={(e) => setSiteForm({ ...siteForm, lng: e.target.value })}
                            style={{ 
                                padding: "10px", 
                                border: "1px solid #ddd", 
                                borderRadius: "4px",
                                fontSize: "14px"
                            }}
                        />
                    </div>
                    <div style={{ display: "flex", gap: "10px" }}>
                        {editingSite ? (
                            <>
                                <button 
                                    onClick={() => handleEditSite(editingSite)}
                                    disabled={isLoading}
                                    style={{ 
                                        padding: "10px 20px", 
                                        backgroundColor: "#28a745",
                                        color: "white", 
                                        border: "none", 
                                        borderRadius: "4px",
                                        cursor: isLoading ? "not-allowed" : "pointer"
                                    }}
                                >
                                    {isLoading ? "Updating..." : "Update Site"}
                                </button>
                                <button 
                                    onClick={cancelEditing}
                                    style={{ 
                                        padding: "10px 20px", 
                                        backgroundColor: "#dc3545",
                                        color: "white", 
                                        border: "none", 
                                        borderRadius: "4px",
                                        cursor: "pointer"
                                    }}
                                >
                                    Cancel
                                </button>
                            </>
                        ) : (
                            <button 
                                onClick={handleAddSite}
                                disabled={isLoading}
                                style={{ 
                                    padding: "10px 20px", 
                                    backgroundColor: "#007bff",
                                    color: "white", 
                                    border: "none", 
                                    borderRadius: "4px",
                                    cursor: isLoading ? "not-allowed" : "pointer"
                                }}
                            >
                                {isLoading ? "Adding..." : "Add Site"}
                            </button>
                        )}
                    </div>
                </div>

                {/* Excel Upload */}
                <div style={{ 
                    backgroundColor: "white", 
                    padding: "20px", 
                    borderRadius: "8px", 
                    marginBottom: "20px",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                }}>
                    <h2 style={{ marginTop: "0", color: "#333" }}>Upload Sites from Excel</h2>
                    <p style={{ color: "#666", marginBottom: "15px" }}>
                        Excel file should contain columns: name, address, lat, lng
                    </p>
                    <input 
                        type="file" 
                        accept=".xlsx, .xls" 
                        onChange={handleUpload}
                        disabled={isLoading}
                        style={{ 
                            padding: "10px",
                            border: "1px solid #ddd",
                            borderRadius: "4px",
                            width: "100%"
                        }}
                    />
                </div>

                {/* Sites List */}
                <div style={{
                    backgroundColor: "white",
                    borderRadius: "8px",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                    overflow: "hidden"
                }}>
                    {/* Sites Header */}
                    <div style={{ padding: "20px", borderBottom: "1px solid #eee" }}>
                        <div style={{ 
                            display: "flex", 
                            justifyContent: "space-between", 
                            alignItems: "center", 
                            marginBottom: "15px"
                        }}>
                            <h2 style={{ margin: "0", color: "#333" }}>
                                All Sites ({filteredSites.length})
                            </h2>
                            {/* Search Bar */}
                        <div style={{ position: "relative", width: "40%" }}>
  <span style={{
    position: "absolute",
    top: "50%",
    left: "10px",
    transform: "translateY(-50%)",
    color: "#888"
  }}>
    🔍
  </span>
  <input
    type="text"
    placeholder="Search sites by name, ID, or address..."
    value={searchTerm}
    onChange={(e) => setSearchTerm(e.target.value)}
    style={{
      width: "130%",
      padding: "10px 10px 10px 30px", // space for icon
      border: "1px solid #ddd",
      borderRadius: "4px",
      fontSize: "14px"
    }}
  />
</div>
                            <button 
                                onClick={() => setMapVisible(!mapVisible)}
                                style={{ 
                                    padding: "8px 15px", 
                                    backgroundColor: mapVisible ? "#dc3545" : "#28a745", 
                                    color: "white", 
                                    border: "none", 
                                    borderRadius: "4px",
                                    cursor: "pointer"
                                }}
                            >
                                {mapVisible ? "Hide Map" : "Show Map"}
                            </button>
                        </div>

                        
                    </div>

                    {/* Map */}
                    {mapVisible && sites.length > 0 && (
                        <div style={{ padding: "20px" }}>
                            <MapContainer 
                                center={[28.3949, 84.1240]} 
                                zoom={7} 
                                style={{ height: "400px", borderRadius: "4px" }}
                            >
                                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                {sites.map((site, index) => (
                                    <Marker key={index} position={[site.lat, site.lng]}>
                                        <Popup>
                                            <div>
                                                <strong>{site.name}</strong><br />
                                                <em>{site.siteId}</em><br />
                                                {site.address}<br />
                                                <small>Total: {site.employees.length} | Active: {site.activeCount}</small>
                                            </div>
                                        </Popup>
                                    </Marker>
                                ))}
                            </MapContainer>
                        </div>
                    )}

                    {/* Sites Table */}
                    <div style={{ padding: "20px" }}>
                        {isLoading ? (
                            <div style={{ textAlign: "center", padding: "40px", color: "#666" }}>
                                Loading sites...
                            </div>
                        ) : (
                            <div style={{ overflowX: "auto" }}>
                                <table style={{ 
                                    width: "100%", 
                                    borderCollapse: "collapse",
                                    fontSize: "14px"
                                }}>
                                    <thead>
                                        <tr style={{ backgroundColor: "#f8f9fa" }}>
                                            <th style={{ padding: "12px", textAlign: "left", borderBottom: "2px solid #dee2e6" }}>Site ID</th>
                                            <th style={{ padding: "12px", textAlign: "left", borderBottom: "2px solid #dee2e6" }}>Name</th>
                                            <th style={{ padding: "12px", textAlign: "left", borderBottom: "2px solid #dee2e6" }}>Address</th>
                                            <th style={{ padding: "12px", textAlign: "left", borderBottom: "2px solid #dee2e6" }}>Coordinates</th>
                                            <th style={{ padding: "12px", textAlign: "center", borderBottom: "2px solid #dee2e6" }}>Total</th>
                                            <th style={{ padding: "12px", textAlign: "center", borderBottom: "2px solid #dee2e6" }}>Active</th>
                                            <th style={{ padding: "12px", textAlign: "center", borderBottom: "2px solid #dee2e6" }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredSites.map((site, index) => (
                                            <React.Fragment key={index}>
                                                <tr style={{ borderBottom: "1px solid #dee2e6" }}>
                                                    <td style={{ padding: "12px" }}>{site.siteId}</td>
                                                    <td style={{ padding: "12px" }}>{site.name}</td>
                                                    <td style={{ padding: "12px" }}>{site.address}</td>
                                                    <td style={{ padding: "12px" }}>
                                                        {site.lat.toFixed(4)}, {site.lng.toFixed(4)}
                                                    </td>
                                                    <td style={{ padding: "12px", textAlign: "center" }}>
                                                        <span style={{ 
                                                            backgroundColor: "#007bff", 
                                                            color: "white",
                                                            padding: "4px 8px", 
                                                            borderRadius: "4px",
                                                            fontSize: "12px"
                                                        }}>
                                                            {site.employees.length}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: "12px", textAlign: "center" }}>
                                                        <span style={{ 
                                                            backgroundColor: site.activeCount > 0 ? "#28a745" : "#ffc107", 
                                                            color: "white",
                                                            padding: "4px 8px", 
                                                            borderRadius: "4px",
                                                            fontSize: "12px"
                                                        }}>
                                                            {site.activeCount}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: "12px", textAlign: "center" }}>
                                                        <div style={{ display: "flex", gap: "5px", justifyContent: "center" }}>
                                                            <button 
                                                                onClick={() => startEditing(site)}
                                                                style={{ 
                                                                    padding: "5px 10px", 
                                                                    backgroundColor: "#ffc107", 
                                                                    color: "white", 
                                                                    border: "none", 
                                                                    borderRadius: "4px", 
                                                                    cursor: "pointer",
                                                                    fontSize: "12px"
                                                                }}
                                                            >
                                                                Edit
                                                            </button>
                                                            <button 
                                                                onClick={() => handleDeleteSite(site.docId, site.name)}
                                                                style={{ 
                                                                    padding: "5px 10px", 
                                                                    backgroundColor: "#dc3545", 
                                                                    color: "white", 
                                                                    border: "none", 
                                                                    borderRadius: "4px", 
                                                                    cursor: "pointer",
                                                                    fontSize: "12px"
                                                                }}
                                                            >
                                                                Delete
                                                            </button>
                                                            <button 
                                                                onClick={() => setExpandedSiteId(expandedSiteId === site.docId ? null : site.docId)}
                                                                style={{ 
                                                                    padding: "5px 10px", 
                                                                    backgroundColor: "#17a2b8", 
                                                                    color: "white", 
                                                                    border: "none", 
                                                                    borderRadius: "4px",
                                                                    cursor: "pointer",
                                                                    fontSize: "12px"
                                                                }}
                                                            >
                                                                {expandedSiteId === site.docId ? "Hide" : "Details"}
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                                {expandedSiteId === site.docId && (
                                                    <tr>
                                                        <td colSpan="7" style={{ padding: "0", backgroundColor: "#f8f9fa" }}>
                                                            <div style={{ padding: "20px" }}>
                                                                <h3 style={{ marginTop: "0", color: "#333" }}>
                                                                    Site Details: {site.name}
                                                                </h3>
                                                                <div style={{ 
                                                                    display: "grid", 
                                                                    gridTemplateColumns: "1fr 1fr", 
                                                                    gap: "20px" 
                                                                }}>
                                                                    <div>
                                                                        <h4 style={{ color: "#333", marginBottom: "10px" }}>
                                                                            Site Information
                                                                        </h4>
                                                                        <div style={{ backgroundColor: "white", padding: "15px", borderRadius: "4px" }}>
                                                                            <p><strong>ID:</strong> {site.siteId}</p>
                                                                            <p><strong>Name:</strong> {site.name}</p>
                                                                            <p><strong>Address:</strong> {site.address}</p>
                                                                            <p><strong>Coordinates:</strong> {site.lat}, {site.lng}</p>
                                                                        </div>
                                                                    </div>
                                                                    <div>
                                                                        <h4 style={{ color: "#333", marginBottom: "10px" }}>
                                                                            Assigned Employees ({site.employees.length})
                                                                        </h4>
                                                                        <div style={{ 
                                                                            backgroundColor: "white", 
                                                                            padding: "15px", 
                                                                            borderRadius: "4px",
                                                                            maxHeight: "250px",
                                                                            overflowY: "auto"
                                                                        }}>
                                                                            {site.employees.length > 0 ? (
                                                                                site.employees.map((emp, j) => (
                                                                                    <div key={j} style={{ 
                                                                                        marginBottom: "10px", 
                                                                                        padding: "10px", 
                                                                                        backgroundColor: "#f8f9fa", 
                                                                                        borderRadius: "4px"
                                                                                    }}>
                                                                                        <div><strong>{emp.name}</strong> ({emp.empId})</div>
                                                                                        <div style={{ fontSize: "12px", color: "#666" }}>
                                                                                            Last Check-in: {emp.lastCheckIn}
                                                                                        </div>
                                                                                    </div>
                                                                                ))
                                                                            ) : (
                                                                                <div style={{ 
                                                                                    textAlign: "center",
                                                                                    padding: "20px",
                                                                                    color: "#666",
                                                                                    fontStyle: "italic"
                                                                                }}>
                                                                                    No employees assigned to this site yet
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                </table>
                                {filteredSites.length === 0 && !isLoading && (
                                    <div style={{ 
                                        textAlign: "center", 
                                        padding: "40px", 
                                        color: "#666"
                                    }}>
                                        {searchTerm ? (
                                            <div>
                                                <div>No sites found matching "{searchTerm}"</div>
                                                <button 
                                                    onClick={() => setSearchTerm("")}
                                                    style={{
                                                        marginTop: "10px",
                                                        padding: "8px 15px",
                                                        backgroundColor: "#007bff",
                                                        color: "white",
                                                        border: "none",
                                                        borderRadius: "4px",
                                                        cursor: "pointer"
                                                    }}
                                                >
                                                    Clear Search
                                                </button>
                                            </div>
                                        ) : (
                                            <div>No sites found. Add your first site above.</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SiteControlPage;