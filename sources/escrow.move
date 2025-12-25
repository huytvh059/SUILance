module suifreelance::escrow {
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::sui::SUI;
    use sui::dynamic_object_field as dof;
    
    // Đã xóa các dòng thừa (transfer, object, tx_context)
    // vì Sui tự động import rồi.

    use suifreelance::job::{Self, Job};
    use suifreelance::submission::SecretKeyBox;

    // --- CÁC MÃ LỖI (Error Codes) ---
    const EWrongClient: u64 = 0;
    const EInsufficientFunds: u64 = 1;
    const EAlreadyReleased: u64 = 2;
    const ENoKeyFound: u64 = 3;

    // --- STRUCT ESCROW (Két sắt giữ tiền) ---
    public struct Escrow has key {
        id: UID,
        job_id: ID,
        client: address,
        funds: Balance<SUI>, // Tiền được lưu dưới dạng Balance (an toàn hơn Coin)
        is_released: bool,   // Trạng thái: Đã trả/hoàn tiền hay chưa
    }

    // --- 1. CLIENT NẠP TIỀN (FUND) ---
    public fun create_escrow(
        job: &mut Job, 
        payment: Coin<SUI>, 
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        let job_price = job::get_price(job);

        // Kiểm tra 1: Người gọi phải là chủ Job
        assert!(sender == job::get_client(job), EWrongClient);
        // Kiểm tra 2: Số tiền nạp vào phải đủ trả cho Job
        assert!(coin::value(&payment) >= job_price, EInsufficientFunds);

        // Tạo object Escrow
        let escrow = Escrow {
            id: object::new(ctx),
            job_id: job::get_job_id(job),
            client: sender,
            funds: coin::into_balance(payment), // Chuyển Coin thành Balance để cất giữ
            is_released: false,
        };

        // Cập nhật trạng thái Job -> "Funded"
        job::set_status_funded(job);

        // Chia sẻ Escrow để mọi người cùng thấy (Shared Object)
        transfer::share_object(escrow);
    }

    // --- 2. CLIENT DUYỆT & TRẢ TIỀN (RELEASE - HAPPY CASE) ---
    // Đây là hàm Atomic Swap: Tiền về Freelancer VÀ Key về Client cùng lúc
    #[allow(lint(self_transfer))]
    public fun release_funds(
        escrow: &mut Escrow, 
        job: &mut Job, 
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);

        // Kiểm tra: Chỉ Client mới được quyền duyệt
        assert!(sender == escrow.client, EWrongClient);
        // Kiểm tra: Tiền chưa bị rút ra trước đó
        assert!(escrow.is_released == false, EAlreadyReleased);

        // BƯỚC A: TRẢ TIỀN CHO FREELANCER
        let amount = balance::value(&escrow.funds);
        let payment_coin = coin::take(&mut escrow.funds, amount, ctx);
        let freelancer_addr = job::get_freelancer(job);
        
        transfer::public_transfer(payment_coin, freelancer_addr);

        // BƯỚC B: LẤY KEY VỀ CHO CLIENT
        // Kiểm tra xem Freelancer đã nộp Key vào Job chưa
        assert!(dof::exists_(job::uid_mut(job), b"secret_key"), ENoKeyFound);
        
        // Lấy cái hộp Key ra khỏi Job
        let secret_box = dof::remove<vector<u8>, SecretKeyBox>(
            job::uid_mut(job), 
            b"secret_key"
        );
        
        // Chuyển quyền sở hữu hộp Key cho Client (sender)
        transfer::public_transfer(secret_box, sender);

        // BƯỚC C: CẬP NHẬT TRẠNG THÁI
        escrow.is_released = true;
        job::set_status_completed(job);
    }

    // --- 3. CLIENT TỪ CHỐI & HOÀN TIỀN (REFUND - REJECT CASE) ---
    public fun refund(
        escrow: &mut Escrow, 
        ctx: &mut TxContext
    ) {
        // Kiểm tra: Chỉ Client mới được đòi tiền về
        assert!(tx_context::sender(ctx) == escrow.client, EWrongClient);
        // Kiểm tra: Tiền chưa bị rút ra trước đó
        assert!(escrow.is_released == false, EAlreadyReleased);

        // Lấy toàn bộ tiền trong két ra
        let amount = balance::value(&escrow.funds);
        let refund_coin = coin::take(&mut escrow.funds, amount, ctx);
        
        // Chuyển ngược lại về ví Client
        transfer::public_transfer(refund_coin, escrow.client);

        // Đánh dấu đã giải ngân (để không rút được nữa)
        escrow.is_released = true;
        
        // Lưu ý: Ở đây ta không cần cập nhật Job thành Cancelled 
        // để đơn giản hóa logic, hoặc bạn có thể thêm hàm set_status_cancelled nếu muốn.
    }
}