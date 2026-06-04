// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/vrf/interfaces/VRFCoordinatorV2Interface.sol";

// 🌟 繼承 Ownable, ERC721 (發放憑證), VRFConsumerBaseV2 (接收真亂數)
contract Lottery is Ownable, ERC721URIStorage, VRFConsumerBaseV2 {

    // --- 區塊鏈與抽獎狀態 ---
    enum LotteryState { OPEN, CALCULATING }
    LotteryState public lotteryState;
    
    address[] public players;
    address public recentWinner;
    IERC20 public token;
    uint256 public ticketPrice = 10 * 10 ** 18; // 票價 10 點
    mapping(address => string) public addressToName;
    uint256 private _nextTokenId; // NFT 的編號

    // --- Chainlink VRF V2 設定 (Sepolia 測試網專用) ---
    VRFCoordinatorV2Interface COORDINATOR;
    uint64 s_subscriptionId;
    bytes32 keyHash = 0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c; // Sepolia 的 Gas 通道
    uint32 callbackGasLimit = 500000; // 開獎動作的 Gas 上限
    uint16 requestConfirmations = 3;
    uint32 numWords = 1; // 只需要 1 個亂數

    // 宣告事件，方便前端監聽
    event LotteryEnter(address indexed player, string name);
    event RequestedLotteryWinner(uint256 indexed requestId);
    event WinnerPicked(address indexed winner, uint256 prize, uint256 nftTokenId);

    // 🌟 建構子：需要傳入你的點數合約、Chainlink 訂閱 ID，以及 Coordinator 地址
    constructor(
        address 0xbAaD63068dd0773B068D51d708c450d1dF11309a,
        uint64 1071892835004247453641894617919687049361331859347414763821385736312855756692,
        address 0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625
    ) 
        ERC721("LotteryWinnerCertificate", "WINNER") // NFT 的名稱與代號
        VRFConsumerBaseV2(_vrfCoordinator) 
        Ownable(msg.sender) 
    {
        token = IERC20(_tokenAddress);
        COORDINATOR = VRFCoordinatorV2Interface(_vrfCoordinator);
        s_subscriptionId = _subscriptionId;
        lotteryState = LotteryState.OPEN;
    }

    // 🎟️ 參加抽獎
    function enterLottery(string memory _name) public {
        require(lotteryState == LotteryState.OPEN, "Lottery is currently calculating winner!");
        require(
            token.transferFrom(msg.sender, address(this), ticketPrice),
            "Token transfer failed. Check allowance or balance"
        );
        
        addressToName[msg.sender] = _name;
        players.push(msg.sender);
        
        emit LotteryEnter(msg.sender, _name);
    }

    // 👑 步驟一：店長觸發開獎，向 Chainlink 請求「真亂數」
    function pickWinner() public onlyOwner {
        require(lotteryState == LotteryState.OPEN, "Already calculating");
        require(players.length > 0, "No players");
        
        // 鎖定抽獎箱，不讓人在開獎期間買票
        lotteryState = LotteryState.CALCULATING;

        // 向 Chainlink 發送請求
        uint256 requestId = COORDINATOR.requestRandomWords(
            keyHash,
            s_subscriptionId,
            requestConfirmations,
            callbackGasLimit,
            numWords
        );
        
        emit RequestedLotteryWinner(requestId);
    }

    // 👑 步驟二：Chainlink 拿到亂數後，會「自動」呼叫這個函數來完成開獎
    function fulfillRandomWords(
        uint256 /* requestId */,
        uint256[] memory randomWords
    ) internal override {
        // 利用真亂數算出中獎者索引
        uint256 indexOfWinner = randomWords[0] % players.length;
        address winner = players[indexOfWinner];
        recentWinner = winner;

        uint256 prizePool = token.balanceOf(address(this));

        // 🛡️ CEI 原則：先改變內部狀態 (清空抽獎箱並重新開放)
        delete players;
        lotteryState = LotteryState.OPEN;

        // 💰 發送 ERC20 獎金
        if (prizePool > 0) {
            require(token.transfer(winner, prizePool), "Prize payout failed");
        }

        // 🏆 鑄造專屬 NFT 憑證給贏家
        uint256 tokenId = _nextTokenId++;
        _safeMint(winner, tokenId);
        
        // 🌟 已經完美換上你的 JSON CID！
        _setTokenURI(tokenId, "ipfs://bafkreiaddkhc3g346og65db5aqa2hcufjamhii2i4xs7u37soedtsmhdku");

        emit WinnerPicked(winner, prizePool, tokenId);
    }

    function getPlayers() public view returns (address[] memory) {
        return players;
    }
}