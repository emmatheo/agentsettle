// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";

/// @title AgentWallet — a policy-scoped smart contract wallet for an autonomous agent.
///
/// @notice Each AI agent gets its own AgentWallet, deployed as an EIP-1167 minimal
///         proxy by AgentWalletFactory. Two keys control it:
///
///           * `owner`  — the human/treasury cold key. Full control, no limits.
///           * `agent`  — the hot key the autonomous process signs with. Every
///                        action it takes is checked against an on-chain Policy:
///                        max spend per tx, rolling daily spend limit, an
///                        allow-list of callable targets, and a hard expiry
///                        after which the key is dead.
///
/// @dev  ARC-SPECIFIC DESIGN NOTES
///       1. USDC on Arc is the native asset AND an ERC-20 at 0x3600...0000,
///          sharing one underlying balance. We enforce spend limits by measuring
///          the ERC-20 `balanceOf` delta around every agent call — this single
///          measurement captures BOTH native-value sends and ERC-20 transfers,
///          which is only possible because of Arc's stablecoin-native model.
///       2. Arc reverts value transfers touching blocklisted addresses at
///          runtime. All transfer paths here bubble reverts up, so a blocked
///          counterparty can never silently eat funds.
///       3. Fees on Arc are dollar-denominated and predictable, so per-action
///          policy checks (a few thousand extra gas) cost a stable fraction of
///          a cent — cheap enough to run on every nanopayment.
contract AgentWallet {
    // ---------------------------------------------------------------------
    // Constants
    // ---------------------------------------------------------------------

    /// @notice Arc Testnet native-USDC ERC-20 facade (6 decimals).
    IERC20 public constant USDC = IERC20(0x3600000000000000000000000000000000000000);

    uint256 private constant DAY = 1 days;

    // ---------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------

    /// @notice Cold key with unrestricted control.
    address public owner;

    /// @notice Hot key used by the autonomous agent process.
    address public agent;

    /// @notice Agent authority policy. Amounts are 6-decimal USDC units.
    struct Policy {
        uint128 dailyLimit; // max USDC the agent may spend per rolling day
        uint128 maxPerTx;   // max USDC outflow in a single agent action
        uint64 expiry;      // unix time after which the agent key is inert
        bool active;        // master kill-switch for the agent key
    }

    Policy public policy;

    /// @notice USDC spent by the agent inside the current daily window.
    uint128 public spentToday;

    /// @notice Start of the current daily window.
    uint64 public dayStart;

    /// @notice Contracts/recipients the agent is allowed to touch.
    mapping(address => bool) public allowedTarget;

    bool private _initialized;
    uint256 private _lock; // 0 = unlocked, 1 = locked (cheap reentrancy guard)

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------

    event Initialized(address indexed owner, address indexed agent);
    event PolicyUpdated(uint128 dailyLimit, uint128 maxPerTx, uint64 expiry, bool active);
    event TargetAllowed(address indexed target, bool allowed);
    event AgentRotated(address indexed oldAgent, address indexed newAgent);
    event Executed(address indexed by, address indexed target, uint256 value, uint256 usdcSpent, bytes4 selector);
    event Payment(address indexed by, address indexed to, uint256 amount, bytes32 memoRef);
    event OwnerWithdrawal(address indexed to, uint256 amount);
    event Deposit(address indexed from, uint256 amountNative18);

    // ---------------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------------

    error AlreadyInitialized();
    error NotOwner();
    error NotAuthorized();
    error AgentDisabled();
    error AgentExpired();
    error TargetNotAllowed(address target);
    error UsdcTargetForbidden();
    error OverPerTxLimit(uint256 amount, uint256 maxPerTx);
    error OverDailyLimit(uint256 wouldBe, uint256 dailyLimit);
    error CallFailed();
    error TransferFailed();
    error Reentrancy();

    // ---------------------------------------------------------------------
    // Modifiers
    // ---------------------------------------------------------------------

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier nonReentrant() {
        if (_lock == 1) revert Reentrancy();
        _lock = 1;
        _;
        _lock = 0;
    }

    // ---------------------------------------------------------------------
    // Initialization (proxy pattern — no constructor state)
    // ---------------------------------------------------------------------

    /// @dev The canonical implementation bricks its own initializer; clones
    ///      start with fresh storage (constructor code never runs for them),
    ///      so only clones can ever be initialized.
    constructor() {
        _initialized = true;
    }

    /// @notice Called exactly once by the factory right after cloning.
    /// @param _owner   Cold key.
    /// @param _agent   Hot agent key.
    /// @param _policy  Initial spend policy.
    /// @param targets  Initial allow-listed targets for `execute`/`pay`.
    function initialize(
        address _owner,
        address _agent,
        Policy calldata _policy,
        address[] calldata targets
    ) external {
        if (_initialized) revert AlreadyInitialized();
        _initialized = true;

        owner = _owner;
        agent = _agent;
        policy = _policy;
        dayStart = uint64(block.timestamp);

        for (uint256 i = 0; i < targets.length; i++) {
            allowedTarget[targets[i]] = true;
            emit TargetAllowed(targets[i], true);
        }

        emit Initialized(_owner, _agent);
        emit PolicyUpdated(_policy.dailyLimit, _policy.maxPerTx, _policy.expiry, _policy.active);
    }

    /// @notice Accept native USDC deposits (e.g. straight from the Circle faucet).
    /// @dev    `msg.value` here is in 18-decimal native units; all accounting in
    ///         this contract reads the 6-decimal ERC-20 view instead.
    receive() external payable {
        emit Deposit(msg.sender, msg.value);
    }

    // ---------------------------------------------------------------------
    // Owner administration
    // ---------------------------------------------------------------------

    function setPolicy(Policy calldata _policy) external onlyOwner {
        policy = _policy;
        emit PolicyUpdated(_policy.dailyLimit, _policy.maxPerTx, _policy.expiry, _policy.active);
    }

    function setTarget(address target, bool allowed) external onlyOwner {
        allowedTarget[target] = allowed;
        emit TargetAllowed(target, allowed);
    }

    function setAgent(address newAgent) external onlyOwner {
        emit AgentRotated(agent, newAgent);
        agent = newAgent;
    }

    /// @notice Owner escape hatch — bypasses all agent limits by design.
    function ownerWithdraw(address to, uint256 amount) external onlyOwner nonReentrant {
        if (!USDC.transfer(to, amount)) revert TransferFailed();
        emit OwnerWithdrawal(to, amount);
    }

    // ---------------------------------------------------------------------
    // Agent actions
    // ---------------------------------------------------------------------

    /// @notice Direct USDC payment with an on-chain receipt reference.
    /// @param to      Recipient (must be allow-listed when called by the agent).
    /// @param amount  6-decimal USDC amount.
    /// @param memoRef Arbitrary 32-byte reference (invoice hash, job id, etc.).
    function pay(address to, uint256 amount, bytes32 memoRef) external nonReentrant {
        if (msg.sender == agent) {
            _checkAgentAuthority(to);
            _recordSpend(amount);
        } else if (msg.sender != owner) {
            revert NotAuthorized();
        }
        if (!USDC.transfer(to, amount)) revert TransferFailed();
        emit Payment(msg.sender, to, amount, memoRef);
    }

    /// @notice Arbitrary call from the wallet — how the agent talks to protocols
    ///         (SettlementModule escrows, tabs, DEXes, other agents' services).
    /// @dev    Spend accounting: we snapshot the wallet's USDC ERC-20 balance
    ///         before and after the call. Because native and ERC-20 USDC share
    ///         one balance on Arc, the delta captures every possible outflow in
    ///         a single check. The agent is barred from calling the USDC
    ///         contract itself so it cannot mint an `approve` that a third
    ///         party could drain from outside this accounting window.
    /// @param target Contract to call (must be allow-listed for the agent).
    /// @param value  Native value to forward, in 18-decimal native units.
    /// @param data   Calldata for the target.
    function execute(
        address target,
        uint256 value,
        bytes calldata data
    ) external nonReentrant returns (bytes memory) {
        bool byAgent = msg.sender == agent;
        if (!byAgent && msg.sender != owner) revert NotAuthorized();

        if (byAgent) {
            _checkAgentAuthority(target);
            if (target == address(USDC)) revert UsdcTargetForbidden();
        }

        uint256 before = USDC.balanceOf(address(this));

        (bool ok, bytes memory ret) = target.call{value: value}(data);
        if (!ok) {
            // Bubble the target's revert reason for easier off-chain debugging.
            assembly {
                revert(add(ret, 0x20), mload(ret))
            }
        }

        uint256 balanceAfter = USDC.balanceOf(address(this));
        uint256 spent = before > balanceAfter ? before - balanceAfter : 0;
        if (byAgent && spent > 0) {
            _recordSpend(spent);
        }

        emit Executed(msg.sender, target, value, spent, data.length >= 4 ? bytes4(data[:4]) : bytes4(0));
        return ret;
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    /// @notice Wallet balance in 6-decimal USDC units.
    function usdcBalance() external view returns (uint256) {
        return USDC.balanceOf(address(this));
    }

    /// @notice Remaining agent allowance in the current daily window.
    function remainingToday() external view returns (uint256) {
        if (block.timestamp >= uint256(dayStart) + DAY) {
            return policy.dailyLimit; // window has rolled; nothing spent yet
        }
        return policy.dailyLimit > spentToday ? policy.dailyLimit - spentToday : 0;
    }

    // ---------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------

    function _checkAgentAuthority(address target) internal view {
        if (!policy.active) revert AgentDisabled();
        if (block.timestamp >= policy.expiry) revert AgentExpired();
        if (!allowedTarget[target]) revert TargetNotAllowed(target);
    }

    function _recordSpend(uint256 amount) internal {
        // Roll the daily window lazily — no keeper needed.
        if (block.timestamp >= uint256(dayStart) + DAY) {
            dayStart = uint64(block.timestamp);
            spentToday = 0;
        }
        if (amount > policy.maxPerTx) revert OverPerTxLimit(amount, policy.maxPerTx);
        uint256 wouldBe = uint256(spentToday) + amount;
        if (wouldBe > policy.dailyLimit) revert OverDailyLimit(wouldBe, policy.dailyLimit);
        spentToday = uint128(wouldBe);
    }
}
