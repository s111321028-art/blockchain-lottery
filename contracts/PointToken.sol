// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// 1. 引入標準庫 (Hardhat 環境下可用)
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// 2. 繼承 ERC20 與 Ownable
contract PointToken is ERC20, Ownable {

    // 3. 在建構子中初始化，並將部署者 (msg.sender) 設為老闆
    constructor() ERC20("PointToken", "PTK") Ownable(msg.sender) {}

    // 4. 加入 onlyOwner 修飾子，確保只有老闆能印點數
    function mint(address to, uint256 amount) public onlyOwner {
        // 注意：ERC20 標準是用 _mint 函式，且單位通常包含 18 位小數
        _mint(to, amount);
    }
    
    // 注意：ERC20 已經內建 balanceOf 功能，不需要重複寫
}