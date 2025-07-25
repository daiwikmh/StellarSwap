#![cfg(test)]

use super::*;
use soroban_sdk::{vec, Env, String};

#[test]
fn test_successful_swap() {
    let env = Env::default();
    let contract = HTLCContractClient::new(&env, &env.register_contract(None, HTLCContract {}));
    
    let sender = Address::random(&env);
    let receiver = Address::random(&env);
    let token_address = Address::random(&env); // Mock token address
    let amount = 100;
    let preimage = Bytes::from_slice(&env, b"secret123");
    let hashlock = env.crypto().sha256(&preimage);
    let timelock = env.ledger().timestamp() + 100;

    // Assume mock token contract allows free transfer for testing

    let swap_id = contract.initiate(
        &sender,
        &receiver,
        &token_address,
        &amount,
        &BytesN::from_array(&env, &hashlock.to_array()),
        &timelock
    );

    // Now claim
    env.ledger().set_timestamp(timelock - 1);
    contract.claim(&swap_id, &preimage);

    // Try refund (should fail)
    let result = std::panic::catch_unwind(|| {
        contract.refund(&swap_id);
    });
    assert!(result.is_err());
}    let env = Env::default();
    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);

    let words = client.hello(&String::from_str(&env, "Dev"));
    assert_eq!(
        words,
        vec![
            &env,
            String::from_str(&env, "Hello"),
            String::from_str(&env, "Dev"),
        ]
    );
}
