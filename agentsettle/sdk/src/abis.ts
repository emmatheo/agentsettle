import { parseAbi } from "viem";

/**
 * Human-readable ABIs (viem `parseAbi`). Kept in lock-step with the Solidity
 * sources in contracts/src — no build-artifact plumbing required, which keeps
 * the SDK usable straight from a git clone.
 */

export const erc20Abi = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);

export const agentWalletAbi = parseAbi([
  "struct Policy { uint128 dailyLimit; uint128 maxPerTx; uint64 expiry; bool active; }",
  "function owner() view returns (address)",
  "function agent() view returns (address)",
  "function policy() view returns (uint128 dailyLimit, uint128 maxPerTx, uint64 expiry, bool active)",
  "function spentToday() view returns (uint128)",
  "function dayStart() view returns (uint64)",
  "function allowedTarget(address) view returns (bool)",
  "function usdcBalance() view returns (uint256)",
  "function remainingToday() view returns (uint256)",
  "function setPolicy(Policy _policy)",
  "function setTarget(address target, bool allowed)",
  "function setAgent(address newAgent)",
  "function ownerWithdraw(address to, uint256 amount)",
  "function pay(address to, uint256 amount, bytes32 memoRef)",
  "function execute(address target, uint256 value, bytes data) returns (bytes)",
  "event Executed(address indexed by, address indexed target, uint256 value, uint256 usdcSpent, bytes4 selector)",
  "event Payment(address indexed by, address indexed to, uint256 amount, bytes32 memoRef)",
  "event PolicyUpdated(uint128 dailyLimit, uint128 maxPerTx, uint64 expiry, bool active)",
  "event TargetAllowed(address indexed target, bool allowed)",
  "event Deposit(address indexed from, uint256 amountNative18)",
  "event OwnerWithdrawal(address indexed to, uint256 amount)",
]);

export const factoryAbi = parseAbi([
  "struct Policy { uint128 dailyLimit; uint128 maxPerTx; uint64 expiry; bool active; }",
  "function implementation() view returns (address)",
  "function deployAgentWallet(address agent, Policy p, address[] targets) returns (address wallet)",
  "function walletsOf(address owner) view returns (address[])",
  "function totalWallets() view returns (uint256)",
  "function isAgentWallet(address) view returns (bool)",
  "event AgentWalletDeployed(address indexed wallet, address indexed owner, address indexed agent, uint128 dailyLimit, uint128 maxPerTx, uint64 expiry)",
]);

export const settlementAbi = parseAbi([
  "function createEscrow(address payee, address oracle, uint256 amount, uint64 deadline, bytes32 memo) returns (uint256 id)",
  "function releaseEscrow(uint256 id)",
  "function refundEscrow(uint256 id)",
  "function escrows(uint256) view returns (address payer, address payee, address oracle, uint128 amount, uint64 deadline, uint8 status)",
  "function openTab(address payee, uint256 deposit, uint64 expiry) returns (uint256 id)",
  "function tabDigest(uint256 id, uint256 cumulative) view returns (bytes32)",
  "function claimTab(uint256 id, uint256 cumulative, bytes sig)",
  "function closeTab(uint256 id)",
  "function tabs(uint256) view returns (address payer, address payee, uint128 deposit, uint128 claimed, uint64 expiry, bool open)",
  "function transferWithReceipt(address to, uint256 amount, bytes32 memo) returns (bytes32 receiptId)",
  "event EscrowCreated(uint256 indexed id, address indexed payer, address indexed payee, address oracle, uint256 amount, uint64 deadline, bytes32 memo)",
  "event EscrowReleased(uint256 indexed id, address indexed payee, uint256 amount)",
  "event EscrowRefunded(uint256 indexed id, address indexed payer, uint256 amount)",
  "event TabOpened(uint256 indexed id, address indexed payer, address indexed payee, uint256 deposit, uint64 expiry)",
  "event TabClaimed(uint256 indexed id, uint256 cumulative, uint256 paidOut)",
  "event TabClosed(uint256 indexed id, uint256 refunded)",
  "event Receipt(bytes32 indexed receiptId, address indexed from, address indexed to, uint256 amount, bytes32 memo, uint256 timestamp)",
]);

export const registryAbi = parseAbi([
  "function register(address wallet, string metadataURI, uint256 capabilities)",
  "function update(address wallet, string metadataURI, uint256 capabilities)",
  "function heartbeat(address wallet)",
  "function deactivate(address wallet)",
  "function agents(address) view returns (address owner, string metadataURI, uint256 capabilities, uint64 registeredAt, uint64 lastSeen, bool active)",
  "function totalAgents() view returns (uint256)",
  "function allAgents(uint256) view returns (address)",
  "function hasCapabilities(address wallet, uint256 mask) view returns (bool)",
  "event AgentRegistered(address indexed wallet, address indexed owner, uint256 capabilities, string metadataURI)",
  "event AgentHeartbeat(address indexed wallet, uint64 at)",
]);

/** CCTP V2 — just the functions the cross-chain example needs. */
export const tokenMessengerV2Abi = parseAbi([
  "function depositForBurn(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken, bytes32 destinationCaller, uint256 maxFee, uint32 minFinalityThreshold)",
]);

export const messageTransmitterV2Abi = parseAbi([
  "function receiveMessage(bytes message, bytes attestation) returns (bool)",
]);
