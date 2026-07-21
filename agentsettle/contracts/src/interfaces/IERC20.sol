// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IERC20 — minimal interface for Arc's native USDC ERC-20 facade.
/// @notice On Arc, USDC is the NATIVE asset (used for gas) and simultaneously
///         exposes an ERC-20 interface at 0x3600...0000. Both views share one
///         underlying balance ("stablecoin native model"). Per Arc docs, apps
///         should read balances and move funds exclusively through this 6-decimal
///         ERC-20 interface to avoid mixing 18-decimal native units with
///         6-decimal ERC-20 units.
interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function decimals() external view returns (uint8);

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}
