/**
 * CCTP V2 example — move real USDC from Arc Testnet to Base Sepolia.
 *
 * Flow (Circle's canonical burn-and-mint, no wrapped assets):
 *   1. approve  — allow TokenMessengerV2 to pull USDC on Arc
 *   2. burn     — depositForBurn(amount, destDomain=6, recipient, …) on Arc
 *   3. attest   — poll Circle's Iris sandbox API until the attestation is ready
 *                 (CCTP V2 fast transfers attest in seconds)
 *   4. mint     — receiveMessage(message, attestation) on Base Sepolia
 *
 * Run:
 *   export OWNER_PRIVATE_KEY=0x...      # funded on Arc testnet (faucet.circle.com)
 *   npm run cctp:example
 *
 * Note: verify the Base Sepolia USDC address below against
 * https://developers.circle.com/stablecoins/usdc-contract-addresses before a
 * live run — Circle occasionally redeploys testnet tokens.
 */
import "dotenv/config";
import {
  createPublicClient,
  createWalletClient,
  http,
  encodeFunctionData,
  parseEventLogs,
  pad,
  keccak256,
  parseAbi,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { arcTestnet } from "../src/chain.js";
import { CCTP, USDC_ADDRESS } from "../src/config.js";
import { erc20Abi, tokenMessengerV2Abi, messageTransmitterV2Abi } from "../src/abis.js";

const BASE_SEPOLIA_USDC: Address = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const AMOUNT = 1_000_000n; // 1 USDC (6 decimals)

const messageSentAbi = parseAbi([
  "event MessageSent(bytes message)",
]);

function addressToBytes32(addr: Address): Hex {
  return pad(addr, { size: 32 });
}

async function main() {
  const pk = process.env.OWNER_PRIVATE_KEY as Hex | undefined;
  if (!pk) throw new Error("Set OWNER_PRIVATE_KEY");
  const account = privateKeyToAccount(pk);

  const arcPublic = createPublicClient({ chain: arcTestnet, transport: http() });
  const arcWallet = createWalletClient({ account, chain: arcTestnet, transport: http() });
  const basePublic = createPublicClient({ chain: baseSepolia, transport: http() });
  const baseWallet = createWalletClient({ account, chain: baseSepolia, transport: http() });

  // ---- 1. approve TokenMessengerV2 on Arc --------------------------------
  console.log(`[1/4] Approving ${AMOUNT} USDC to TokenMessengerV2 on Arc…`);
  const approveHash = await arcWallet.sendTransaction({
    to: USDC_ADDRESS,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [CCTP.TOKEN_MESSENGER_V2, AMOUNT],
    }),
  });
  await arcPublic.waitForTransactionReceipt({ hash: approveHash });

  // ---- 2. burn on Arc -----------------------------------------------------
  console.log("[2/4] Burning on Arc via depositForBurn…");
  const t0 = Date.now();
  const burnHash = await arcWallet.sendTransaction({
    to: CCTP.TOKEN_MESSENGER_V2,
    data: encodeFunctionData({
      abi: tokenMessengerV2Abi,
      functionName: "depositForBurn",
      args: [
        AMOUNT,
        CCTP.BASE_SEPOLIA_DOMAIN,          // destination domain 6
        addressToBytes32(account.address), // mint to ourselves on Base
        USDC_ADDRESS,                      // burn Arc's native-USDC facade
        pad("0x", { size: 32 }),           // anyone may relay the mint
        500n,                              // maxFee (units of USDC) for fast transfer
        1000,                              // minFinalityThreshold: 1000 = fast
      ],
    }),
  });
  const burnReceipt = await arcPublic.waitForTransactionReceipt({ hash: burnHash });
  console.log(`      burned in ${Date.now() - t0}ms (Arc sub-second finality)`);

  const [messageSent] = parseEventLogs({
    abi: messageSentAbi,
    eventName: "MessageSent",
    logs: burnReceipt.logs,
  });
  if (!messageSent) throw new Error("MessageSent event not found in burn receipt");
  const message = messageSent.args.message as Hex;
  const messageHash = keccak256(message);

  // ---- 3. poll Circle Iris for the attestation ---------------------------
  console.log(`[3/4] Polling Iris sandbox for attestation ${messageHash}…`);
  let attestation: Hex | undefined;
  for (let i = 0; i < 60; i++) {
    const res = await fetch(`${CCTP.IRIS_API}/v2/messages/${CCTP.ARC_DOMAIN}?transactionHash=${burnHash}`);
    if (res.ok) {
      const body = (await res.json()) as {
        messages?: { attestation?: string; status?: string; message?: string }[];
      };
      const msg = body.messages?.[0];
      if (msg?.status === "complete" && msg.attestation && msg.attestation !== "PENDING") {
        attestation = msg.attestation as Hex;
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  if (!attestation) throw new Error("Attestation not ready after 3 minutes — retry step 4 later with the saved message.");
  console.log("      attestation received.");

  // ---- 4. mint on Base Sepolia -------------------------------------------
  console.log("[4/4] Minting on Base Sepolia via receiveMessage…");
  const mintHash = await baseWallet.sendTransaction({
    to: CCTP.MESSAGE_TRANSMITTER_V2,
    data: encodeFunctionData({
      abi: messageTransmitterV2Abi,
      functionName: "receiveMessage",
      args: [message, attestation],
    }),
  });
  await basePublic.waitForTransactionReceipt({ hash: mintHash });

  const baseBalance = await basePublic.readContract({
    address: BASE_SEPOLIA_USDC,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  });
  console.log(`Done. Base Sepolia USDC balance: ${baseBalance} (6-decimal units)`);
  console.log(`Burn tx (Arc):  https://testnet.arcscan.app/tx/${burnHash}`);
  console.log(`Mint tx (Base): https://sepolia.basescan.org/tx/${mintHash}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
