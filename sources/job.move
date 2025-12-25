module suifreelance::job {
    // --- CONSTANTS ---
    const STATUS_POSTED: u8 = 0;
    const STATUS_FUNDED: u8 = 1;
    const STATUS_ACCEPTED: u8 = 2;
    const STATUS_SUBMITTED: u8 = 3;
    const STATUS_COMPLETED: u8 = 4;

    // --- ERRORS ---
    const EJobNotFunded: u64 = 0;
    const EJobAlreadyAssigned: u64 = 1;

    public struct Job has key, store {
        id: UID,
        client: address,
        freelancer: address,
        price: u64,
        status: u8,
    }

    public fun create_job(price: u64, ctx: &mut TxContext) {
        let job = Job {
            id: object::new(ctx),
            client: ctx.sender(),
            freelancer: @0x0,
            price,
            status: STATUS_POSTED,
        };
        transfer::share_object(job);
    }

    public fun accept_job(job: &mut Job, ctx: &mut TxContext) {
        assert!(job.status == STATUS_FUNDED, EJobNotFunded);
        assert!(job.freelancer == @0x0, EJobAlreadyAssigned);

        job.freelancer = ctx.sender();
        job.status = STATUS_ACCEPTED;
    }

    // --- CÁC HÀM PACKAGE (QUAN TRỌNG: ĐỂ FIX LỖI VISIBILITY) ---
    
    // Hàm này cho phép escrow/submission mượn ID để gắn/tháo Key
    public(package) fun uid_mut(job: &mut Job): &mut UID {
        &mut job.id
    }

    public(package) fun set_status_funded(job: &mut Job) {
        job.status = STATUS_FUNDED;
    }

    public(package) fun set_status_submitted(job: &mut Job) {
        job.status = STATUS_SUBMITTED;
    }

    public(package) fun set_status_completed(job: &mut Job) {
        job.status = STATUS_COMPLETED;
    }

    // --- GETTERS ---
    public fun get_job_id(job: &Job): ID { object::uid_to_inner(&job.id) }
    public fun get_client(job: &Job): address { job.client }
    public fun get_freelancer(job: &Job): address { job.freelancer }
    public fun get_price(job: &Job): u64 { job.price }
    public fun get_status(job: &Job): u8 { job.status }
}