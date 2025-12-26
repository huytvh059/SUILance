import { useState, useEffect } from "react";
import { useSignAndExecuteTransaction, useSuiClient, useCurrentAccount } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { PACKAGE_ID, MODULE_JOB, MODULE_ESCROW, API_URL } from "./constants";
import toast from 'react-hot-toast';

export default function ClientDashboard() {
  const client = useSuiClient();
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Post Job Modal
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("0.1");

  // Review Modal
  const [showReviewModal, setShowReviewModal] = useState<any>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const [rejectMenuOpen, setRejectMenuOpen] = useState<string | null>(null);

  // Screen resize observer
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- 1. DATA LOADING ---
  const fetchJobs = async () => {
    try {
        const res = await fetch(`${API_URL}/jobs`);
        const data = await res.json();
        const myJobs = data.filter((j: any) => j.creator === account?.address);
        setJobs(myJobs.sort((a: any, b: any) => b.createdAt - a.createdAt));
    } catch (error) { console.error("Data loading error:", error); }
  };

  useEffect(() => {
    if(account) { fetchJobs(); const i = setInterval(fetchJobs, 3000); return () => clearInterval(i); }
  }, [account]);

  const updateJobOnCloud = async (jobSuiId: string, updateData: any) => {
      const job = jobs.find(j => j.sui_id === jobSuiId);
      if (!job) return;
      await fetch(`${API_URL}/jobs/${job.id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(updateData) });
      fetchJobs();
  };

  const findId = (res: any) => {
      if (!res) return null;
      if (res.objectChanges) {
          const createdList = res.objectChanges.filter((o: any) => o.type === 'created');
          const escrowObj = createdList.find((o: any) => !o.objectType.includes('::coin::Coin'));
          if (escrowObj) return escrowObj.objectId;
          if (createdList.length > 0) return createdList[0].objectId;
      }
      return null;
  };

  // --- 2. FUNCTIONALITIES ---
  const createJob = () => {
      if(!title || !description) return toast.error("Please enter both title and description!");
      setLoading(true);
      const tx = new Transaction();
      const mist = BigInt(parseFloat(price) * 1_000_000_000);
      tx.moveCall({ target: `${PACKAGE_ID}::${MODULE_JOB}::create_job`, arguments: [tx.pure.u64(mist)] });
      const toastId = toast.loading("Creating job...");

      signAndExecute({ transaction: tx } as any, {
          onSuccess: async (txRes: any) => {
              try {
                  const res = await client.waitForTransaction({ digest: txRes.digest, options: { showEffects: true, showObjectChanges: true } });
                  const id = findId(res);
                  if(id) {
                      const newJob = { 
                          sui_id: id, 
                          title, 
                          description,
                          price, 
                          status: "Posted", 
                          createdAt: Date.now(), 
                          creator: account?.address 
                      };
                      await fetch(`${API_URL}/jobs`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(newJob) });
                      fetchJobs(); setShowModal(false); setTitle(""); setDescription(""); toast.success("Job posted!", { id: toastId });
                  }
              } catch (e) { console.error(e); } finally { setLoading(false); }
          },
          onError: (e) => { setLoading(false); toast.error(e.message, { id: toastId }); }
      });
  }

  const fundJob = (job: any) => {
      setLoading(true);
      const toastId = toast.loading("Funding escrow...");
      try {
        const tx = new Transaction();
        const mist = BigInt(parseFloat(job.price) * 1_000_000_000);
        const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(mist)]);
        tx.moveCall({ target: `${PACKAGE_ID}::${MODULE_ESCROW}::create_escrow`, arguments: [tx.object(job.sui_id), coin] });

        signAndExecute({ transaction: tx } as any, {
            onSuccess: async (txRes: any) => {
                try {
                    const res = await client.waitForTransaction({ digest: txRes.digest, options: { showEffects: true, showObjectChanges: true } });
                    let escrowId = findId(res);
                    if(escrowId) {
                        await updateJobOnCloud(job.sui_id, { status: "Funded", escrowId });
                        toast.success("Job funded successfully!", { id: toastId });
                    }
                } catch(e) { console.error(e); } finally { setLoading(false); }
            },
            onError: (e) => { setLoading(false); toast.error(e.message, { id: toastId }); }
        });
      } catch(err: any) { setLoading(false); toast.error(err.message, { id: toastId }); }
  }

  const confirmApproveAndRate = () => {
      if(!showReviewModal) return;
      const job = showReviewModal;
      setLoading(true);
      const toastId = toast.loading("Releasing funds & Issuing certificate...");
      const tx = new Transaction();
      tx.moveCall({ target: `${PACKAGE_ID}::${MODULE_ESCROW}::release_funds`, arguments: [tx.object(job.escrowId), tx.object(job.sui_id)] });
      
      signAndExecute({ transaction: tx } as any, {
          onSuccess: async (txRes: any) => {
              await client.waitForTransaction({ digest: txRes.digest });
              await updateJobOnCloud(job.sui_id, { status: "Completed" });
              const badge = {
                  freelancer_wallet: job.freelancer || "UNKNOWN", 
                  client_wallet: account?.address,
                  job_title: job.title,
                  job_price: job.price,
                  rating: rating,
                  comment: comment,
                  issued_at: Date.now()
              };
              await fetch(`${API_URL}/reputations`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(badge) });
              setLoading(false); setShowReviewModal(null); setRating(5); setComment("");
              toast.success("Transaction completed!", { id: toastId });
          },
          onError: (e) => { setLoading(false); toast.error(e.message, { id: toastId }); }
      });
  }

  const requestRevision = async (job: any) => {
      if(!confirm("Request a revision for this work?")) return;
      await updateJobOnCloud(job.sui_id, { status: "Rejected" });
      setRejectMenuOpen(null);
      toast("Revision request sent", { icon: '🔄' });
  }

  const refundJob = (job: any) => {
    if(!confirm("Cancel job and refund funds to your wallet?")) return;
    setLoading(true);
    const toastId = toast.loading("Refunding...");
    const tx = new Transaction();
    tx.moveCall({ target: `${PACKAGE_ID}::${MODULE_ESCROW}::refund`, arguments: [tx.object(job.escrowId)] });
    
    signAndExecute({ transaction: tx } as any, {
        onSuccess: async (txRes: any) => {
            await client.waitForTransaction({ digest: txRes.digest });
            await updateJobOnCloud(job.sui_id, { status: "Refunded" });
            setLoading(false); setRejectMenuOpen(null);
            toast.success("Funds refunded!", { id: toastId });
        },
        onError: (e) => { setLoading(false); toast.error(e.message, { id: toastId }); }
    });
  }

  // Status Badge Helper
  const renderStatus = (status: string) => {
    const styles: any = {
        Posted: { bg: '#f1f5f9', color: '#475569' },
        Funded: { bg: '#e0f2fe', color: '#0369a1' },
        Accepted: { bg: '#fef3c7', color: '#92400e' },
        Submitted: { bg: '#dcfce7', color: '#166534' },
        Completed: { bg: '#dcfce7', color: '#15803d' },
        Rejected: { bg: '#fee2e2', color: '#991b1b' },
        Refunded: { bg: '#f1f5f9', color: '#94a3b8' },
    };
    const style = styles[status] || styles.Posted;
    return <span style={{...badgeStyle, backgroundColor: style.bg, color: style.color}}>{status}</span>
  }

  return (
    <div style={{maxWidth: 900, margin: '0 auto', paddingBottom: 100}}>
        {/* HEADER */}
        <div style={{display:'flex', justifyContent:'space-between', marginBottom: 30, alignItems:'center', flexWrap: 'wrap', gap: 15}}>
            <div>
                <h2 style={{color: '#0f172a', margin: 0, fontSize: isMobile ? '20px' : '26px'}}>💼 Manage My Jobs</h2>
                <div style={{fontSize: 13, color: '#64748b', marginTop: 4}}>Wallet: {account?.address?.slice(0,10)}...</div>
            </div>
            <button onClick={() => setShowModal(true)} style={primaryBtn}>+ Post New Job</button>
        </div>

        {/* LIST JOBS */}
        {jobs.length === 0 ? (
            <div style={{textAlign:'center', padding: '50px 0', color:'#94a3b8'}}>You haven't posted any jobs yet. Create your first job!</div>
        ) : (
            jobs.map(job => (
                <div key={job.id} style={cardStyle}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom: 15}}>
                        <div>
                            <div style={{marginBottom: 8}}>{renderStatus(job.status)}</div>
                            <h3 style={{margin: 0, fontSize: '18px', color: '#1e293b'}}>{job.title}</h3>
                        </div>
                        <div style={{textAlign: 'right'}}>
                            <div style={{fontSize: '20px', fontWeight: '800', color: '#2563eb'}}>{job.price} SUI</div>
                            <div style={{fontSize: '11px', color: '#94a3b8'}}>Budget</div>
                        </div>
                    </div>
                    
                    <div style={descBox}>
                        {job.description || "No detailed description provided."}
                    </div>

                    {/* SUBMISSION RESULTS */}
                    {(job.status === "Submitted" || job.status === "Completed") && (
                        <div style={resultBox}>
                            <div style={{fontWeight: 'bold', fontSize: 13, marginBottom: 10, color: '#475569'}}>🚀 Final Deliverable:</div>
                            <div style={{display:'flex', alignItems: 'center', gap: 10, marginBottom: 8}}>
                                <span style={{fontSize: 16}}>🔗</span>
                                <a href={job.proof} target="_blank" style={{color:'#2563eb', fontSize: 13, textDecoration: 'none', wordBreak: 'break-all'}}>{job.proof}</a>
                            </div>
                            <div style={{display:'flex', alignItems:'center', gap: 10, background: '#fff', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0'}}>
                                <span>🔑</span>
                                {job.status === "Completed" ? 
                                    <strong style={{color:'#16a34a', fontSize: 14}}>{job.key}</strong> : 
                                    <span style={{color:'#94a3b8', fontSize: 13, fontStyle:'italic'}}>Locked (Approve to view)</span>
                                }
                            </div>
                        </div>
                    )}

                    {/* CLIENT ACTIONS */}
                    <div style={{marginTop: 20, display:'flex', gap: 10, flexWrap: 'wrap'}}>
                        {job.status === "Posted" && <button onClick={() => fundJob(job)} disabled={loading} style={fundBtn}>🔒 Deposit Funds (Escrow)</button>}
                        
                        {job.status === "Funded" && (
                            <div style={{width: '100%', display:'flex', gap: 10, flexDirection: isMobile ? 'column' : 'row'}}>
                                <div style={waitingMsg}>⏳ Waiting for freelancer to accept...</div>
                                <button onClick={() => refundJob(job)} disabled={loading} style={dangerOutlineBtn}>⛔ Cancel Job & Refund</button>
                            </div>
                        )}

                        {job.status === "Accepted" && (
                             <div style={waitingMsg}>⚙️ Freelancer is working on the project...</div>
                        )}
                        
                        {job.status === "Submitted" && (
                            <div style={{display:'flex', gap: 10, width: '100%', flexDirection: isMobile ? 'column' : 'row'}}>
                                <button onClick={() => setShowReviewModal(job)} disabled={loading} style={successBtn}>✅ Approve & Pay</button>
                                {!rejectMenuOpen ? (
                                    <button onClick={() => setRejectMenuOpen(job.id)} style={dangerOutlineBtn}>❌ Decline...</button>
                                ) : rejectMenuOpen === job.id && (
                                    <div style={{display:'flex', gap:10, flex: 1}}>
                                        <button onClick={() => requestRevision(job)} style={warningBtn}>🔄 Request Revision</button>
                                        <button onClick={() => refundJob(job)} disabled={loading} style={dangerBtn}>⛔ Cancel & Refund</button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            ))
        )}

        {/* POST JOB MODAL */}
        {showModal && (
            <div style={modalOverlay}>
                <div style={{...modalContent, width: isMobile ? '90%' : '450px'}}>
                    <h3 style={{marginTop: 0, fontSize: 20}}>📝 Post New Job</h3>
                    
                    <div style={inputGroup}>
                        <label style={labelStyle}>Job Title</label>
                        <input style={inputStyle} placeholder="e.g., Write Smart Contract..." value={title} onChange={e=>setTitle(e.target.value)} />
                    </div>

                    <div style={inputGroup}>
                        <label style={labelStyle}>Budget (SUI)</label>
                        <input style={inputStyle} type="number" placeholder="0.1" value={price} onChange={e=>setPrice(e.target.value)} />
                    </div>
                    
                    <div style={inputGroup}>
                        <label style={labelStyle}>Detailed Description</label>
                        <textarea 
                            style={{...inputStyle, height: '120px', resize: 'none'}} 
                            placeholder="- Specific requirements...&#10;- Expected deadline..."
                            value={description} 
                            onChange={e=>setDescription(e.target.value)} 
                        />
                    </div>

                    <div style={{display:'flex', gap: 12, marginTop: 25}}>
                        <button onClick={createJob} disabled={loading} style={primaryBtn}>Post Job</button>
                        <button onClick={()=>setShowModal(false)} style={secondaryBtn}>Cancel</button>
                    </div>
                </div>
            </div>
        )}

        {/* REVIEW MODAL */}
        {showReviewModal && (
            <div style={modalOverlay}>
                <div style={{...modalContent, width: isMobile ? '90%' : '400px'}}>
                    <h3 style={{marginTop: 0, color:'#10b981'}}>🌟 Approve Work</h3>
                    <p style={{fontSize:14, color:'#64748b'}}>You are confirming the payment of {showReviewModal.price} SUI to the freelancer.</p>
                    
                    <div style={{margin:'20px 0'}}>
                        <label style={labelStyle}>Rate the talent:</label>
                        <div style={{display:'flex', gap:12, marginTop: 10}}>
                            {[1,2,3,4,5].map(star => (
                                <span key={star} onClick={() => setRating(star)} style={{cursor:'pointer', fontSize:28, filter: star <= rating ? 'none' : 'grayscale(100%)'}}>⭐</span>
                            ))}
                        </div>
                    </div>

                    <div style={inputGroup}>
                        <label style={labelStyle}>Quality Review:</label>
                        <textarea style={{...inputStyle, height:80}} placeholder="Freelancer was very professional..." value={comment} onChange={e=>setComment(e.target.value)} />
                    </div>

                    <div style={{display:'flex', gap: 12, marginTop: 25}}>
                        <button onClick={confirmApproveAndRate} disabled={loading} style={successBtn}>✅ Pay & Complete</button>
                        <button onClick={()=>setShowReviewModal(null)} style={secondaryBtn}>Later</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  )
}

// --- STYLES SYSTEM (REMAIN UNCHANGED) ---
const primaryBtn: any = { padding: '12px 24px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: '700', fontSize: '14px', flex: 1 };
const secondaryBtn: any = { ...primaryBtn, background: '#f1f5f9', color: '#475569' };
const successBtn: any = { ...primaryBtn, background: '#10b981' };
const warningBtn: any = { ...primaryBtn, background: '#f59e0b' };
const dangerBtn: any = { ...primaryBtn, background: '#ef4444' };
const dangerOutlineBtn: any = { ...primaryBtn, background: 'transparent', color: '#ef4444', border: '1px solid #ef4444' };
const fundBtn: any = { ...primaryBtn, background: '#0f172a' };

const cardStyle: any = { padding: '24px', border: '1px solid #f1f5f9', borderRadius: 16, marginBottom: 20, background: 'white', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' };
const badgeStyle: any = { padding: '4px 10px', borderRadius: 6, fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' };
const descBox: any = { fontSize: '14px', color: '#475569', margin: '15px 0', lineHeight: '1.6', whiteSpace: 'pre-line', padding: '12px', background: '#f8fafc', borderRadius: 10 };
const resultBox: any = { background: '#f0fdf4', padding: 15, borderRadius: 12, border: '1px solid #bbf7d0', marginTop: 15 };
const waitingMsg: any = { flex: 1, display: 'flex', alignItems: 'center', fontSize: '13px', color: '#64748b', fontStyle: 'italic' };

const inputStyle: any = { width: '100%', padding: '12px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: '14px', outline: 'none', transition: 'border 0.2s' };
const labelStyle: any = { display: 'block', marginBottom: 8, fontSize: '13px', fontWeight: '600', color: '#1e293b' };
const inputGroup: any = { marginBottom: 15 };

const modalOverlay: any = { position:'fixed', inset:0, background:'rgba(15, 23, 42, 0.6)', display:'flex', justifyContent:'center', alignItems:'center', zIndex: 1000, backdropFilter: 'blur(4px)' };
const modalContent: any = { background:'white', padding: 30, borderRadius: 20, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' };