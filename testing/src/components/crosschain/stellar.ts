import {
  Contract,
  rpc,
  TransactionBuilder,
  nativeToScVal,
  Networks,
  BASE_FEE,
  Address,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import {
  signTransactionCaller,
  signTransactionReceiver,
} from "../../config/stellar";
import { start } from "repl";
import { fetchSwapEventsFromLedger } from "@/config/fetchEvents";

// Configuration from .env
const rpcUrl = "https://soroban-testnet.stellar.org";
const contractAddress =
  "CDIQPYZPXGOMCN4JYYCAYVBINY3XHEBORJBAHXYM2WTMN4ATLCHKISNP";
const networkPassphrase = Networks.TESTNET;

// Utility function to validate and convert Stellar address to ScVal
const addressToScVal = (address: string) => {
  if (!address.match(/^[CG][A-Z0-9]{55}$/)) {
    throw new Error(`Invalid address format: ${address}`);
  }
  return nativeToScVal(new Address(address), { type: "address" });
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Utility function to convert a number to i128
const numberToI128 = (value: string | BigInt) => {
  return nativeToScVal(typeof value === "string" ? BigInt(value) : value, {
    type: "i128",
  });
};

// Utility function to convert a hex string to  for hashlock or swap_id

const bytesN32ToScVal = (hexString: string) => {
  if (!hexString.match(/^[0-9a-fA-F]{64}$/)) {
    throw new Error(
      `Invalid Bytes format: ${hexString} (must be 64-char hex string)`
    );
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

const contractInt = async (caller: string, functName: string, values: any) => {
  try {
    const server = new rpc.Server(rpcUrl, { allowHttp: true });
    const sourceAccount = await server.getAccount(caller).catch((err) => {
      throw new Error(`Failed to fetch account ${caller}: ${err.message}`);
    });

    console.log("Source Account ID:", sourceAccount.accountId());
    console.log("Source Account Balances:", sourceAccount.accountId);

    const contract = new Contract(contractAddress);
    const params = {
      fee: BASE_FEE,
      networkPassphrase,
    };
    console.log("Contract Address:", contract.address);
    console.log("FEE", BASE_FEE);

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

    console.log("Transaction Built:", transaction.toXDR());

    const simulation = await server
      .simulateTransaction(transaction)
      .catch((err) => {
        console.error(`Simulation failed for ${functName}: ${err.message}`);
        throw new Error(`Failed to simulate transaction: ${err.message}`);
      });
    if (
      "results" in simulation &&
      Array.isArray(simulation.results) &&
      simulation.results.length > 0
    ) {
      console.log(`Read-only call detected for ${functName}`);
      // ...
    } else if ("error" in simulation) {
      console.error(`Simulation error for ${functName}:`, simulation.error);
      throw new Error(`Simulation failed: ${simulation.error}`);
    }

    if (
      "results" in simulation &&
      Array.isArray(simulation.results) &&
      simulation.results.length > 0
    ) {
      console.log(`Read-only call detected for ${functName}`);
      const result = simulation.results[0];
      if (result.xdr) {
        try {
          // Parse the return value from XDR
          const scVal = xdr.ScVal.fromXDR(result.xdr, "base64");
          const parsedValue = scValToNative(scVal);
          console.log(
            `Parsed simulation result for ${functName}:`,
            parsedValue
          );
          return parsedValue; // Returns string for share_id, array for get_rsrvs
        } catch (err) {
          console.error(`Failed to parse XDR for ${functName}:`, err);
          throw new Error(
            `Failed to parse simulation result: ${
              err instanceof Error ? err.message : String(err)
            }`
          );
        }
      }
      console.error(
        `No xdr field in simulation results[0] for ${functName}:`,
        result
      );
      throw new Error("No return value in simulation results");
    } else if ("error" in simulation) {
      console.error(`Simulation error for ${functName}:`, simulation.error);
      throw new Error(`Simulation failed: ${simulation.error}`);
    }
    console.log(`Submitting transaction for ${functName}`);

    const preparedTx = await server
      .prepareTransaction(transaction)
      .catch((err) => {
        console.error(
          `Prepare transaction failed for ${functName}: ${err.message}`
        );
        throw new Error(`Failed to prepare transaction: ${err.message}`);
      });
    const prepareTxXDR = preparedTx.toXDR();
    console.log(`Prepared transaction XDR for ${functName}:`, prepareTxXDR);

    let signedTxResponse: string;
    try {
      // Use appropriate signing function based on the function name
      if (functName === "initiate") {
        signedTxResponse = signTransactionCaller(
          prepareTxXDR,
          Networks.TESTNET
        );
      } else if (functName === "claim") {
        signedTxResponse = signTransactionReceiver(
          prepareTxXDR,
          Networks.TESTNET
        );
      } else {
        signedTxResponse = signTransactionCaller(
          prepareTxXDR,
          Networks.TESTNET
        );
      }
    } catch (err: any) {
      throw new Error(`Failed to sign transaction: ${err.message}`);
    }

    // Sign transaction
    console.log(`Signed transaction XDR for ${functName}:`, signedTxResponse);
    const signedXDR = signedTxResponse;
    console.log(`Signed transaction XDR for ${functName}:`, signedXDR);

    const tx = TransactionBuilder.fromXDR(signedXDR, Networks.TESTNET);
    console.log(
      `Transaction ready for submission for ${functName}:`,
      tx.toXDR()
    );

    const txResult = await server.sendTransaction(tx).catch((err) => {
      console.error(`Send transaction failed for ${functName}: ${err.message}`);
      throw new Error(`Send transaction failed: ${err.message}`);
    });
    console.log(`Transaction result for ${functName}:`, txResult);
    // If we got a hash, return immediately with success
    await sleep(3000);

    try {
  const events = await fetchSwapEventsFromLedger(txResult.latestLedger, contractAddress, );


  console.log("✅ Swap Events Found:", events);
} catch (e) {
  console.error(
    "❌ Error fetching events:",
    e instanceof Error ? e.message : String(e)
  );
}
    if (txResult.hash) {
      return {
        success: true,
        hash: txResult.hash,
        status: "PENDING",
        startLedger: txResult.latestLedger,
      };
    }

    // Remove the transaction status checking code since we're treating hash existence as success
    return {
      success: false,
      message: "No transaction hash received",
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `Error in contract interaction (${functName}):`,
      errorMessage
    );
    return {
      success: false,
      message: errorMessage,
    };
  }
};

async function initiate(
  caller: string,
  receiver: string,
  tokenAddress: string,
  amount: bigint,
  hashlock: Buffer,
  timelock: number
): Promise<any> {
  try {
    const senderScVal = addressToScVal(caller);
    const receiverScVal = addressToScVal(receiver);
    const tokenScVal = addressToScVal(tokenAddress);
    const amountScVal = numberToI128(amount);
    const hashlockScVal = nativeToScVal(hashlock, { type: "bytes" });
    const timelockScVal = numberToU64(timelock);

    console.log("Initiating HTLC with parameters:", {
      senderScVal,
      receiverScVal,
      tokenScVal,
      amountScVal,
      hashlockScVal,
      timelockScVal,
    });

    // Return the actual result from contractInt which contains hash, success, etc.
    const result = await contractInt(caller, "initiate", [
      senderScVal,
      receiverScVal,
      tokenScVal,
      amountScVal,
      hashlockScVal,
      timelockScVal,
    ]);

    return result;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Error initiating HTLC: ${errorMessage}`,
    };
  }
}

// Updated claim function
async function claim(
  receiver: string,
  swapId: string,
  preimage: string
): Promise<{ success: boolean; message: string; hash?: string }> {
  try {
    console.log("Claiming HTLC with parameters:", {
      receiver,
      swapId: swapId,
      preimage: preimage,
    });
    const swapIdScVal = bytesN32ToScVal(swapId);
    const preimageBytes = Buffer.from(preimage, "hex");
    const preimageScVal = nativeToScVal(preimageBytes, { type: "bytes" });
    console.log("Claiming HTLC with parameters:", {
      receiver,
      swapId: swapIdScVal,
      preimage: preimageScVal,
    });
    const params = [swapIdScVal, preimageScVal];
    const result = await contractInt(receiver, "claim", params);

    // If we got a result with a hash, it's successful
    if (result && result.hash) {
      return {
        success: true,
        message: "Claim transaction submitted successfully",
        hash: result.hash,
      };
    }
    console.error("Claim failed, no hash received:", result);

    return {
      success: false,
      message: "No transaction hash received",
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: errorMessage,
    };
  }
}

// Updated refund function
async function refund(caller: string, swapId: string): Promise<string> {
  try {
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

export { contractInt, initiate, claim, refund };
