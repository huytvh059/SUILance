import { useState, useEffect } from "react";
import { useSignAndExecuteTransaction, useSuiClient, useCurrentAccount } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { PACKAGE_ID, MODULE_JOB, MODULE_SUBMIT, API_URL } from "./constants";
import toast from 'react-hot-toast';

export default function FreelancerDashboard() {
  const client = useSuiClient();
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  
  // Job Management State
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  
  // Modal Type State: 'analyze' (Accepting job) or 'submit' (Submitting work)
  const [modalType, setModalType] = useState<'analyze' | 'submit'>('analyze');

  const [proof, setProof] = useState("");
  const [key, setKey] = useState("");

  // Reputation & AI State
  const [reputations, setReputations] = useState<any[]>([]);
  const [totalScore, setTotalScore] = useState(0);
  const [tier, setTier] = useState({ label: "NEWBIE 🛡️", color: "#64748b" });
  const [aiAdvice, setAiAdvice] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // --- DATA & ORACLE ---
  const fetchData = async () => {
    try {
        const resJobs = await fetch(`${API_URL}/jobs`);
        const dataJobs = await resJobs.json();
        setJobs(dataJobs.sort((a: any, b: any) => b.createdAt - a.createdAt));

        const resRep = await fetch(`${API_URL}/reputations`);
        const dataRep = await resRep.json();
        setReputations(dataRep.reverse());
        
        if (dataRep.length > 0) {
            const avgRating = dataRep.reduce((acc: number, curr: any) => acc + Number(curr.rating), 0) / dataRep.length;
            const experienceBonus = Math.min(dataRep.length * 0.2, 1.5);
            let finalScore = (avgRating * 0.7) + experienceBonus;
            const scoreFixed = Number(Math.min(finalScore, 5).toFixed(1));
            setTotalScore(scoreFixed);

            if (scoreFixed >= 4.8 && dataRep.length >= 5) setTier({ label: "MASTER 👑", color: "#7c3aed" });
            else if (scoreFixed >= 4.3 && dataRep.length >= 3) setTier({ label: "PROFESSIONAL 💎", color: "#2563eb" });
            else if (scoreFixed >= 3.5) setTier({ label: "EXPERIENCED ✨", color: "#10b981" });
            else setTier({ label: "NEWBIE 🛡️", color: "#64748b" });
        }
    } catch (error) { console.error("Error:", error); }
  };

  useEffect(() => { fetchData(); const interval = setInterval(fetchData, 3000); return () => clearInterval(interval); }, []);

  const updateJobOnCloud = async (jobSuiId: string, updateData: any) => {
      const job = jobs.find(j => j.sui_id === jobSuiId);
      if (!job) return;
      await fetch(`${API_URL}/jobs/${job.id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(updateData) });
      fetchData();
  };

  // --- 🔥 MODAL & AI LOGIC ---
  const openAIAnalysis = (job: any) => {
      setSelectedJob(job);
      setModalType('analyze'); // Analysis mode
      analyzeJobWithAI(job);   // Run AI immediately
  }

  const openSubmitModal = (job: any) => {
      setSelectedJob(job);
      setModalType('submit'); // Submission mode
      setAiAdvice(""); // Reset AI text
  }

  // --- MOCK AI AGENT ---
  const analyzeJobWithAI = async (job: any) => {
      setIsAnalyzing(true);
      setAiAdvice("");
      let advice = "";
      const price = parseFloat(job.price);
      const myScore = totalScore;

      setTimeout(() => {
          if (myScore < 3.0 && price > 1.0) {
             advice = "⚠️ HIGH RISK: You are currently a Newbie but this job has high value (>1 SUI). The client might have very strict requirements. Consider carefully!";
          } else if (myScore >= 4.0 && price < 0.5) {
             advice = "📉 NOT RECOMMENDED: You are an Expert but this job's budget is too low. Don't undersell your skills!";
          } else if (myScore >= 3.5 && price >= 0.5) {
             advice = "✅ EXCELLENT MATCH: Your skills and this price point are well-aligned. High chance of success. Go for it!";
          } else {
             advice = "ℹ️ NEUTRAL: This job is safe for gaining more experience points.";
          }
          setAiAdvice(advice);
          setIsAnalyzing(false);
      }, 1500);
  }

  // --- SMART CONTRACT ACTIONS ---
  const acceptJob = () => {
      if (!selectedJob) return;
      setLoading(true);
      const toastId = toast.loading("Confirming on blockchain...");
      const tx = new Transaction();
      tx.moveCall({ target: `${PACKAGE_ID}::${MODULE_JOB}::accept_job`, arguments: [tx.object(selectedJob.sui_id)] });
      
      signAndExecute({ transaction: tx } as any, {
          onSuccess: async (txRes: any) => {
              await client.waitForTransaction({ digest: txRes.digest });
              await updateJobOnCloud(selectedJob.sui_id, { 
                  status: "Accepted", 
                  freelancer: account?.address,
                  freelancer_score: totalScore,
                  freelancer_tier: tier.label,
                  freelancer_tier_color: tier.color 
              });
              setLoading(false); setSelectedJob(null); toast.success("Job accepted successfully!", { id: toastId });
          },
          onError: (e) => { setLoading(false); toast.error(e.message, { id: toastId }); }
      });
  }

  const submitWork = () => {
      if(!selectedJob || !proof || !key) return toast.error("Please fill in all fields!");
      setLoading(true);
      const toastId = toast.loading("Submitting deliverable...");
      const tx = new Transaction();
      const proofBytes = new TextEncoder().encode(proof);
      const keyBytes = new TextEncoder().encode(key);
      tx.moveCall({ target: `${PACKAGE_ID}::${MODULE_SUBMIT}::submit_work`, arguments: [tx.object(selectedJob.sui_id), tx.pure.vector("u8", proofBytes), tx.pure.vector("u8", keyBytes)] });
      signAndExecute({ transaction: tx } as any, {
          onSuccess: async (txRes: any) => {
              await client.waitForTransaction({ digest: txRes.digest });
              await updateJobOnCloud(selectedJob.sui_id, { status: "Submitted", proof, key });
              setLoading(false); setSelectedJob(null); setProof(""); setKey(""); toast.success("Work submitted!", { id: toastId });
          },
          onError: (e) => { setLoading(false); toast.error(e.message, { id: toastId }); }
      });
  }

  const renderSkillBadge = (rep: any) => {
      const isGold = Number(rep.job_price) >= 1;
      const bgColor = isGold ? 'linear-gradient(135deg, #fcd34d, #fbbf24)' : 'linear-gradient(135deg, #e2e8f0, #cbd5e1)';
      const borderColor = isGold ? '#b45309' : '#64748b';
      return (
        <div key={rep.id} style={{...skillCardStyle, background: bgColor, border: `2px solid ${borderColor}`, marginBottom: 12}}>
            <div style={{fontSize: 10, fontWeight:'bold', color: borderColor}}>{isGold ? "🏆 GOLD SKILL NFT" : "🛡️ SILVER SKILL NFT"}</div>
            <div style={{fontWeight:'bold', fontSize: 14, margin: '5px 0'}}>{rep.job_title}</div>
            <div style={{fontSize: 12}}>Rating: {rep.rating} ⭐</div>
        </div>
      );
  }

  return (
    <div style={{maxWidth: 1200, margin: '20px auto', fontFamily: 'sans-serif', display: 'flex', gap: 40}}>
        {/* MARKETPLACE */}
        <div style={{flex: 7}}>
            <h2 style={{color: '#059669', borderBottom:'3px solid #059669', paddingBottom:10}}>👨‍💻 Job Market</h2>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap: 20}}>
                {jobs.map(job => (
                    <div key={job.id} style={cardStyle}>
                        <div style={{display:'flex', justifyContent:'space-between', marginBottom:10}}>
                            <strong style={{fontSize:16}}>{job.title}</strong>
                            <span style={{color:'#059669', fontWeight:'bold'}}>{job.price} SUI</span>
                        </div>
                        <div style={{fontSize:12, color:'#64748b', marginBottom: 15}}>Status: <b>{job.status}</b></div>
                        <div style={{borderTop: '1px solid #f1f5f9', paddingTop: 10}}>
                            
                            {/* 🔥 NEW BUTTON: AI CHECK BEFORE ACCEPTING */}
                            {job.status === "Funded" && (
                                <button onClick={() => openAIAnalysis(job)} disabled={loading} style={{...acceptBtn, background: 'linear-gradient(90deg, #2563eb, #06b6d4)'}}>
                                    ✨ AI Check & Accept
                                </button>
                            )}
                            
                            {(job.status === "Accepted" || job.status === "Rejected") && <button onClick={() => openSubmitModal(job)} disabled={loading} style={submitBtn}>📤 Submit Work</button>}
                            {job.status === "Submitted" && <div style={{textAlign:'center', color:'#d97706', fontSize:13}}>⏳ Waiting for approval...</div>}
                            {job.status === "Completed" && <div style={{textAlign:'center', color:'#16a34a', fontWeight:'bold'}}>✅ Payment Received</div>}
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* ORACLE PROFILE */}
        <div style={{flex: 3}}>
            <h2 style={{color: '#d97706', borderBottom:'3px solid #d97706', paddingBottom:10}}>📊 Reputation Profile</h2>
            <div style={{...scoreCardStyle, borderTop: `8px solid ${tier.color}`}}>
                <div style={{fontSize: 12, color: '#92400e', fontWeight: 'bold'}}>TRUST SCORE (ORACLE)</div>
                <div style={{fontSize: 54, fontWeight: 'bold', margin: '5px 0', color: tier.color}}>{totalScore}</div>
                <div style={{background: tier.color, color: 'white', padding: '4px 12px', borderRadius: 20, display: 'inline-block', fontWeight: 'bold', fontSize: 13, marginBottom: 10}}>{tier.label}</div>
            </div>
            <h3 style={{fontSize: 16, marginTop: 30, color: '#475569'}}>🎨 Skill NFTs</h3>
            <div style={{maxHeight: '500px', overflowY: 'auto', paddingRight: '5px'}}>
                {reputations.map(rep => renderSkillBadge(rep))}
            </div>
        </div>

        {/* MULTI-PURPOSE MODAL (AI CHECK or SUBMISSION) */}
        {selectedJob && (
            <div style={modalOverlay}>
                <div style={modalContent}>
                    
                    {/* CASE 1: AI CHECK (UPON ACCEPTANCE) */}
                    {modalType === 'analyze' && (
                        <>
                            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                <h3 style={{marginTop:0, color:'#0284c7'}}>🤖 AI Risk Analysis</h3>
                                <div style={{fontSize:12, background:'#f3f4f6', padding:'4px 8px', borderRadius:4}}>{selectedJob.price} SUI</div>
                            </div>
                            
                            <div style={{background: '#f0f9ff', padding: 20, borderRadius: 12, border: '1px solid #bae6fd', minHeight: 100, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', textAlign:'center'}}>
                                {isAnalyzing ? (
                                    <div style={{color:'#0284c7', fontStyle:'italic'}}>🔄 Scanning On-chain profile & analyzing job...</div>
                                ) : (
                                    <div style={{fontSize: 15, lineHeight: 1.5, color: '#334155', fontWeight: 'bold'}}>
                                        {aiAdvice}
                                    </div>
                                )}
                            </div>

                            <div style={{display:'flex', gap:10, marginTop:25}}>
                                {/* Accept button only active after analysis */}
                                <button onClick={acceptJob} disabled={loading || isAnalyzing} style={{...acceptBtn, opacity: isAnalyzing ? 0.5 : 1}}>
                                    🤝 Confirm Accept Job
                                </button>
                                <button onClick={()=>setSelectedJob(null)} style={{...submitBtn, background:'#94a3b8'}}>Reconsider</button>
                            </div>
                        </>
                    )}

                    {/* CASE 2: WORK SUBMISSION */}
                    {modalType === 'submit' && (
                        <>
                            <h3 style={{marginTop:0}}>📤 Submit Deliverable</h3>
                            <div style={{fontSize:12, marginBottom:15, color:'#64748b'}}>Job: {selectedJob.title}</div>
                            <input style={inputStyle} value={proof} onChange={e => setProof(e.target.value)} placeholder="Product Link (GitHub/Drive)..." />
                            <input style={inputStyle} value={key} onChange={e => setKey(e.target.value)} placeholder="Secret Key (Password)..." />
                            <div style={{display:'flex', gap:10, marginTop:20}}>
                                <button onClick={submitWork} disabled={loading} style={submitBtn}>Submit</button>
                                <button onClick={()=>setSelectedJob(null)} style={{...submitBtn, background:'#ccc'}}>Cancel</button>
                            </div>
                        </>
                    )}
                    
                </div>
            </div>
        )}
    </div>
  )
}

// STYLES
const scoreCardStyle: any = { background: '#fffbeb', padding: 25, borderRadius: 20, border: '1px solid #fde68a', textAlign: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', transition: 'all 0.5s' };
const skillCardStyle: any = { padding: 15, borderRadius: 12, boxShadow: '0 4px 10px rgba(0,0,0,0.08)' };
const cardStyle: any = { padding: 20, border: '1px solid #e2e8f0', borderRadius: 16, background: 'white' };
const btnStyle: any = { padding: '12px', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold', width:'100%' };
const acceptBtn: any = { ...btnStyle, background: '#059669' };
const submitBtn: any = { ...btnStyle, background: '#2563eb' };
const inputStyle: any = { width: '100%', padding: 12, marginBottom: 15, border: '1px solid #e2e8f0', borderRadius: 8 };
const modalOverlay: any = { position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', justifyContent:'center', alignItems:'center', zIndex: 1000, backdropFilter: 'blur(4px)' };
const modalContent: any = { background:'white', padding: 30, borderRadius: 20, width: 450, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' };