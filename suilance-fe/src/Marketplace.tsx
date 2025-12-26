import { useState, useEffect } from "react";
import { API_URL } from "./constants";
import { Link } from "react-router-dom";

export default function Marketplace() {
  const [jobs, setJobs] = useState<any[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/jobs`).then(res => res.json()).then(data => {
      // Only show jobs that have been funded (available to accept)
      setJobs(data.filter((j: any) => j.status === "Funded").sort((a: any, b: any) => b.createdAt - a.createdAt));
    });
  }, []);

  return (
    <div>
      <div style={{ marginBottom: "30px" }}>
        <h2 style={{ fontSize: "28px", color: "#0f172a" }}>🔥 Latest Jobs</h2>
        <p style={{ color: "#64748b" }}>Explore opportunities to earn SUI today.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px" }}>
        {jobs.length > 0 ? jobs.map(job => (
          <div key={job.id} style={marketCard}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <h3 style={{ margin: 0, fontSize: "18px", color: "#1e293b" }}>{job.title}</h3>
              <span style={priceTag}>{job.price} SUI</span>
            </div>
            <p style={descTruncate}>{job.description}</p>
            <div style={{ marginTop: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "12px", color: "#94a3b8" }}>By: {job.creator.slice(0,6)}...</span>
              <Link to="/freelancer" style={applyBtn}>View Details</Link>
            </div>
          </div>
        )) : <p>No new jobs available at the moment.</p>}
      </div>
    </div>
  );
}

// --- STYLES (REMAIN UNCHANGED) ---
const marketCard: any = { background: "#fff", padding: "24px", borderRadius: "16px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)", border: "1px solid #f1f5f9" };
const priceTag: any = { background: "#dcfce7", color: "#166534", padding: "4px 12px", borderRadius: "20px", fontWeight: "700", fontSize: "14px" };
const descTruncate: any = { color: "#475569", fontSize: "14px", lineHeight: "1.5", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxDirection: "vertical", overflow: "hidden", margin: "15px 0" };
const applyBtn: any = { background: "#2563eb", color: "#fff", padding: "8px 16px", borderRadius: "8px", textDecoration: "none", fontSize: "14px", fontWeight: "600" };