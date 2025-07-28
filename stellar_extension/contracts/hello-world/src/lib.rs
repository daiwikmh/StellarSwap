#![no_std]
use soroban_sdk::{contract,token, contractimpl, contracttype,Vec, Address, Bytes, BytesN, Env, IntoVal};
use soroban_sdk::xdr::ToXdr;

#[contract]
pub struct HTLCContract;

#[derive(Clone)]
#[contracttype]
pub struct Swap {
    sender: Address,
    receiver: Address,
    token_address: Address,   
    amount: i128,
    hashlock: BytesN<32>, 
    timelock: u64,       
    claimed: bool,
}

#[contracttype]
pub enum DataKey {
    Swap(BytesN<32>),
}

#[contractimpl]
impl HTLCContract {
pub fn initiate(
    env: Env,
    sender: Address,
    receiver: Address,
    token_address: Address,

    amount: i128,
    hashlock: BytesN<32>,
    timelock: u64,
) {
    sender.require_auth();

    if amount <= 0 {
        panic!("Amount must be positive");
    }
    if timelock <= env.ledger().timestamp() {
        panic!("Timelock must be in the future");
    }

    // Use Bytes instead of Vec<u8> for swap_id_bytes
    let mut swap_id_bytes = Bytes::new(&env);

    // Append XDR-encoded data to Bytes
    swap_id_bytes.append(&sender.clone().to_xdr(&env));
    swap_id_bytes.append(&receiver.clone().to_xdr(&env));
    swap_id_bytes.append(&hashlock.clone().to_xdr(&env));
    swap_id_bytes.append(&Bytes::from_slice(&env, &timelock.to_be_bytes()));

    // Compute SHA-256 hash of swap_id_bytes
    let swap_id_hash = env.crypto().sha256(&swap_id_bytes);
    let swap_id = BytesN::from_array(&env, &swap_id_hash.to_array());



      let sender_clone = sender.clone();
    let receiver_clone = receiver.clone();
    let swap_id_clone = swap_id.clone();


     let token_client = token::Client::new(&env, &token_address);
        token_client.transfer(&sender, &env.current_contract_address(), &amount);
        

    let swap = Swap {
        sender,
        receiver,
        token_address,  // NEW: Store token address
        amount,
        hashlock,
        timelock,
        claimed: false,
    };

    env.storage().persistent().set(&DataKey::Swap(swap_id), &swap);

            env.events().publish(("swap_initiated",),  (swap_id_clone, sender_clone, receiver_clone, amount),);

}
pub fn claim(env: Env, swap_id: BytesN<32>, preimage: Bytes) {
    
    
    
    let swap_id_clone: BytesN<32> = swap_id.clone(); // avoid moving original

    let mut swap: Swap = env
        .storage()
        .persistent()
        .get(&DataKey::Swap(swap_id_clone.clone()))
        .expect("Swap not found");

    if swap.claimed {
        panic!("Swap already claimed");
    }
    if env.ledger().timestamp() >= swap.timelock {
        panic!("Timelock expired");
    }
    
    swap.receiver.require_auth();


    let preimage_hash = env.crypto().sha256(&preimage);
    let preimage_hash_bytes = BytesN::from_array(&env, &preimage_hash.to_array());

    if preimage_hash_bytes != swap.hashlock {
        panic!("Invalid preimage");
    }

    
    let token_client = token::Client::new(&env, &swap.token_address);
    token_client.transfer(&env.current_contract_address(), &swap.receiver, &swap.amount);


    swap.claimed = true;

    env.storage().persistent().set(&DataKey::Swap(swap_id_clone.clone()), &swap);

    env.events().publish(("swap_claimed",), (swap_id_clone, preimage));
}




    pub fn refund(env: Env, swap_id: BytesN<32>) {
        let mut swap: Swap = env
            .storage()
            .persistent()
            .get(&DataKey::Swap(swap_id.clone()))
            .expect("Swap not found");

        if swap.claimed {
            panic!("Swap already claimed");
        }
        if env.ledger().timestamp() < swap.timelock {
            panic!("Timelock not expired");
        }

        swap.sender.require_auth();
        swap.claimed = true;
        env.storage().persistent().set(&DataKey::Swap(swap_id), &swap);
        // Transfer tokens back to sender
        let token_client = token::Client::new(&env, &swap.token_address);
token_client.transfer(&env.current_contract_address(), &swap.sender, &swap.amount);

    }
}