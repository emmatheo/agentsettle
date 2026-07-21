// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgentWallet} from "../src/AgentWallet.sol";
import {AgentWalletFactory} from "../src/AgentWalletFactory.sol";
import {SettlementModule} from "../src/SettlementModule.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {MockUSDC} from "./MockUSDC.sol";

contract AgentSettleTest is Test {
    address constant USDC_ADDR = 0x3600000000000000000000000000000000000000;

    MockUSDC usdc;
    AgentWalletFactory factory;
    SettlementModule settlement;
    AgentRegistry registry;

    address owner;
    uint256 ownerPk;
    address agentKey;
    uint256 agentPk;
    address payee = address(0xBEEF);
    address oracle = address(0x0AC1E);

    AgentWallet wallet;

    function setUp() public {
        // Plant the mock at Arc's native-USDC system address so production
        // bytecode (which hard-codes 0x3600...0000) runs unmodified locally.
        deployCodeTo("MockUSDC.sol:MockUSDC", USDC_ADDR);
        usdc = MockUSDC(USDC_ADDR);

        (owner, ownerPk) = makeAddrAndKey("owner");
        (agentKey, agentPk) = makeAddrAndKey("agent");

        factory = new AgentWalletFactory();
        settlement = new SettlementModule();
        registry = new AgentRegistry();

        // Deploy a wallet: $50/day, $10/tx, 7-day agent authority.
        address[] memory targets = new address[](2);
        targets[0] = address(settlement);
        targets[1] = payee;

        vm.prank(owner);
        wallet = AgentWallet(
            payable(
                factory.deployAgentWallet(
                    agentKey,
                    AgentWallet.Policy({
                        dailyLimit: 50_000_000, // 50 USDC (6 decimals)
                        maxPerTx: 10_000_000,   // 10 USDC
                        expiry: uint64(block.timestamp + 7 days),
                        active: true
                    }),
                    targets
                )
            )
        );

        usdc.mint(address(wallet), 100_000_000); // 100 USDC
    }

    // -------------------------------------------------------------------
    // AgentWallet policy enforcement
    // -------------------------------------------------------------------

    function test_agentPayWithinLimits() public {
        vm.prank(agentKey);
        wallet.pay(payee, 5_000_000, keccak256("invoice-1"));
        assertEq(usdc.balanceOf(payee), 5_000_000);
        assertEq(wallet.spentToday(), 5_000_000);
    }

    function test_agentPayRevertsOverPerTxLimit() public {
        vm.prank(agentKey);
        vm.expectRevert(
            abi.encodeWithSelector(AgentWallet.OverPerTxLimit.selector, 10_000_001, 10_000_000)
        );
        wallet.pay(payee, 10_000_001, bytes32(0));
    }

    function test_agentDailyLimitEnforcedThenRolls() public {
        // 5 payments x 10 USDC = 50 USDC hits the daily cap.
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(agentKey);
            wallet.pay(payee, 10_000_000, bytes32(i));
        }
        vm.prank(agentKey);
        vm.expectRevert(
            abi.encodeWithSelector(AgentWallet.OverDailyLimit.selector, 60_000_000, 50_000_000)
        );
        wallet.pay(payee, 10_000_000, bytes32(0));

        // Window rolls after a day; spending resumes.
        vm.warp(block.timestamp + 1 days);
        vm.prank(agentKey);
        wallet.pay(payee, 10_000_000, bytes32(0));
        assertEq(wallet.spentToday(), 10_000_000);
    }

    function test_agentBlockedOnDisallowedTarget() public {
        vm.prank(agentKey);
        vm.expectRevert(abi.encodeWithSelector(AgentWallet.TargetNotAllowed.selector, address(0xDEAD)));
        wallet.pay(address(0xDEAD), 1, bytes32(0));
    }

    function test_agentCannotCallUsdcDirectly() public {
        vm.prank(owner);
        wallet.setTarget(USDC_ADDR, true); // even if allow-listed by mistake…
        vm.prank(agentKey);
        vm.expectRevert(AgentWallet.UsdcTargetForbidden.selector);
        wallet.execute(USDC_ADDR, 0, abi.encodeCall(MockUSDC.approve, (address(0xDEAD), 1e12)));
    }

    function test_agentExpiryKillsAuthority() public {
        vm.warp(block.timestamp + 8 days);
        vm.prank(agentKey);
        vm.expectRevert(AgentWallet.AgentExpired.selector);
        wallet.pay(payee, 1, bytes32(0));
    }

    function test_executeDeltaAccounting() public {
        // Approve settlement then create an escrow through execute(); the USDC
        // outflow must be counted against the agent's daily budget.
        vm.prank(owner);
        wallet.execute(USDC_ADDR, 0, abi.encodeCall(MockUSDC.approve, (address(settlement), 8_000_000)));

        vm.prank(agentKey);
        wallet.execute(
            address(settlement),
            0,
            abi.encodeCall(
                SettlementModule.createEscrow,
                (payee, oracle, 8_000_000, uint64(block.timestamp + 1 hours), keccak256("job-42"))
            )
        );
        assertEq(wallet.spentToday(), 8_000_000);
    }

    function test_ownerBypassesLimits() public {
        vm.prank(owner);
        wallet.pay(address(0xDEAD), 90_000_000, bytes32(0)); // over both limits, fine
        assertEq(usdc.balanceOf(address(0xDEAD)), 90_000_000);
        assertEq(wallet.spentToday(), 0);
    }

    // -------------------------------------------------------------------
    // SettlementModule: escrow
    // -------------------------------------------------------------------

    function _fundAndApprove(address who, uint256 amount) internal {
        usdc.mint(who, amount);
        vm.prank(who);
        usdc.approve(address(settlement), amount);
    }

    function test_escrowOracleRelease() public {
        _fundAndApprove(address(this), 20_000_000);
        uint256 id = settlement.createEscrow(payee, oracle, 20_000_000, uint64(block.timestamp + 1 days), bytes32(0));

        vm.prank(oracle);
        settlement.releaseEscrow(id);
        assertEq(usdc.balanceOf(payee), 20_000_000);
    }

    function test_escrowRefundAfterDeadline() public {
        _fundAndApprove(address(this), 20_000_000);
        uint256 id = settlement.createEscrow(payee, oracle, 20_000_000, uint64(block.timestamp + 1 days), bytes32(0));

        vm.expectRevert(SettlementModule.DeadlineNotReached.selector);
        settlement.refundEscrow(id);

        vm.warp(block.timestamp + 1 days + 1);
        settlement.refundEscrow(id);
        assertEq(usdc.balanceOf(address(this)), 20_000_000);
    }

    // -------------------------------------------------------------------
    // SettlementModule: nanopayment tabs
    // -------------------------------------------------------------------

    function test_tabClaimAndClose() public {
        _fundAndApprove(owner, 10_000_000);
        vm.prank(owner);
        uint256 id = settlement.openTab(payee, 10_000_000, uint64(block.timestamp + 1 hours));

        // Payer signs cumulative 3 USDC, payee claims.
        bytes32 digest = settlement.tabDigest(id, 3_000_000);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ownerPk, digest);
        vm.prank(payee);
        settlement.claimTab(id, 3_000_000, abi.encodePacked(r, s, v));
        assertEq(usdc.balanceOf(payee), 3_000_000);

        // Later voucher for cumulative 7 USDC pays only the 4 USDC delta.
        digest = settlement.tabDigest(id, 7_000_000);
        (v, r, s) = vm.sign(ownerPk, digest);
        vm.prank(payee);
        settlement.claimTab(id, 7_000_000, abi.encodePacked(r, s, v));
        assertEq(usdc.balanceOf(payee), 7_000_000);

        // Payer reclaims the unclaimed 3 USDC after expiry.
        vm.warp(block.timestamp + 1 hours + 1);
        vm.prank(owner);
        settlement.closeTab(id);
        assertEq(usdc.balanceOf(owner), 3_000_000);
    }

    function test_tabRejectsForgedVoucher() public {
        _fundAndApprove(owner, 10_000_000);
        vm.prank(owner);
        uint256 id = settlement.openTab(payee, 10_000_000, uint64(block.timestamp + 1 hours));

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(agentPk, settlement.tabDigest(id, 5_000_000));
        vm.prank(payee);
        vm.expectRevert(SettlementModule.BadSignature.selector);
        settlement.claimTab(id, 5_000_000, abi.encodePacked(r, s, v));
    }

    // -------------------------------------------------------------------
    // SettlementModule: receipts + Registry
    // -------------------------------------------------------------------

    function test_transferWithReceipt() public {
        _fundAndApprove(address(this), 1_000_000);
        bytes32 receiptId = settlement.transferWithReceipt(payee, 1_000_000, keccak256("api-call-777"));
        assertTrue(receiptId != bytes32(0));
        assertEq(usdc.balanceOf(payee), 1_000_000);
    }

    function test_registryLifecycle() public {
        vm.prank(owner);
        registry.register(address(wallet), "ipfs://agent-profile", 1 | 4); // payments + rebalancer
        assertTrue(registry.hasCapabilities(address(wallet), 4));
        assertFalse(registry.hasCapabilities(address(wallet), 2));

        vm.prank(owner);
        registry.heartbeat(address(wallet));

        vm.prank(owner);
        registry.deactivate(address(wallet));
        assertFalse(registry.hasCapabilities(address(wallet), 4));
    }
}
