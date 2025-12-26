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

  // Modal Đăng tin
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("0.1");

  // Modal Đánh giá
  const [showReviewModal, setShowReviewModal] = useState<any>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const [rejectMenuOpen, setRejectMenuOpen] = useState<string | null>(null);

  // Theo dõi kích thước màn hình
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- 1. TẢI DATA (GIỮ NGUYÊN LOGIC) ---
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

  // --- 2. CÁC HÀM CHỨC NĂNG (GIỮ NGUYÊN LOGIC) ---
  const createJob = () => {
      if(!title || !description) return toast.error("Vui lòng nhập tiêu đề và mô tả!");
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
                          description,
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
      const toastId = toast.loading("Đang trả tiền & Cấp chứng nhận...");
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
              toast.success("Đã hoàn tất!", { id: toastId });
          },
          onError: (e) => { setLoading(false); toast.error(e.message, { id: toastId }); }
      });
  }

  const requestRevision = async (job: any) => {
      if(!confirm("Yêu cầu sửa bài?")) return;
      await updateJobOnCloud(job.sui_id, { status: "Rejected" });
      setRejectMenuOpen(null);
      toast("Đã gửi yêu cầu", { icon: '🔄' });
  }

  const refundJob = (job: any) => {
    if(!confirm("Hủy và rút tiền về ví?")) return;
    setLoading(true);
    const toastId = toast.loading("Đang rút tiền...");
    const tx = new Transaction();
    tx.moveCall({ target: `${PACKAGE_ID}::${MODULE_ESCROW}::refund`, arguments: [tx.object(job.escrowId)] });
    
    signAndExecute({ transaction: tx } as any, {
        onSuccess: async (txRes: any) => {
            await client.waitForTransaction({ digest: txRes.digest });
            await updateJobOnCloud(job.sui_id, { status: "Refunded" });
            setLoading(false); setRejectMenuOpen(null);
            toast.success("Đã nhận lại tiền!", { id: toastId });
        },
        onError: (e) => { setLoading(false); toast.error(e.message, { id: toastId }); }
    });
  }

  // Helper render Badge trạng thái
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
                <h2 style={{color: '#0f172a', margin: 0, fontSize: isMobile ? '20px' : '26px'}}>💼 Quản lý Job của tôi</h2>
                <div style={{fontSize: 13, color: '#64748b', marginTop: 4}}>Ví: {account?.address?.slice(0,10)}...</div>
            </div>
            <button onClick={() => setShowModal(true)} style={primaryBtn}>+ Đăng Job Mới</button>
        </div>

        {/* LIST JOBS */}
        {jobs.length === 0 ? (
            <div style={{textAlign:'center', padding: '50px 0', color:'#94a3b8'}}>Bro chưa có Job nào. Hãy tạo Job đầu tiên!</div>
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
                            <div style={{fontSize: '11px', color: '#94a3b8'}}>Giá ngân sách</div>
                        </div>
                    </div>
                    
                    <div style={descBox}>
                        {job.description || "Không có mô tả chi tiết."}
                    </div>

                    {/* HIỂN THỊ KẾT QUẢ NỘP BÀI */}
                    {(job.status === "Submitted" || job.status === "Completed") && (
                        <div style={resultBox}>
                            <div style={{fontWeight: 'bold', fontSize: 13, marginBottom: 10, color: '#475569'}}>🚀 Sản phẩm hoàn thành:</div>
                            <div style={{display:'flex', alignItems: 'center', gap: 10, marginBottom: 8}}>
                                <span style={{fontSize: 16}}>🔗</span>
                                <a href={job.proof} target="_blank" style={{color:'#2563eb', fontSize: 13, textDecoration: 'none', wordBreak: 'break-all'}}>{job.proof}</a>
                            </div>
                            <div style={{display:'flex', alignItems:'center', gap: 10, background: '#fff', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0'}}>
                                <span>🔑</span>
                                {job.status === "Completed" ? 
                                    <strong style={{color:'#16a34a', fontSize: 14}}>{job.key}</strong> : 
                                    <span style={{color:'#94a3b8', fontSize: 13, fontStyle:'italic'}}>Bị khóa (Duyệt để xem)</span>
                                }
                            </div>
                        </div>
                    )}

                    {/* ACTIONS CỦA CLIENT */}
                    <div style={{marginTop: 20, display:'flex', gap: 10, flexWrap: 'wrap'}}>
                        {job.status === "Posted" && <button onClick={() => fundJob(job)} disabled={loading} style={fundBtn}>🔒 Nạp tiền (Escrow)</button>}
                        
                        {job.status === "Funded" && (
                            <div style={{width: '100%', display:'flex', gap: 10, flexDirection: isMobile ? 'column' : 'row'}}>
                                <div style={waitingMsg}>⏳ Đang chờ Freelancer nhận việc...</div>
                                <button onClick={() => refundJob(job)} disabled={loading} style={dangerOutlineBtn}>⛔ Thu hồi Job & Rút tiền</button>
                            </div>
                        )}

                        {job.status === "Accepted" && (
                             <div style={waitingMsg}>⚙️ Freelancer đang thực hiện công việc...</div>
                        )}
                        
                        {job.status === "Submitted" && (
                            <div style={{display:'flex', gap: 10, width: '100%', flexDirection: isMobile ? 'column' : 'row'}}>
                                <button onClick={() => setShowReviewModal(job)} disabled={loading} style={successBtn}>✅ Duyệt & Trả tiền</button>
                                {!rejectMenuOpen ? (
                                    <button onClick={() => setRejectMenuOpen(job.id)} style={dangerOutlineBtn}>❌ Không duyệt...</button>
                                ) : rejectMenuOpen === job.id && (
                                    <div style={{display:'flex', gap:10, flex: 1}}>
                                        <button onClick={() => requestRevision(job)} style={warningBtn}>🔄 Yêu cầu sửa</button>
                                        <button onClick={() => refundJob(job)} disabled={loading} style={dangerBtn}>⛔ Hủy & Hoàn tiền</button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            ))
        )}

        {/* MODAL ĐĂNG TIN */}
        {showModal && (
            <div style={modalOverlay}>
                <div style={{...modalContent, width: isMobile ? '90%' : '450px'}}>
                    <h3 style={{marginTop: 0, fontSize: 20}}>📝 Đăng Job Mới</h3>
                    
                    <div style={inputGroup}>
                        <label style={labelStyle}>Tiêu đề công việc</label>
                        <input style={inputStyle} placeholder="VD: Viết Smart Contract..." value={title} onChange={e=>setTitle(e.target.value)} />
                    </div>

                    <div style={inputGroup}>
                        <label style={labelStyle}>Ngân sách (SUI)</label>
                        <input style={inputStyle} type="number" placeholder="0.1" value={price} onChange={e=>setPrice(e.target.value)} />
                    </div>
                    
                    <div style={inputGroup}>
                        <label style={labelStyle}>Mô tả chi tiết</label>
                        <textarea 
                            style={{...inputStyle, height: '120px', resize: 'none'}} 
                            placeholder="- Yêu cầu cụ thể...&#10;- Thời gian hoàn thành..."
                            value={description} 
                            onChange={e=>setDescription(e.target.value)} 
                        />
                    </div>

                    <div style={{display:'flex', gap: 12, marginTop: 25}}>
                        <button onClick={createJob} disabled={loading} style={primaryBtn}>Đăng Job</button>
                        <button onClick={()=>setShowModal(false)} style={secondaryBtn}>Hủy</button>
                    </div>
                </div>
            </div>
        )}

        {/* MODAL ĐÁNH GIÁ */}
        {showReviewModal && (
            <div style={modalOverlay}>
                <div style={{...modalContent, width: isMobile ? '90%' : '400px'}}>
                    <h3 style={{marginTop: 0, color:'#10b981'}}>🌟 Duyệt sản phẩm</h3>
                    <p style={{fontSize:14, color:'#64748b'}}>Bạn đang xác nhận trả {showReviewModal.price} SUI cho Freelancer.</p>
                    
                    <div style={{margin:'20px 0'}}>
                        <label style={labelStyle}>Chấm điểm tài năng:</label>
                        <div style={{display:'flex', gap:12, marginTop: 10}}>
                            {[1,2,3,4,5].map(star => (
                                <span key={star} onClick={() => setRating(star)} style={{cursor:'pointer', fontSize:28, filter: star <= rating ? 'none' : 'grayscale(100%)'}}>⭐</span>
                            ))}
                        </div>
                    </div>

                    <div style={inputGroup}>
                        <label style={labelStyle}>Nhận xét về chất lượng:</label>
                        <textarea style={{...inputStyle, height:80}} placeholder="Freelancer làm việc rất chuyên nghiệp..." value={comment} onChange={e=>setComment(e.target.value)} />
                    </div>

                    <div style={{display:'flex', gap: 12, marginTop: 25}}>
                        <button onClick={confirmApproveAndRate} disabled={loading} style={successBtn}>✅ Trả tiền & Kết thúc</button>
                        <button onClick={()=>setShowReviewModal(null)} style={secondaryBtn}>Để sau</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  )
}

// --- STYLES SYSTEM ---
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