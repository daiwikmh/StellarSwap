import { Keypair, TransactionBuilder } from "@stellar/stellar-sdk";

// Environment variables for private keys
const CALLER_PRIVATE_KEY = process.env.STELLAR_CALLER_PRIVATE_KEY || "SDQA3THDW7KDZ5Z4LFFZV5TZLB5SWWCITBV3LHU7F6CL7JSCKGAZD7FN";
const RECEIVER_PRIVATE_KEY = process.env.STELLAR_RECEIVER_PRIVATE_KEY || "SBXW43J6HLCEHAEZXV56EHBIRY6Y3ODOCMSHI7FD22FGGE2L3SBMU2AP";

// Sign transaction for caller (initiate)
export const signTransactionCaller = (txXDR: string, networkPassphrase: string) => {
    const keypair = Keypair.fromSecret(CALLER_PRIVATE_KEY);
    const transaction = TransactionBuilder.fromXDR(txXDR, networkPassphrase);
    transaction.sign(keypair);
    return transaction.toXDR();
};

// Sign transaction for receiver (claim)
export const signTransactionReceiver = (txXDR: string, networkPassphrase: string) => {
    const keypair = Keypair.fromSecret(RECEIVER_PRIVATE_KEY);
    const transaction = TransactionBuilder.fromXDR(txXDR, networkPassphrase);
    transaction.sign(keypair);
    return transaction.toXDR();
};

// Legacy function for backward compatibility
export const signTransaction = signTransactionCaller;
  