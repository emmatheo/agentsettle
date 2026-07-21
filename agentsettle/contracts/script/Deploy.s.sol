// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {AgentWalletFactory} from "../src/AgentWalletFactory.sol";
import {SettlementModule} from "../src/SettlementModule.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";

/// @notice Deploys the full AgentSettle stack to Arc Testnet.
///
/// Usage:
///   export PRIVATE_KEY=0x...            # funded with USDC from faucet.circle.com
///   forge script script/Deploy.s.sol \
///     --rpc-url arc_testnet --broadcast -vvv
///
/// Gas on Arc is paid in USDC. The whole stack deploys for well under $0.10 of
/// testnet USDC. Record the three logged addresses into sdk/.env, agent/.env
/// and web/.env.local.
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);

        AgentWalletFactory factory = new AgentWalletFactory();
        SettlementModule settlement = new SettlementModule();
        AgentRegistry registry = new AgentRegistry();

        vm.stopBroadcast();

        console2.log("== AgentSettle deployed to Arc Testnet (chain 5042002) ==");
        console2.log("AgentWalletFactory :", address(factory));
        console2.log("  implementation   :", factory.implementation());
        console2.log("SettlementModule   :", address(settlement));
        console2.log("AgentRegistry      :", address(registry));
        console2.log("Explorer           : https://testnet.arcscan.app");
    }
}
