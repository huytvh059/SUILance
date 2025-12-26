import { ConnectButton, useCurrentAccount } from "@mysten/dapp-kit";
import { HashRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import { useState } from "react";
import logoWit from './img/WIT_Logo.png';
import ClientDashboard from "./ClientDashboard";
import FreelancerDashboard from "./FreelancerDashboard";
import Marketplace from "./Marketplace"; // File mới tạo bên dưới

export default function App() {
  const account = useCurrentAccount();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <Router>
      <div style={{ minHeight: "100vh", backgroundColor: "#f1f5f9", display: "flex", flexDirection: "column" }}>
        
        {/* --- HEADER --- */}
        <header style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
             <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} style={mobileMenuBtn}>☰</button>
             <Link to="/" style={{textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px'}}>
                <img src={logoWit} style={{ height: "35px" }} alt="Logo" />
                <h1 style={{ fontSize: "18px", fontWeight: "800", color: "#1e293b", margin: 0, letterSpacing: "-0.5px" }}>SuiLance</h1>
             </Link>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <ConnectButton />
          </div>
        </header>

        <div style={{ display: "flex", flex: 1, position: "relative" }}>
          {/* --- SIDEBAR (Ẩn trên mobile nếu không open) --- */}
          <nav style={{ 
            ...sidebarStyle, 
            display: isMobileMenuOpen || window.innerWidth > 768 ? "flex" : "none" 
          }}>
            <div style={{ padding: "20px" }}>
              <p style={sidebarLabel}>MENU CHÍNH</p>
              <SidebarLink to="/" icon="🏠" label="Khám phá Job" onClick={() => setIsMobileMenuOpen(false)} />
              
              <p style={{...sidebarLabel, marginTop: "30px"}}>VAI TRÒ</p>
              <SidebarLink to="/client" icon="💼" label="Tôi muốn Thuê" onClick={() => setIsMobileMenuOpen(false)} />
              <SidebarLink to="/freelancer" icon="🛠️" label="Tôi tìm Việc" onClick={() => setIsMobileMenuOpen(false)} />
            </div>
          </nav>

          {/* --- NỘI DUNG CHÍNH --- */}
          <main style={mainContentStyle}>
            {!account ? (
              <WelcomeHero />
            ) : (
              <div style={containerFluid}>
                <Routes>
                  <Route path="/" element={<Marketplace />} />
                  <Route path="/client" element={<ClientDashboard />} />
                  <Route path="/freelancer" element={<FreelancerDashboard />} />
                </Routes>
              </div>
            )}
          </main>
        </div>
      </div>
    </Router>
  );
}

// Sub-components cho UI chuyên nghiệp
const SidebarLink = ({ to, icon, label, onClick }: any) => {
  const loc = useLocation();
  const active = loc.pathname === to;
  return (
    <Link to={to} onClick={onClick} style={{
      ...navLinkStyle,
      backgroundColor: active ? "#e2e8f0" : "transparent",
      color: active ? "#2563eb" : "#475569"
    }}>
      <span style={{fontSize: "20px"}}>{icon}</span>
      <span style={{fontWeight: active ? "700" : "500"}}>{label}</span>
    </Link>
  );
};

const WelcomeHero = () => (
  <div style={{ textAlign: "center", padding: "100px 20px" }}>
    <h1 style={{ fontSize: "40px", color: "#0f172a" }}>Nền tảng Freelance Phi tập trung</h1>
    <p style={{ color: "#64748b", maxWidth: "600px", margin: "20px auto", fontSize: "18px" }}>
      Kết nối tài năng và doanh nghiệp thông qua Smart Contract trên mạng lưới Sui. 
      An toàn, minh bạch và tức thì.
    </p>
    <div style={{marginTop: "30px"}}>
        <ConnectButton />
    </div>
  </div>
);

// --- STYLES ---
const headerStyle: any = { height: "70px", background: "#fff", padding: "0 24px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 1px 2px rgba(0,0,0,0.05)", position: "sticky", top: 0, zIndex: 100 };
const sidebarStyle: any = { width: "260px", background: "#fff", borderRight: "1px solid #e2e8f0", flexDirection: "column", position: "sticky", top: "70px", height: "calc(100vh - 70px)", zIndex: 90 };
const mainContentStyle: any = { flex: 1, padding: "30px", overflowX: "hidden" };
const containerFluid: any = { maxWidth: "1200px", margin: "0 auto" };
const sidebarLabel: any = { fontSize: "11px", fontWeight: "700", color: "#94a3b8", marginBottom: "12px", paddingLeft: "12px" };
const navLinkStyle: any = { display: "flex", alignItems: "center", gap: "12px", padding: "12px", borderRadius: "10px", textDecoration: "none", marginBottom: "4px", transition: "0.2s" };
const mobileMenuBtn: any = { display: window.innerWidth > 768 ? "none" : "block", background: "none", border: "none", fontSize: "24px", cursor: "pointer" };