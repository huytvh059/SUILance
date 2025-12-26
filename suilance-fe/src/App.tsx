import { ConnectButton, useCurrentAccount } from "@mysten/dapp-kit";
import { HashRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import { useState } from "react";
import logoWit from './img/WIT_Logo.png';
import ClientDashboard from "./ClientDashboard";
import FreelancerDashboard from "./FreelancerDashboard";
import Marketplace from "./Marketplace"; 

export default function App() {
  const account = useCurrentAccount();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <Router>
      <div style={globalWrapper}>
        
        {/* --- HEADER --- */}
        <header style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
             <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} style={mobileMenuBtn}>☰</button>
             <Link to="/" style={{textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '12px'}}>
                <img src={logoWit} style={{ height: "32px", borderRadius: "6px" }} alt="SuiLance Logo" />
                <h1 style={brandLogoStyle}>SuiLance</h1>
             </Link>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <ConnectButton />
          </div>
        </header>

        <div style={{ display: "flex", flex: 1, position: "relative" }}>
          {/* --- SIDEBAR --- */}
          <nav style={{ 
            ...sidebarStyle, 
            display: isMobileMenuOpen || window.innerWidth > 768 ? "flex" : "none" 
          }}>
            <div style={{ padding: "24px 16px" }}>
              <p style={sidebarLabel}>MAIN MENU</p>
              <SidebarLink to="/" icon="🏠" label="EXPLORE JOBS" onClick={() => setIsMobileMenuOpen(false)} />
              
              <p style={{...sidebarLabel, marginTop: "32px"}}>ROLES</p>
              <SidebarLink to="/client" icon="💼" label="CLIENT" onClick={() => setIsMobileMenuOpen(false)} />
              <SidebarLink to="/freelancer" icon="🛠️" label="FREELANCER" onClick={() => setIsMobileMenuOpen(false)} />
            </div>
          </nav>

          {/* --- MAIN CONTENT --- */}
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

// UI Sub-components
const SidebarLink = ({ to, icon, label, onClick }: any) => {
  const loc = useLocation();
  const active = loc.pathname === to;
  return (
    <Link to={to} onClick={onClick} style={{
      ...navLinkStyle,
      backgroundColor: active ? "#eff6ff" : "transparent",
      color: active ? "#2563eb" : "#64748b"
    }}>
      <span style={{fontSize: "18px", opacity: active ? 1 : 0.7}}>{icon}</span>
      <span style={{fontWeight: active ? "600" : "500", fontSize: "14px"}}>{label}</span>
      {active && <div style={activeIndicator} />}
    </Link>
  );
};

const WelcomeHero = () => (
  <div style={{ textAlign: "center", padding: "120px 20px", background: "white", borderRadius: "24px", margin: "20px", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)" }}>
    <h1 style={{ fontSize: "48px", fontWeight: "850", color: "#0f172a", letterSpacing: "-0.04em", marginBottom: "16px" }}>
      Decentralized Freelance Platform
    </h1>
    <p style={{ color: "#475569", maxWidth: "580px", margin: "0 auto", fontSize: "19px", lineHeight: "1.6" }}>
      Connecting talents and businesses through Smart Contracts on the Sui Network. 
      Secure, transparent, and instantaneous.
    </p>
    <div style={{marginTop: "40px"}}>
        <ConnectButton />
    </div>
  </div>
);

// --- IMPROVED STYLES ---
const fontStack = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

const globalWrapper: any = { 
  minHeight: "100vh", 
  backgroundColor: "#f8fafc", 
  display: "flex", 
  flexDirection: "column",
  fontFamily: fontStack,
  color: "#1e293b"
};

const headerStyle: any = { 
  height: "72px", 
  background: "rgba(255, 255, 255, 0.8)", 
  backdropFilter: "blur(8px)",
  padding: "0 32px", 
  display: "flex", 
  justifyContent: "space-between", 
  alignItems: "center", 
  borderBottom: "1px solid #e2e8f0",
  position: "sticky", 
  top: 0, 
  zIndex: 100 
};

const brandLogoStyle: any = { 
  fontSize: "20px", 
  fontWeight: "800", 
  color: "#0f172a", 
  margin: 0, 
  letterSpacing: "-0.03em" 
};

const sidebarStyle: any = { 
  width: "280px", 
  background: "#fff", 
  borderRight: "1px solid #e2e8f0", 
  flexDirection: "column", 
  position: "sticky", 
  top: "72px", 
  height: "calc(100vh - 72px)", 
  zIndex: 90 
};

const mainContentStyle: any = { 
  flex: 1, 
  padding: "40px", 
  overflowX: "hidden" 
};

const containerFluid: any = { 
  maxWidth: "1100px", 
  margin: "0 auto" 
};

const sidebarLabel: any = { 
  fontSize: "12px", 
  fontWeight: "700", 
  color: "#94a3b8", 
  marginBottom: "16px", 
  paddingLeft: "12px",
  letterSpacing: "0.05em"
};

const navLinkStyle: any = { 
  display: "flex", 
  alignItems: "center", 
  gap: "12px", 
  padding: "12px 16px", 
  borderRadius: "12px", 
  textDecoration: "none", 
  marginBottom: "6px", 
  transition: "all 0.2s ease",
  position: "relative"
};

const activeIndicator: any = {
  position: "absolute",
  left: "-16px",
  width: "4px",
  height: "20px",
  backgroundColor: "#2563eb",
  borderRadius: "0 4px 4px 0"
};

const mobileMenuBtn: any = { 
  display: window.innerWidth > 768 ? "none" : "block", 
  background: "#f1f5f9", 
  border: "none", 
  fontSize: "20px", 
  cursor: "pointer",
  padding: "8px",
  borderRadius: "8px"
};