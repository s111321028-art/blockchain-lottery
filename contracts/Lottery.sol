// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol"; 

contract Lottery is Ownable {

    // --- 狀態變數區 (統一把變數放最上面) ---
    address[] public players;
    address public winner;
    IERC20 public token; 
    uint256 public ticketPrice = 10 * 10 ** 18; // 票價 10 點
    
    // 🌟 實名制映射：用來紀錄「錢包地址」對應的「玩家名字」
    mapping(address => string) public addressToName;

    constructor(address tokenAddress) Ownable(msg.sender) {
        token = IERC20(tokenAddress);
    }

    // --- 核心功能區 ---

    // 🎟️ 參加抽獎（需傳入玩家名字，無限購買、確實扣款）
    function enterLottery(string memory _name) public {
        // 1. 執行真正扣款
        require(
            token.transferFrom(msg.sender, address(this), ticketPrice),
            "Token transfer failed. Check allowance or balance"
        );
        
        // 2. 紀錄名字與地址的關聯
        addressToName[msg.sender] = _name;
        
        // 3. 把地址加進抽獎箱 (買幾次就加幾次，中獎機率自動倍增)
        players.push(msg.sender);
    }

    // 👑 只有 owner (店長) 可以開獎
    function pickWinner() public onlyOwner {
        require(players.length > 0, "No players");

        // 隨機抽出贏家
        uint index = uint(
            keccak256(abi.encodePacked(block.timestamp, block.prevrandao))
        ) % players.length;

        winner = players[index];

        // 結算獎金池：把合約裡收到的所有彩券錢，全數轉給這位幸運兒！
        uint256 prizePool = token.balanceOf(address(this));
        if (prizePool > 0) {
            require(token.transfer(winner, prizePool), "Prize payout failed");
        }

        // 開獎完畢，直接清空陣列，準備下一輪
        delete players;
    }

    // 取得所有參與者的地址名單
    function getPlayers() public view returns (address[] memory) {
        return players;
    }
}