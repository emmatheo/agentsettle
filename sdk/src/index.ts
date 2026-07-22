/**
 * AgentSettle SDK — the integration layer autonomous agents use to hold and
 * move real USDC on Arc Testnet.
 *
 * Design notes:
 *  - All amounts are 6-decimal USDC bigints (e.g. 1_000_000n = $1.00). Helpers
 *    `usd()` / `formatUsd()` convert to and from human numbers.
 *  - Two roles map to two viem wallet clients: the OWNER key deploys wallets,
 *    funds them, and sets policy; the AGENT key executes scoped actions.
 *  - Arc finality is sub-second and deterministic, so `waitForTransactionReceipt`
 *    typically resolves in well under a second — the SDK measures and returns
 *    that latency so demos can show it off.
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  encodeFunctionData,
  parseEventLogs,
  stringToHex,
  keccak256,
  toBytes,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
  type Account,
  type Chain,
  type AbiEvent,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "./chain.js";
import {
  ARC_RPC_URL,
  USDC_ADDRESS,
  USDC_DECIMALS,
  addressesFromEnv,
  type AgentSettleAddresses,
} from "./config.js";
import {
  agentWalletAbi,
  factoryAbi,
  settlementAbi,
  registryAbi,
  erc20Abi,
} from "./abis.js";

export * from "./config.js";
export * from "./abis.js";
export * from "./chain.js";

// ---------------------------------------------------------------------------
// Amount helpers
// ---------------------------------------------------------------------------

/** "1.25" or 1.25 → 1_250_000n (6-decimal USDC). */
export function usd(amount: number | string): bigint {
  const [whole, frac = ""] = String(amount).split(".");
  const fracPadded = (frac + "000000").slice(0, USDC_DECIMALS);
  return BigInt(whole || "0") * 10n ** BigInt(USDC_DECIMALS) + BigInt(fracPadded || "0");
}

/** 1_250_000n → "1.25" */
export function formatUsd(amount: bigint): string {
  const neg = amount < 0n;
  const abs = neg ? -amount : amount;
  const whole = abs / 1_000_000n;
  const frac = (abs % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole}${frac ? "." + frac : ""}`;
}

/** 32-byte memo reference from any string (invoice id, job id, …). */
export function memoRef(s: string): Hex {
  return keccak256(toBytes(s));
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentPolicy {
  dailyLimit: bigint; // 6-decimal USDC
  maxPerTx: bigint;   // 6-decimal USDC
  expiry: bigint;     // unix seconds
  active: boolean;
}

export interface AgentState {
  address: Address;
  owner: Address;
  agent: Address;
  balance: bigint;
  policy: AgentPolicy;
  spentToday: bigint;
  remainingToday: bigint;
}

export interface TxResult {
  hash: Hex;
  blockNumber: bigint;
  /** Wall-clock ms between send and confirmed receipt — Arc's headline stat. */
  finalityMs: number;
  gasUsed: bigint;
  /** Fee actually paid, in 6-decimal USDC (Arc fees are USDC-denominated). */
  feeUsdc: bigint;
}

export interface AgentTxRecord {
  kind: "payment" | "execution" | "deposit" | "withdrawal";
  txHash: Hex;
  blockNumber: bigint;
  by?: Address;
  counterparty?: Address;
  amount?: bigint;
  memoRef?: Hex;
}

export interface SdkOptions {
  rpcUrl?: string;
  addresses?: AgentSettleAddresses;
  /** Owner (cold) key — needed for deploy/fund/policy calls. */
  ownerKey?: Hex;
  /** Agent (hot) key — needed for executeAgentAction/payFromAgent. */
  agentKey?: Hex;
}

// ---------------------------------------------------------------------------
// SDK
// ---------------------------------------------------------------------------

export class AgentSettleSDK {
  readonly chain: Chain = arcTestnet; // viem ships Arc Testnet built-in
  readonly publicClient: PublicClient;
  readonly addresses: AgentSettleAddresses;
  private ownerClient?: WalletClient;
  private agentClient?: WalletClient;
  readonly ownerAccount?: Account;
  readonly agentAccount?: Account;

  constructor(opts: SdkOptions = {}) {
    const transport = http(opts.rpcUrl ?? process.env.ARC_RPC_URL ?? ARC_RPC_URL);
    this.publicClient = createPublicClient({ chain: this.chain, transport });
    this.addresses = opts.addresses ?? addressesFromEnv();

    const ownerKey = opts.ownerKey ?? (process.env.OWNER_PRIVATE_KEY as Hex | undefined);
    if (ownerKey) {
      this.ownerAccount = privateKeyToAccount(ownerKey);
      this.ownerClient = createWalletClient({ account: this.ownerAccount, chain: this.chain, transport });
    }
    const agentKey = opts.agentKey ?? (process.env.AGENT_PRIVATE_KEY as Hex | undefined);
    if (agentKey) {
      this.agentAccount = privateKeyToAccount(agentKey);
      this.agentClient = createWalletClient({ account: this.agentAccount, chain: this.chain, transport });
    }
  }

  // -- internal ------------------------------------------------------------

  private requireOwner(): WalletClient {
    if (!this.ownerClient) throw new Error("OWNER_PRIVATE_KEY not configured");
    return this.ownerClient;
  }

  private requireAgent(): WalletClient {
    if (!this.agentClient) throw new Error("AGENT_PRIVATE_KEY not configured");
    return this.agentClient;
  }

  /** Send a tx and measure Arc's confirmation latency + USDC fee. */
  private async sendAndMeasure(
    client: WalletClient,
    req: { to: Address; data: Hex; value?: bigint }
  ): Promise<TxResult> {
    const started = Date.now();
    const hash = await client.sendTransaction({
      account: client.account!,
      chain: this.chain,
      to: req.to,
      data: req.data,
      value: req.value ?? 0n,
    });
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash, pollingInterval: 150 });
    const finalityMs = Date.now() - started;
    if (receipt.status !== "success") throw new Error(`Transaction reverted: ${hash}`);
    // effectiveGasPrice is in 18-decimal native USDC wei; convert to 6-decimal.
    const feeNative18 = receipt.gasUsed * (receipt.effectiveGasPrice ?? 0n);
    const feeUsdc = feeNative18 / 10n ** 12n;
    return { hash, blockNumber: receipt.blockNumber, finalityMs, gasUsed: receipt.gasUsed, feeUsdc };
  }

  // -- wallet lifecycle ----------------------------------------------------

  /**
   * Deploy a new policy-scoped AgentWallet via the factory.
   * Returns the wallet address plus tx metrics.
   */
  async createAgentWallet(params: {
    agent: Address;
    policy: AgentPolicy;
    allowedTargets?: Address[];
  }): Promise<{ wallet: Address } & TxResult> {
    const client = this.requireOwner();
    const targets = params.allowedTargets ?? [this.addresses.settlement];
    const data = encodeFunctionData({
      abi: factoryAbi,
      functionName: "deployAgentWallet",
      args: [
        params.agent,
        {
          dailyLimit: params.policy.dailyLimit,
          maxPerTx: params.policy.maxPerTx,
          expiry: params.policy.expiry,
          active: params.policy.active,
        },
        targets,
      ],
    });
    const res = await this.sendAndMeasure(client, { to: this.addresses.factory, data });
    const receipt = await this.publicClient.getTransactionReceipt({ hash: res.hash });
    const [deployed] = parseEventLogs({
      abi: factoryAbi,
      eventName: "AgentWalletDeployed",
      logs: receipt.logs,
    });
    if (!deployed) throw new Error("AgentWalletDeployed event not found");
    return { wallet: deployed.args.wallet, ...res };
  }

  /** Send USDC from the owner key into an agent wallet (ERC-20 transfer). */
  async fundAgent(wallet: Address, amount: bigint): Promise<TxResult> {
    const client = this.requireOwner();
    const data = encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [wallet, amount],
    });
    return this.sendAndMeasure(client, { to: USDC_ADDRESS, data });
  }

  /** Read the complete state of an agent wallet in one round of calls. */
  async getAgentState(wallet: Address): Promise<AgentState> {
    const [owner, agent, balance, policyRaw, spentToday, remainingToday] = await Promise.all([
      this.publicClient.readContract({ address: wallet, abi: agentWalletAbi, functionName: "owner" }),
      this.publicClient.readContract({ address: wallet, abi: agentWalletAbi, functionName: "agent" }),
      this.publicClient.readContract({ address: wallet, abi: agentWalletAbi, functionName: "usdcBalance" }),
      this.publicClient.readContract({ address: wallet, abi: agentWalletAbi, functionName: "policy" }),
      this.publicClient.readContract({ address: wallet, abi: agentWalletAbi, functionName: "spentToday" }),
      this.publicClient.readContract({ address: wallet, abi: agentWalletAbi, functionName: "remainingToday" }),
    ]);
    const [dailyLimit, maxPerTx, expiry, active] = policyRaw as readonly [bigint, bigint, bigint, boolean];
    return {
      address: wallet,
      owner,
      agent,
      balance,
      policy: { dailyLimit, maxPerTx, expiry, active },
      spentToday,
      remainingToday,
    };
  }

  /** Owner: replace the wallet's spend policy. */
  async setPolicy(wallet: Address, policy: AgentPolicy): Promise<TxResult> {
    const client = this.requireOwner();
    const data = encodeFunctionData({
      abi: agentWalletAbi,
      functionName: "setPolicy",
      args: [{ dailyLimit: policy.dailyLimit, maxPerTx: policy.maxPerTx, expiry: policy.expiry, active: policy.active }],
    });
    return this.sendAndMeasure(client, { to: wallet, data });
  }

  /** Owner: allow or revoke a target the agent may touch. */
  async setTarget(wallet: Address, target: Address, allowed: boolean): Promise<TxResult> {
    const client = this.requireOwner();
    const data = encodeFunctionData({ abi: agentWalletAbi, functionName: "setTarget", args: [target, allowed] });
    return this.sendAndMeasure(client, { to: wallet, data });
  }

  // -- agent actions -------------------------------------------------------

  /** Agent: direct USDC payment from the wallet, with an on-chain memo ref. */
  async payFromAgent(wallet: Address, to: Address, amount: bigint, memo: string): Promise<TxResult> {
    const client = this.requireAgent();
    const data = encodeFunctionData({
      abi: agentWalletAbi,
      functionName: "pay",
      args: [to, amount, memoRef(memo)],
    });
    return this.sendAndMeasure(client, { to: wallet, data });
  }

  /**
   * Agent: arbitrary policy-checked call from the wallet — the generic entry
   * point for interacting with SettlementModule, other agents, or any
   * allow-listed protocol.
   */
  async executeAgentAction(params: {
    wallet: Address;
    target: Address;
    data: Hex;
    value?: bigint;
    asOwner?: boolean; // owner path bypasses agent policy (e.g. approvals)
  }): Promise<TxResult> {
    const client = params.asOwner ? this.requireOwner() : this.requireAgent();
    const data = encodeFunctionData({
      abi: agentWalletAbi,
      functionName: "execute",
      args: [params.target, params.value ?? 0n, params.data],
    });
    return this.sendAndMeasure(client, { to: params.wallet, data });
  }

  /**
   * Owner: grant the SettlementModule a USDC allowance from the wallet.
   * Approvals are deliberately owner-only (the hot agent key cannot call the
   * USDC contract), so this is the one setup step per wallet.
   */
  async approveSettlement(wallet: Address, amount: bigint): Promise<TxResult> {
    return this.executeAgentAction({
      wallet,
      target: USDC_ADDRESS,
      data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [this.addresses.settlement, amount] }),
      asOwner: true,
    });
  }

  // -- settlement primitives ----------------------------------------------

  /** Agent: pay another agent through the module, getting a Receipt event. */
  async transferWithReceipt(wallet: Address, to: Address, amount: bigint, memo: string): Promise<TxResult & { receiptId?: Hex }> {
    const res = await this.executeAgentAction({
      wallet,
      target: this.addresses.settlement,
      data: encodeFunctionData({
        abi: settlementAbi,
        functionName: "transferWithReceipt",
        args: [to, amount, memoRef(memo)],
      }),
    });
    const receipt = await this.publicClient.getTransactionReceipt({ hash: res.hash });
    const [ev] = parseEventLogs({ abi: settlementAbi, eventName: "Receipt", logs: receipt.logs });
    return { ...res, receiptId: ev?.args.receiptId };
  }

  /** Agent: lock USDC in a conditional escrow for a payee. */
  async createEscrow(params: {
    wallet: Address;
    payee: Address;
    oracle: Address;
    amount: bigint;
    deadline: bigint;
    memo: string;
  }): Promise<TxResult & { escrowId?: bigint }> {
    const res = await this.executeAgentAction({
      wallet: params.wallet,
      target: this.addresses.settlement,
      data: encodeFunctionData({
        abi: settlementAbi,
        functionName: "createEscrow",
        args: [params.payee, params.oracle, params.amount, params.deadline, memoRef(params.memo)],
      }),
    });
    const receipt = await this.publicClient.getTransactionReceipt({ hash: res.hash });
    const [ev] = parseEventLogs({ abi: settlementAbi, eventName: "EscrowCreated", logs: receipt.logs });
    return { ...res, escrowId: ev?.args.id };
  }

  /** Payer signs a nanopayment voucher for cumulative spend on a tab. */
  async signTabVoucher(tabId: bigint, cumulative: bigint): Promise<Hex> {
    if (!this.ownerAccount) throw new Error("OWNER_PRIVATE_KEY not configured");
    const digest = await this.publicClient.readContract({
      address: this.addresses.settlement,
      abi: settlementAbi,
      functionName: "tabDigest",
      args: [tabId, cumulative],
    });
    // tabDigest already applies the EIP-191 prefix, so sign the raw hash.
    return this.ownerAccount.sign!({ hash: digest });
  }

  // -- history -------------------------------------------------------------

  /**
   * Reconstruct an agent wallet's transaction feed from its events.
   * Uses chunked getLogs from `fromBlock` (default: last ~5000 blocks).
   */
  async getAgentTransactions(wallet: Address, fromBlock?: bigint): Promise<AgentTxRecord[]> {
    const latest = await this.publicClient.getBlockNumber();
    const start = fromBlock ?? (latest > 5000n ? latest - 5000n : 0n);

    const logs = await this.publicClient.getLogs({
      address: wallet,
      events: agentWalletAbi.filter((i) => i.type === "event") as AbiEvent[],
      fromBlock: start,
      toBlock: latest,
    });

    const records: AgentTxRecord[] = [];
    for (const log of logs) {
      const base = { txHash: log.transactionHash!, blockNumber: log.blockNumber! };
      switch (log.eventName) {
        case "Payment":
          records.push({ kind: "payment", ...base, by: log.args.by, counterparty: log.args.to, amount: log.args.amount, memoRef: log.args.memoRef });
          break;
        case "Executed":
          records.push({ kind: "execution", ...base, by: log.args.by, counterparty: log.args.target, amount: log.args.usdcSpent });
          break;
        case "Deposit":
          records.push({ kind: "deposit", ...base, counterparty: log.args.from, amount: (log.args.amountNative18 ?? 0n) / 10n ** 12n });
          break;
        case "OwnerWithdrawal":
          records.push({ kind: "withdrawal", ...base, counterparty: log.args.to, amount: log.args.amount });
          break;
      }
    }
    return records.sort((a, b) => (a.blockNumber < b.blockNumber ? 1 : -1));
  }

  // -- registry ------------------------------------------------------------

  async registerAgent(wallet: Address, metadataURI: string, capabilities: bigint): Promise<TxResult> {
    const client = this.requireOwner();
    const data = encodeFunctionData({
      abi: registryAbi,
      functionName: "register",
      args: [wallet, metadataURI, capabilities],
    });
    return this.sendAndMeasure(client, { to: this.addresses.registry, data });
  }

  async heartbeat(wallet: Address): Promise<TxResult> {
    const client = this.requireOwner();
    const data = encodeFunctionData({ abi: registryAbi, functionName: "heartbeat", args: [wallet] });
    return this.sendAndMeasure(client, { to: this.addresses.registry, data });
  }
}
