// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";

/// @title SettlementModule — reusable machine-to-machine settlement primitives.
///
/// @notice Three primitives every agent economy needs, in one module:
///
///   1. CONDITIONAL ESCROW — payer locks USDC for a payee; a designated oracle
///      releases it on proof-of-work-done, or the payer reclaims after the
///      deadline. Arc's sub-second deterministic finality means "released" is
///      final the moment the tx lands — no reorg window, so agents can hand
///      over deliverables the same second they see the event.
///
///   2. NANOPAYMENT TABS — a payer deposits once, then streams work off-chain
///      by signing monotonically increasing cumulative amounts. The payee
///      settles the tab in ONE on-chain claim. With Arc's flat dollar fees a
///      claim costs under a cent, so tabs are viable even at cent-scale totals.
///
///   3. ATOMIC TRANSFER WITH RECEIPT — a plain transfer that emits a unique
///      receipt id binding (from, to, amount, memo, time) so both agents hold
///      the same verifiable proof of settlement.
///
/// @dev  All amounts are 6-decimal USDC via Arc's native ERC-20 facade.
///       Callers (typically AgentWallets) must `approve` this module first —
///       from an AgentWallet that approval is an owner-level `execute`, keeping
///       the hot agent key unable to grant allowances.
contract SettlementModule {
    IERC20 public constant USDC = IERC20(0x3600000000000000000000000000000000000000);

    // =====================================================================
    // 1. Conditional escrow
    // =====================================================================

    enum EscrowStatus {
        None,
        Open,
        Released,
        Refunded
    }

    struct Escrow {
        address payer;
        address payee;
        address oracle;   // address allowed to attest completion
        uint128 amount;   // 6-decimal USDC
        uint64 deadline;  // after this, payer may reclaim
        EscrowStatus status;
    }

    uint256 public escrowCount;
    mapping(uint256 => Escrow) public escrows;

    event EscrowCreated(
        uint256 indexed id,
        address indexed payer,
        address indexed payee,
        address oracle,
        uint256 amount,
        uint64 deadline,
        bytes32 memo
    );
    event EscrowReleased(uint256 indexed id, address indexed payee, uint256 amount);
    event EscrowRefunded(uint256 indexed id, address indexed payer, uint256 amount);

    error EscrowNotOpen();
    error NotOracle();
    error DeadlineNotReached();
    error DeadlinePassed();
    error ZeroAmount();
    error TransferFailed();

    /// @notice Lock `amount` USDC for `payee`, releasable by `oracle` until
    ///         `deadline`, refundable to the payer afterwards.
    function createEscrow(
        address payee,
        address oracle,
        uint256 amount,
        uint64 deadline,
        bytes32 memo
    ) external returns (uint256 id) {
        if (amount == 0) revert ZeroAmount();
        if (deadline <= block.timestamp) revert DeadlinePassed();
        if (!USDC.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();

        id = ++escrowCount;
        escrows[id] = Escrow({
            payer: msg.sender,
            payee: payee,
            oracle: oracle,
            amount: uint128(amount),
            deadline: deadline,
            status: EscrowStatus.Open
        });

        emit EscrowCreated(id, msg.sender, payee, oracle, amount, deadline, memo);
    }

    /// @notice Oracle attests the condition was met → funds go to the payee.
    function releaseEscrow(uint256 id) external {
        Escrow storage e = escrows[id];
        if (e.status != EscrowStatus.Open) revert EscrowNotOpen();
        if (msg.sender != e.oracle) revert NotOracle();
        if (block.timestamp > e.deadline) revert DeadlinePassed();

        e.status = EscrowStatus.Released;
        if (!USDC.transfer(e.payee, e.amount)) revert TransferFailed();
        emit EscrowReleased(id, e.payee, e.amount);
    }

    /// @notice After the deadline with no release, anyone may trigger the
    ///         refund back to the payer (agents can self-serve their refunds).
    function refundEscrow(uint256 id) external {
        Escrow storage e = escrows[id];
        if (e.status != EscrowStatus.Open) revert EscrowNotOpen();
        if (block.timestamp <= e.deadline) revert DeadlineNotReached();

        e.status = EscrowStatus.Refunded;
        if (!USDC.transfer(e.payer, e.amount)) revert TransferFailed();
        emit EscrowRefunded(id, e.payer, e.amount);
    }

    // =====================================================================
    // 2. Nanopayment tabs (single-deposit micropayment channel)
    // =====================================================================

    struct Tab {
        address payer;
        address payee;
        uint128 deposit;  // total USDC locked
        uint128 claimed;  // cumulative USDC already paid out
        uint64 expiry;    // after this, payer may close and reclaim remainder
        bool open;
    }

    uint256 public tabCount;
    mapping(uint256 => Tab) public tabs;

    event TabOpened(uint256 indexed id, address indexed payer, address indexed payee, uint256 deposit, uint64 expiry);
    event TabClaimed(uint256 indexed id, uint256 cumulative, uint256 paidOut);
    event TabClosed(uint256 indexed id, uint256 refunded);

    error TabNotOpen();
    error NotTabPayer();
    error NotTabPayee();
    error TabNotExpired();
    error BadSignature();
    error NothingToClaim();
    error OverDeposit();

    /// @notice Open a tab: lock `deposit` USDC that `payee` can claim against
    ///         with signed vouchers until `expiry`.
    function openTab(address payee, uint256 deposit, uint64 expiry) external returns (uint256 id) {
        if (deposit == 0) revert ZeroAmount();
        if (expiry <= block.timestamp) revert DeadlinePassed();
        if (!USDC.transferFrom(msg.sender, address(this), deposit)) revert TransferFailed();

        id = ++tabCount;
        tabs[id] = Tab({
            payer: msg.sender,
            payee: payee,
            deposit: uint128(deposit),
            claimed: 0,
            expiry: expiry,
            open: true
        });

        emit TabOpened(id, msg.sender, payee, deposit, expiry);
    }

    /// @notice The digest the payer signs off-chain for a cumulative amount.
    ///         Bound to this contract + chain id + tab id, so a voucher can
    ///         never be replayed elsewhere. Monotonic cumulative amounts mean
    ///         the payee always submits only the latest voucher.
    function tabDigest(uint256 id, uint256 cumulative) public view returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n32",
                keccak256(abi.encode(address(this), block.chainid, id, cumulative))
            )
        );
    }

    /// @notice Payee settles the tab up to `cumulative` with the payer's
    ///         signature. Can be called repeatedly as work progresses; each
    ///         claim pays out only the delta since the last claim.
    function claimTab(uint256 id, uint256 cumulative, bytes calldata sig) external {
        Tab storage t = tabs[id];
        if (!t.open) revert TabNotOpen();
        if (msg.sender != t.payee) revert NotTabPayee();
        if (cumulative > t.deposit) revert OverDeposit();
        if (cumulative <= t.claimed) revert NothingToClaim();

        if (_recover(tabDigest(id, cumulative), sig) != t.payer) revert BadSignature();

        uint256 delta = cumulative - t.claimed;
        t.claimed = uint128(cumulative);

        if (!USDC.transfer(t.payee, delta)) revert TransferFailed();
        emit TabClaimed(id, cumulative, delta);
    }

    /// @notice After expiry the payer closes the tab and reclaims whatever the
    ///         payee never claimed.
    function closeTab(uint256 id) external {
        Tab storage t = tabs[id];
        if (!t.open) revert TabNotOpen();
        if (msg.sender != t.payer) revert NotTabPayer();
        if (block.timestamp <= t.expiry) revert TabNotExpired();

        t.open = false;
        uint256 refund = uint256(t.deposit) - t.claimed;
        if (refund > 0) {
            if (!USDC.transfer(t.payer, refund)) revert TransferFailed();
        }
        emit TabClosed(id, refund);
    }

    // =====================================================================
    // 3. Atomic M2M transfer with receipt
    // =====================================================================

    uint256 private _receiptNonce;

    event Receipt(
        bytes32 indexed receiptId,
        address indexed from,
        address indexed to,
        uint256 amount,
        bytes32 memo,
        uint256 timestamp
    );

    /// @notice Pull `amount` USDC from the caller to `to` and emit a globally
    ///         unique receipt. Both sides index the `Receipt` event as their
    ///         proof of settlement — on Arc it is final sub-second.
    function transferWithReceipt(address to, uint256 amount, bytes32 memo) external returns (bytes32 receiptId) {
        if (amount == 0) revert ZeroAmount();
        if (!USDC.transferFrom(msg.sender, to, amount)) revert TransferFailed();

        receiptId = keccak256(
            abi.encode(block.chainid, address(this), ++_receiptNonce, msg.sender, to, amount, memo)
        );
        emit Receipt(receiptId, msg.sender, to, amount, memo, block.timestamp);
    }

    // =====================================================================
    // Internals
    // =====================================================================

    /// @dev Minimal ECDSA recovery with s-malleability guard (EIP-2).
    function _recover(bytes32 digest, bytes calldata sig) internal pure returns (address) {
        if (sig.length != 65) revert BadSignature();
        bytes32 r = bytes32(sig[0:32]);
        bytes32 s = bytes32(sig[32:64]);
        uint8 v = uint8(sig[64]);
        if (v < 27) v += 27;
        if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) {
            revert BadSignature();
        }
        address signer = ecrecover(digest, v, r, s);
        if (signer == address(0)) revert BadSignature();
        return signer;
    }
}
