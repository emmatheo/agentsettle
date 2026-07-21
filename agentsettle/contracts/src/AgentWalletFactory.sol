// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AgentWallet} from "./AgentWallet.sol";

/// @title AgentWalletFactory — deploys per-agent smart contract wallets.
///
/// @notice Uses EIP-1167 minimal proxies over a single AgentWallet
///         implementation. On Arc this matters twice over: deployment gas is
///         paid in USDC, so a clone costs a predictable fraction of a cent —
///         cheap enough that spinning up a wallet per agent (or per task!) is
///         an economically sane pattern rather than a luxury.
contract AgentWalletFactory {
    /// @notice Canonical AgentWallet logic contract all clones delegate to.
    address public immutable implementation;

    /// @notice Every wallet ever deployed, for enumeration.
    address[] public allWallets;

    /// @notice Wallets grouped by owner (cold key).
    mapping(address => address[]) private _walletsOf;

    /// @notice Quick membership check: was this address deployed by us?
    mapping(address => bool) public isAgentWallet;

    event AgentWalletDeployed(
        address indexed wallet,
        address indexed owner,
        address indexed agent,
        uint128 dailyLimit,
        uint128 maxPerTx,
        uint64 expiry
    );

    error CloneFailed();

    constructor() {
        implementation = address(new AgentWallet());
    }

    /// @notice Deploy and initialize a new AgentWallet in one transaction.
    /// @param agent    Hot key of the autonomous agent process.
    /// @param p        Initial spend policy (6-decimal USDC amounts).
    /// @param targets  Initial allow-listed call/pay targets.
    /// @return wallet  Address of the freshly deployed wallet.
    function deployAgentWallet(
        address agent,
        AgentWallet.Policy calldata p,
        address[] calldata targets
    ) external returns (address wallet) {
        wallet = _clone(implementation);
        AgentWallet(payable(wallet)).initialize(msg.sender, agent, p, targets);

        allWallets.push(wallet);
        _walletsOf[msg.sender].push(wallet);
        isAgentWallet[wallet] = true;

        emit AgentWalletDeployed(wallet, msg.sender, agent, p.dailyLimit, p.maxPerTx, p.expiry);
    }

    /// @notice All wallets owned by `owner`.
    function walletsOf(address owner) external view returns (address[] memory) {
        return _walletsOf[owner];
    }

    /// @notice Total wallets ever deployed.
    function totalWallets() external view returns (uint256) {
        return allWallets.length;
    }

    /// @dev Standard EIP-1167 minimal proxy creation (inlined so the repo has
    ///      zero external dependencies — one `forge build`, no submodules).
    function _clone(address impl) internal returns (address instance) {
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, 0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000)
            mstore(add(ptr, 0x14), shl(0x60, impl))
            mstore(add(ptr, 0x28), 0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000)
            instance := create(0, ptr, 0x37)
        }
        if (instance == address(0)) revert CloneFailed();
    }
}
