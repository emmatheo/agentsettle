// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title AgentRegistry — lightweight on-chain directory of agents.
///
/// @notice Agents (or their owners) register a wallet address with a metadata
///         URI and a capability bitmap so other agents can discover
///         counterparties on-chain. Capabilities are app-defined bit flags,
///         e.g. 1 = payments, 2 = data-oracle, 4 = rebalancer, 8 = escrow-arbiter.
///
/// @dev    Deliberately minimal: discovery + liveness signal only. Reputation
///         and richer identity can layer on later (Arc's docs point at
///         ERC-8004 for full agent identity; this registry is the
///         hackathon-scoped subset that the demo actually exercises).
contract AgentRegistry {
    struct AgentInfo {
        address owner;        // who may update/unregister this entry
        string metadataURI;   // off-chain profile (name, endpoint, pricing…)
        uint256 capabilities; // bitmap of app-defined capability flags
        uint64 registeredAt;
        uint64 lastSeen;      // heartbeat timestamp
        bool active;
    }

    /// @notice agent wallet address → info
    mapping(address => AgentInfo) public agents;

    /// @notice Enumerable list of every wallet ever registered.
    address[] public allAgents;

    event AgentRegistered(address indexed wallet, address indexed owner, uint256 capabilities, string metadataURI);
    event AgentUpdated(address indexed wallet, uint256 capabilities, string metadataURI);
    event AgentHeartbeat(address indexed wallet, uint64 at);
    event AgentDeactivated(address indexed wallet);

    error AlreadyRegistered();
    error NotRegistered();
    error NotEntryOwner();

    /// @notice Register `wallet` as an agent. Caller becomes the entry owner.
    ///         The agent wallet itself may self-register via `execute`.
    function register(address wallet, string calldata metadataURI, uint256 capabilities) external {
        if (agents[wallet].registeredAt != 0) revert AlreadyRegistered();

        agents[wallet] = AgentInfo({
            owner: msg.sender,
            metadataURI: metadataURI,
            capabilities: capabilities,
            registeredAt: uint64(block.timestamp),
            lastSeen: uint64(block.timestamp),
            active: true
        });
        allAgents.push(wallet);

        emit AgentRegistered(wallet, msg.sender, capabilities, metadataURI);
    }

    function update(address wallet, string calldata metadataURI, uint256 capabilities) external {
        AgentInfo storage a = _ownedEntry(wallet);
        a.metadataURI = metadataURI;
        a.capabilities = capabilities;
        emit AgentUpdated(wallet, capabilities, metadataURI);
    }

    /// @notice Liveness ping — the demo agent calls this each loop so the
    ///         dashboard can show which agents are actually running.
    function heartbeat(address wallet) external {
        AgentInfo storage a = _ownedEntry(wallet);
        a.lastSeen = uint64(block.timestamp);
        emit AgentHeartbeat(wallet, a.lastSeen);
    }

    function deactivate(address wallet) external {
        AgentInfo storage a = _ownedEntry(wallet);
        a.active = false;
        emit AgentDeactivated(wallet);
    }

    /// @notice Total number of registered agents.
    function totalAgents() external view returns (uint256) {
        return allAgents.length;
    }

    /// @notice True if `wallet` is active and advertises every bit in `mask`.
    function hasCapabilities(address wallet, uint256 mask) external view returns (bool) {
        AgentInfo storage a = agents[wallet];
        return a.active && (a.capabilities & mask) == mask;
    }

    function _ownedEntry(address wallet) internal view returns (AgentInfo storage a) {
        a = agents[wallet];
        if (a.registeredAt == 0) revert NotRegistered();
        // The entry owner OR the agent wallet itself (acting through execute)
        // may manage the entry.
        if (msg.sender != a.owner && msg.sender != wallet) revert NotEntryOwner();
    }
}
