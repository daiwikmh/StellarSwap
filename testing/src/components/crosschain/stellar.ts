import {
  Contract,
  rpc,
  TransactionBuilder,
  nativeToScVal,
  Networks,
  BASE_FEE,
  Address,
} from "@stellar/stellar-sdk";
import { signTransaction } from "../../config/stellar";

// Configuration from .env
const rpcUrl = "https://soroban-testnet.stellar.org";
const contractAddress = "CAFHB4G24OPNAXURRGZIUR65V33IH3RX7VSBR3AAXRNVZOVS44YAUPE6";
const networkPassphrase = Networks.TESTNET;

// Utility function to validate and convert Stellar address to ScVal
const addressToScVal = (address: string) => {
  if (!address.match(/^[CG][A-Z0-9]{55}$/)) {
    throw new Error(`Invalid address format: ${address}`);
  }
  return nativeToScVal(new Address(address), { type: "address" });
};

// Utility function to convert a number to i128
const numberToI128 = (value: number) => {
  return nativeToScVal(value, { type: "i128" });
};

// Utility function to convert a hex string to BytesN<32> for hashlock or swap_id
const bytesN32ToScVal = (hexString: string) => {
  if (!hexString.match(/^[0-9a-fA-F]{64}$/)) {
    throw new Error(`Invalid BytesN<32> format: ${hexString} (must be 64-char hex string)`);
  }
  const bytes = Buffer.from(hexString, "hex");
  return nativeToScVal(bytes, { type: "bytes" });
};

// Utility function to convert a number to u64 for timelock
const numberToU64 = (value: number) => {
  if (!Number.isInteger(value) || value < 0 || value > 2 ** 64 - 1) {
    throw new Error(`Invalid u64 value: ${value}`);
  }
  return nativeToScVal(value, { type: "u64" });
};

// Core contract interaction function (from your original code)
const contractInt = async (caller: string, functName: string, values: any) => {
  try {
    const server = new rpc.Server(rpcUrl, { allowHttp: true });
    const sourceAccount = await server.getAccount(caller).catch((err) => {
      throw new Error(`Failed to fetch account ${caller}: ${err.message}`);
    });

    const contract = new Contract(contractAddress);
    const params = {
      fee: BASE_FEE,
      networkPassphrase,
    };

    // Build transaction
    let transaction;
    const builder = new TransactionBuilder(sourceAccount, params);
    if (values == null) {
      transaction = builder
        .addOperation(contract.call(functName))
        .setTimeout(30)
        .build();
    } else if (Array.isArray(values)) {
      transaction = builder
        .addOperation(contract.call(functName, ...values))
        .setTimeout(30)
        .build();
    } else {
      transaction = builder
        .addOperation(contract.call(functName, values))
        .setTimeout(30)
        .build();
    }

    // Prepare and sign transaction
    const preparedTx = await server.prepareTransaction(transaction).catch((err) => {
      throw new Error(`Failed to prepare transaction: ${err.message}`);
    });
    const prepareTxXDR = preparedTx.toXDR();

    let signedTxResponse: string;
    try {
      signedTxResponse = signTransaction(prepareTxXDR, networkPassphrase);
    } catch (err: any) {
      throw new Error(`Failed to sign transaction: ${err.message}`);
    }

    const signedXDR = signedTxResponse;

    const tx = TransactionBuilder.fromXDR(signedXDR, Networks.TESTNET);
    const txResult = await server.sendTransaction(tx).catch((err) => {
      throw new Error(`Failed to send transaction: ${err.message}`);
    });

    let txResponse = await server.getTransaction(txResult.hash);
    const maxRetries = 30;
    let retries = 0;

    while (txResponse.status === "NOT_FOUND" && retries < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      txResponse = await server.getTransaction(txResult.hash);
      retries++;
    }

    if (txResponse.status !== "SUCCESS") {
      return `Transaction failed with status: ${txResponse.status}`;
    }

    return null; // No return value for void functions
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return `Error in contract interaction (${functName}): ${errorMessage}`;
  }
};

// HTLC Contract interaction functions
async function initiate(
  caller: string,
  receiver: string,
  tokenAddress: string,
  amount: number,
  hashlock: string, // 64-char hex string for BytesN<32>
  timelock: number // Unix timestamp (u64)
): Promise<string> {
  try {
    // Validate and convert parameters
    const senderScVal = addressToScVal(caller);
    const receiverScVal = addressToScVal(receiver);
    const tokenScVal = addressToScVal(tokenAddress);
    const amountScVal = numberToI128(amount);
    const hashlockScVal = bytesN32ToScVal(hashlock);
    const timelockScVal = numberToU64(timelock);

    const params = [
      senderScVal,
      receiverScVal,
      tokenScVal,
      amountScVal,
      hashlockScVal,
      timelockScVal,
    ];
    const result = await contractInt(caller, "initiate", params);

    if (typeof result === "string" && result.startsWith("Error")) {
      return result;
    }
    return "HTLC initiated successfully";
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return `Error initiating HTLC: ${errorMessage}`;
  }
}

async function claim(caller: string, swapId: string, preimage: string): Promise<string> {
  try {
    // Validate and convert parameters
    const swapIdScVal = bytesN32ToScVal(swapId);
    const preimageBytes = Buffer.from(preimage, "utf8"); // Preimage as UTF-8 string
    const preimageScVal = nativeToScVal(preimageBytes, { type: "bytes" });

    const params = [swapIdScVal, preimageScVal];
    const result = await contractInt(caller, "claim", params);

    if (typeof result === "string" && result.startsWith("Error")) {
      return result;
    }
    return "Swap claimed successfully";
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return `Error claiming swap: ${errorMessage}`;
  }
}

async function refund(caller: string, swapId: string): Promise<string> {
  try {
    // Validate and convert parameters
    const swapIdScVal = bytesN32ToScVal(swapId);

    const result = await contractInt(caller, "refund", swapIdScVal);

    if (typeof result === "string" && result.startsWith("Error")) {
      return result;
    }
    return "Swap refunded successfully";
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return `Error refunding swap: ${errorMessage}`;
  }
}

export { contractInt, initiate, claim, refund };-