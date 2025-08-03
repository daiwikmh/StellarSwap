import {
  scValToNative,
  nativeToScVal,
 
} from "@stellar/stellar-sdk";
import { Api, Server } from "@stellar/stellar-sdk/rpc";

const server = new Server("https://soroban-testnet.stellar.org");

const contractAddress =
  "CDIQPYZPXGOMCN4JYYCAYVBINY3XHEBORJBAHXYM2WTMN4ATLCHKISNP";

export async function fetchSwapEventsFromLedger(
  startLedger: number,
  timeoutMs: number = 360000,
  pollIntervalMs: number = 5000,
  filterByTxHash?: string
) {
  const latestLedger = await server.getLatestLedger();
  const minLedger = Math.max(636690, latestLedger.sequence - 120000);
  const maxLedger = latestLedger.sequence;

  let currentStartLedger = Math.max(
    minLedger,
    Math.min(startLedger - 50, maxLedger)
  );

  const end = Date.now() + timeoutMs;

  const swapFilter: Api.EventFilter = {
    type: "contract", // as a string
    contractIds: [contractAddress],
    topics: [
      [nativeToScVal("swap_initiated", { type: "string" }).toXDR("base64")],
    ],
  };

  console.log(`Starting to poll for events from ledger ${currentStartLedger}`);

  while (Date.now() < end) {
    try {
      const eventPage = await server.getEvents({
        startLedger: currentStartLedger - 50,
        filters: [swapFilter],
        limit: 10,
      });

      const mappedEvents = eventPage.events.map((event) => {
        const [swapId, sender, receiver, amount] = scValToNative(event.value);

        return {
          topics: event.topic.map(scValToNative),
          swapId: Buffer.from(swapId).toString("hex"),
          sender: sender.toString(),
          receiver: receiver.toString(),
          amount: BigInt(amount),
          ledger: event.ledger,
          transactionHash: event.txHash,
        };
      });

      // Filter by transaction hash if provided
      if (filterByTxHash) {
        const filteredEvents = mappedEvents.filter(event => event.transactionHash === filterByTxHash);
        if (filteredEvents.length > 0) {
          return filteredEvents;
        }
      } else {
        return mappedEvents;
      }

      if (eventPage.latestLedger) {
        currentStartLedger = eventPage.latestLedger + 1;
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    } catch (error) {
      console.warn("Error fetching events:", error);
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }

  throw new Error(`No swap_initiated events found after ledger ${startLedger}`);
}
