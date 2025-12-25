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
  
  // Modal Đăng tin
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState(""); // 🔥 THÊM BIẾN MÔ TẢ
  const [price, setPrice] = useState("0.1");

  // Modal Đánh giá
  const [showReviewModal, setShowReviewModal] = useState<any>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const [rejectMenuOpen, setRejectMenuOpen] = useState<string | null>(null);

  // --- 1. TẢI DATA ---
  const fetchJobs = async () => {
    try {
        const res = await fetch(`${API_URL}/jobs`);
        const data = await res.json();
        const myJobs = data.filter((j: any) => j.creator === account?.address);
        setJobs(myJobs.sort((a: any, b: any) => b.createdAt - a.createdAt));
    } catch (error) { console.error("Lỗi tải data:", error); }
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

  // --- 2. CÁC HÀM CHỨC NĂNG ---

  const createJob = () => {
      if(!title || !description) return toast.error("Vui lòng nhập tiêu đề và mô tả!"); // 🔥 CHECK THÊM MÔ TẢ
      setLoading(true);
      const tx = new Transaction();
      const mist = BigInt(parseFloat(price) * 1_000_000_000);
      tx.moveCall({ target: `${PACKAGE_ID}::${MODULE_JOB}::create_job`, arguments: [tx.pure.u64(mist)] });
      const toastId = toast.loading("Đang tạo Job...");

      signAndExecute({ transaction: tx } as any, {
          onSuccess: async (txRes: any) => {
              try {
                  const res = await client.waitForTransaction({ digest: txRes.digest, options: { showEffects: true, showObjectChanges: true } });
                  const id = findId(res);
                  if(id) {
                      const newJob = { 
                          sui_id: id, 
                          title, 
                          description, // 🔥 LƯU MÔ TẢ VÀO DATABASE
                          price, 
                          status: "Posted", 
                          createdAt: Date.now(), 
                          creator: account?.address 
                      };
                      await fetch(`${API_URL}/jobs`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(newJob) });
                      fetchJobs(); setShowModal(false); setTitle(""); setDescription(""); toast.success("Xong!", { id: toastId });
                  }
              } catch (e) { console.error(e); } finally { setLoading(false); }
          },
          onError: (e) => { setLoading(false); toast.error(e.message, { id: toastId }); }
      });
  }

  const fundJob = (job: any) => {
      setLoading(true);
      const toastId = toast.loading("Đang nạp tiền...");
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
                        toast.success("Đã Fund tiền!", { id: toastId });
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
      const toastId = toast.loading("Đang trả tiền & Cấp bằng chứng nhận...");
      
      const tx = new Transaction();
      tx.moveCall({ target: `${PACKAGE_ID}::${MODULE_ESCROW}::release_funds`, arguments: [tx.object(job.escrowId), tx.object(job.sui_id)] });
      
      signAndExecute({ transaction: tx } as any, {
          onSuccess: async (txRes: any) => {
              await client.waitForTransaction({ digest: txRes.digest });
              await updateJobOnCloud(job.sui_id, { status: "Completed" });

              const badge = {
                  freelancer_wallet: "UNKNOWN_FREELANCER", 
                  client_wallet: account?.address,
                  job_title: job.title,
                  job_price: job.price,
                  rating: rating,
                  comment: comment,
                  issued_at: Date.now()
              };
              await fetch(`${API_URL}/reputations`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(badge) });

              setLoading(false); setShowReviewModal(null); setRating(5); setComment("");
              toast.success("Đã trả tiền & Cấp huy hiệu uy tín!", { id: toastId });
          },
          onError: (e) => { setLoading(false); toast.error(e.message, { id: toastId }); }
      });
  }

  const requestRevision = async (job: any) => {
      if(!confirm("Yêu cầu sửa bài?")) return;
      await updateJobOnCloud(job.sui_id, { status: "Rejected" });
      setRejectMenuOpen(null);
      toast("Đã yêu cầu sửa", { icon: '⚠️' });
  }

  const refundJob = (job: any) => {
    if(!confirm("Hủy và hoàn tiền?")) return;
    setLoading(true);
    const toastId = toast.loading("Đang hoàn tiền...");
    const tx = new Transaction();
    tx.moveCall({ target: `${PACKAGE_ID}::${MODULE_ESCROW}::refund`, arguments: [tx.object(job.escrowId)] });
    
    signAndExecute({ transaction: tx } as any, {
        onSuccess: async (txRes: any) => {
            await client.waitForTransaction({ digest: txRes.digest });
            await updateJobOnCloud(job.sui_id, { status: "Refunded" });
            setLoading(false); setRejectMenuOpen(null);
            toast.success("Đã hoàn tiền!", { id: toastId });
        },
        onError: (e) => { setLoading(false); toast.error(e.message, { id: toastId }); }
    });
  }

  return (
    <div style={{maxWidth: 800, margin: '20px auto', fontFamily: 'sans-serif'}}>
        <div style={{display:'flex', justifyContent:'space-between', marginBottom: 20, alignItems:'center'}}>
            <div>
                <h2 style={{color: '#2563eb', margin: 0}}>👨‍💼 Client Dashboard</h2>
                <div style={{fontSize: 12, color: '#64748b', marginTop: 5}}>Ví: {account?.address}</div>
            </div>
            <button onClick={() => setShowModal(true)} style={btnStyle}>+ Đăng Tin</button>
        </div>

        {jobs.map(job => (
            <div key={job.id} style={cardStyle}>
                <div style={{display:'flex', justifyContent:'space-between'}}>
                    <strong>{job.title}</strong>
                    <span style={{color:'green', fontWeight:'bold'}}>{job.price} SUI</span>
                </div>
                
                {/* 🔥 HIỂN THỊ MÔ TẢ CÔNG VIỆC Ở ĐÂY */}
                <div style={{fontSize: 14, color: '#334155', margin: '10px 0', whiteSpace: 'pre-line', borderLeft: '3px solid #cbd5e1', paddingLeft: 10}}>
                    {job.description || "Không có mô tả chi tiết."}
                </div>

                <div style={{fontSize:12, color:'#666', margin: '5px 0'}}>Status: {job.status}</div>
                
                {(job.status === "Submitted" || job.status === "Completed") && (
                    <div style={{background: job.status === 'Completed' ? '#f0fdf4' : '#f8fafc', padding: 15, borderRadius: 8, margin: '15px 0', border: job.status === 'Completed' ? '1px solid #86efac' : '1px solid #e2e8f0'}}>
                        <div style={{marginBottom: 10, fontSize: 13}}>🔗 <a href={job.proof} target="_blank" style={{color:'#0284c7'}}>{job.proof}</a></div>
                        <div style={{display:'flex', alignItems:'center', gap: 10}}>
                            <span>🔑</span>
                            {job.status === "Completed" ? <div style={{color:'#16a34a', fontWeight:'bold'}}>{job.key}</div> : <div style={{color:'#64748b', fontSize: 12, fontStyle:'italic'}}>🔒 **********</div>}
                        </div>
                    </div>
                )}

                <div style={{marginTop: 15, borderTop: '1px solid #eee', paddingTop: 10}}>
                    {job.status === "Posted" && <button onClick={() => fundJob(job)} disabled={loading} style={actionBtn}>🔒 Fund Escrow</button>}
                    
                    {/* 🔥🔥🔥 ĐOẠN CODE BẠN CẦN Ở ĐÂY: THU HỒI JOB & RÚT TIỀN */}
                    {job.status === "Funded" && (
                        <div style={{display:'flex', flexDirection:'column', gap: 8}}>
                            <button disabled style={{...actionBtn, background:'#f8fafc', color:'#64748b', border: '1px dashed #cbd5e1', cursor: 'default'}}>
                                ⏳ Đang chờ Freelancer...
                            </button>
                            <button 
                                onClick={() => refundJob(job)} 
                                disabled={loading} 
                                style={{...actionBtn, background:'#fff', color:'#ef4444', border:'1px solid #ef4444', fontSize: 13}}
                            >
                                ⛔ Thu hồi Job & Rút tiền về
                            </button>
                        </div>
                    )}
                    
                    {job.status === "Submitted" && (
                        <div style={{display:'flex', gap: 10, flexDirection:'column'}}>
                            <button onClick={() => setShowReviewModal(job)} disabled={loading} style={{...actionBtn, background:'#10b981'}}>✅ Duyệt & Đánh giá</button>
                            {!rejectMenuOpen ? (
                                <button onClick={() => setRejectMenuOpen(job.id)} style={{...actionBtn, background:'#fff', color:'#ef4444', border:'1px solid #ef4444'}}>❌ Không duyệt...</button>
                            ) : rejectMenuOpen === job.id && (
                                <div style={{display:'flex', gap:5}}>
                                    <button onClick={() => requestRevision(job)} style={{...actionBtn, background:'#f59e0b', fontSize:13}}>🔄 Sửa lại</button>
                                    <button onClick={() => refundJob(job)} disabled={loading} style={{...actionBtn, background:'#ef4444', fontSize:13}}>⛔ Hủy luôn</button>
                                </div>
                            )}
                        </div>
                    )}
                    {job.status === "Completed" && <div style={{textAlign:'center', marginTop:10}}><span style={{color:'#ef4444', background: '#fee2e2', padding: '2px 10px', borderRadius: 10, fontSize: 12}}>💸 - {job.price} SUI</span></div>}
                    {job.status === "Refunded" && <div style={{color:'#ef4444', fontWeight:'bold', textAlign:'center'}}>⛔ Đã hủy.</div>}
                </div>
            </div>
        ))}

        {/* MODAL ĐĂNG TIN */}
        {showModal && (
            <div style={modalOverlay}>
                <div style={modalContent}>
                    <h3>📝 Đăng Job Mới</h3>
                    
                    <label style={{fontSize:12, fontWeight:'bold', display:'block', marginBottom:5}}>Tiêu đề:</label>
                    <input style={inputStyle} placeholder="VD: Thiết kế Logo..." value={title} onChange={e=>setTitle(e.target.value)} />

                    <label style={{fontSize:12, fontWeight:'bold', display:'block', marginBottom:5}}>Ngân sách (SUI):</label>
                    <input style={inputStyle} type="number" placeholder="0.1" value={price} onChange={e=>setPrice(e.target.value)} />
                    
                    {/* 🔥 Ô NHẬP MÔ TẢ (TEXTAREA) */}
                    <label style={{fontSize:12, fontWeight:'bold', display:'block', marginBottom:5, marginTop: 10}}>Mô tả chi tiết:</label>
                    <textarea 
                        style={{...inputStyle, height: '120px', resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.5'}} 
                        placeholder="- Yêu cầu...&#10;- Deadline..."
                        value={description} 
                        onChange={e=>setDescription(e.target.value)} 
                    />

                    <div style={{display:'flex', gap: 10, marginTop: 15}}>
                        <button onClick={createJob} disabled={loading} style={btnStyle}>Đăng Ngay</button>
                        <button onClick={()=>setShowModal(false)} style={{...btnStyle, background:'#fff', color:'#333', border:'1px solid #ccc'}}>Hủy</button>
                    </div>
                </div>
            </div>
        )}

        {/* MODAL ĐÁNH GIÁ */}
        {showReviewModal && (
            <div style={modalOverlay}>
                <div style={modalContent}>
                    <h3 style={{color:'#10b981'}}>🌟 Đánh giá Freelancer</h3>
                    <p style={{fontSize:13, color:'#666'}}>Công việc: {showReviewModal.title}</p>
                    
                    <div style={{margin:'20px 0'}}>
                        <label style={{fontWeight:'bold', display:'block', marginBottom:5}}>Chấm điểm (1-5 sao):</label>
                        <div style={{display:'flex', gap:10}}>
                            {[1,2,3,4,5].map(star => (
                                <span key={star} onClick={() => setRating(star)} style={{cursor:'pointer', fontSize:24, filter: star <= rating ? 'grayscale(0)' : 'grayscale(100%)'}}>⭐</span>
                            ))}
                        </div>
                    </div>

                    <div style={{marginBottom:20}}>
                        <label style={{fontWeight:'bold', display:'block', marginBottom:5}}>Nhận xét:</label>
                        <textarea style={{...inputStyle, height:80}} placeholder="Làm tốt lắm..." value={comment} onChange={e=>setComment(e.target.value)} />
                    </div>

                    <div style={{display:'flex', gap: 10}}>
                        <button onClick={confirmApproveAndRate} disabled={loading} style={{...btnStyle, background:'#10b981'}}>✅ Trả tiền & Cấp Badge</button>
                        <button onClick={()=>setShowReviewModal(null)} style={{...btnStyle, background:'#fff', color:'#333', border:'1px solid #ccc'}}>Để sau</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  )
}

const btnStyle: any = { padding: '10px 20px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold', width:'100%' };
const actionBtn: any = { ...btnStyle, fontSize: 14 };
const cardStyle: any = { padding: 20, border: '1px solid #e5e7eb', borderRadius: 12, marginBottom: 15, background: 'white', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' };
const inputStyle: any = { width: '100%', padding: 10, marginBottom: 10, boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: 6 };
const modalOverlay: any = { position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', justifyContent:'center', alignItems:'center', zIndex: 999 };
const modalContent: any = { background:'white', padding: 30, borderRadius: 12, width: 400 };