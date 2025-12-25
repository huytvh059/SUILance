import { ConnectButton, useCurrentAccount } from "@mysten/dapp-kit";
import { HashRouter as Router, Routes, Route, Link } from "react-router-dom";
import logoWit from './img/WIT_Logo.png';
import ClientDashboard from "./ClientDashboard";
import FreelancerDashboard from "./FreelancerDashboard";

export default function App() {
  const account = useCurrentAccount();

  return (
    <Router>
      <div style={{ minHeight: "100vh", backgroundColor: "#f8fafc", fontFamily: "'Inter', sans-serif" }}>
        
        {/* --- HEADER DÙNG CHUNG --- */}
        <nav style={{ backgroundColor: "#fff", padding: "16px 32px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Link to="/" style={{textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px'}}>
                <img src={logoWit} style={{ height: "40px", width: "auto" }} alt="WIT Logo" />
                <h1 style={{ fontSize: "20px", fontWeight: "800", color: "#0f172a", margin: 0 }}>SuiLance</h1>
            </Link>
          </div>
          <div style={{display: "flex", gap: "20px", alignItems: "center"}}>
            {account && <span style={{fontSize: "12px", background: "#f1f5f9", padding: "5px 10px", borderRadius: "20px", fontFamily: "monospace"}}>{account.address.slice(0,6)}...{account.address.slice(-4)}</span>}
            <ConnectButton />
          </div>
        </nav>

        {/* --- NỘI DUNG CHÍNH --- */}
        <div style={{ padding: "40px 20px" }}>
           {!account ? (
              <div style={{ textAlign: "center", marginTop: "50px" }}>
                 <h2>Vui lòng kết nối ví để tiếp tục</h2>
              </div>
           ) : (
             <Routes>
                {/* TRANG CHỦ: CHỌN VAI TRÒ */}
                <Route path="/" element={<HomeSelection />} />
                
                {/* TRANG CLIENT */}
                <Route path="/client" element={<ClientDashboard />} />
                
                {/* TRANG FREELANCER */}
                <Route path="/freelancer" element={<FreelancerDashboard />} />
             </Routes>
           )}
        </div>
      </div>
    </Router>
  );
}

// Component chọn vai trò ở trang chủ
const HomeSelection = () => {
    return (
        <div style={{ maxWidth: "600px", margin: "0 auto", textAlign: "center" }}>
            <h2 style={{marginBottom: "30px", color: "#334155"}}>Bạn muốn đóng vai trò gì hôm nay?</h2>
            <div style={{ display: "flex", gap: "20px", justifyContent: "center" }}>
                <Link to="/client" style={{textDecoration: "none"}}>
                    <div style={roleCardStyle}>
                        <div style={{fontSize: "40px"}}>👨‍💼</div>
                        <h3>Client</h3>
                        <p style={{fontSize: "13px", color: "#64748b"}}>Tôi muốn thuê người và trả tiền.</p>
                    </div>
                </Link>

                <Link to="/freelancer" style={{textDecoration: "none"}}>
                    <div style={roleCardStyle}>
                        <div style={{fontSize: "40px"}}>👨‍💻</div>
                        <h3>Freelancer</h3>
                        <p style={{fontSize: "13px", color: "#64748b"}}>Tôi muốn tìm việc và nhận tiền.</p>
                    </div>
                </Link>
            </div>
        </div>
    )
}

const roleCardStyle = {
    background: "#fff",
    padding: "30px",
    borderRadius: "16px",
    width: "200px",
    boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
    cursor: "pointer",
    transition: "transform 0.2s",
    border: "2px solid transparent"
};