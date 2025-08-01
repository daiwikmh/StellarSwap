import {
  scValToNative,
  nativeToScVal,
  xdr,
  Networks,
} from "@stellar/stellar-sdk";
import { Server } from "@stellar/stellar-sdk/rpc";

const server = new Server("https://soroban-testnet.stellar.org");

const contractAddress = "CDIQPYZPXGOMCN4JYYCAYVBINY3XHEBORJBAHXYM2WTMN4ATLCHKISNP";
export async function fetchSwapEventsFromLedger(
  startLedger: number,
  contractId: string = contractAddress,
  timeoutMs: number = 30000, // 30s default
  pollIntervalMs: number = 3000
) {
  const swapInitiatedTopic = nativeToScVal("swap_initiated", { type: "symbol" }).toXDR("base64");

  // Get server ledger range first
  const latestLedger = await server.getLatestLedger();
  const minLedger = Math.max(636690, latestLedger.sequence - 120000); // Conservative minimum
  const maxLedger = latestLedger.sequence;
  
  // Ensure startLedger is within valid range
  let currentStartLedger = Math.max(minLedger, Math.min(startLedger - 50, maxLedger));

  const end = Date.now() + timeoutMs;

  console.log(`Starting to poll for events from ledger ${currentStartLedger}`);

  while (Date.now() < end) {
    try {
      const eventPage = await server.getEvents({
        startLedger: currentStartLedger,
        filters: [
          {
            type: "contract",
            contractIds: [contractId],
            topics: [[swapInitiatedTopic]], // Match first topic == "swap_initiated"
          },
        ],
        limit: 10,
      });

      if (eventPage.events.length > 0) {
        console.log(`Found ${eventPage.events.length} event(s)`);
        return eventPage.events.map((event) => ({
          topics: event.value, // Note: it's `topics`, not `topic`
          value: scValToNative(event.value),
          ledger: event.ledger,
          transactionHash: event.txHash,
        }));
      }

      // Update startLedger to latest ledger we've checked
      if (eventPage.latestLedger) {
        currentStartLedger = eventPage.latestLedger + 1;
      }

      // Avoid tight loop
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    } catch (error) {
      console.warn("Error fetching events:", error);
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }

  throw new Error(`No swap_initiated events found after ledger ${startLedger}`);
}
