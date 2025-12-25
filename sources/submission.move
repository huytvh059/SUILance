module suifreelance::submission {
    use std::string::{Self, String};
    use sui::event;
    use sui::dynamic_object_field as dof; 
    
    use suifreelance::job::{Self, Job};

    const ENotFreelancer: u64 = 0;

    public struct SecretKeyBox has key, store {
        id: UID,
        key_data: vector<u8>,
    }

    public struct WorkSubmitted has copy, drop {
        job_id: ID,
        proof: String,
    }

    public fun submit_work(
        job: &mut Job, 
        proof_link: vector<u8>, 
        decryption_key: vector<u8>, 
        ctx: &mut TxContext
    ) {
        let sender = ctx.sender();
        assert!(sender == job::get_freelancer(job), ENotFreelancer);

        let secret_box = SecretKeyBox {
            id: object::new(ctx),
            key_data: decryption_key,
        };

        // --- SỬA LỖI Ở ĐÂY ---
        // Dùng job::uid_mut(job) thay vì &mut job.id
        dof::add(job::uid_mut(job), b"secret_key", secret_box);

        job::set_status_submitted(job);

        event::emit(WorkSubmitted {
            job_id: job::get_job_id(job),
            proof: string::utf8(proof_link),
        });
    }
}