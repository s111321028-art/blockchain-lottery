import 'dotenv/config'; // 自動載入 .env
import express from 'express';
import cors from 'cors';
import { ethers } from 'ethers';
import pg from 'pg';
const { Pool } = pg;

const app = express();
app.use(cors());
app.use(express.json());

console.log("測試讀取 RPC_URL:", process.env.SEPOLIA_RPC_URL);

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Supabase 連線必備安全設定
});
// --- 1. 初始化區塊鏈連線 ---
const provider = new ethers.WebSocketProvider(process.env.SEPOLIA_RPC_URL);
const adminWallet = new ethers.Wallet(process.env.SEPOLIA_PRIVATE_KEY, provider);

const abi = [
    "function mint(address to, uint256 amount) public",
    "function balanceOf(address account) public view returns (uint256)"
];
const lotteryAbi = [
    "function getPlayers() public view returns (address[])",
    "function requestWinner() public",
    "event WinnerPicked(address indexed winner, uint256 winningNumber, uint256 tokenId)"
];

const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, abi, adminWallet);
const lotteryContract = new ethers.Contract(process.env.LOTTERY_ADDRESS, lotteryAbi, adminWallet);

app.post('/api/reward', async (req, res) => {
    // 現在前端傳來的是 userAddress 和掃描到的 qrData
    const { userAddress, qrData } = req.body;

    if (!userAddress || !qrData) {
        return res.status(400).json({ error: "參數不足" });
    }

    try {
        // 1. 拆解 QR Code 資料
        // 格式: itemId | reward | timestamp | nonce | signature
        const [itemId, rewardStr, timestampStr, nonce, signature] = qrData.split('|');
        const reward = parseInt(rewardStr);
        const timestamp = parseInt(timestampStr);

        // 2. 安全檢查：時間戳記是否過期？ (這裡設定 QR Code 產出後 5 分鐘內有效)
        const now = Math.floor(Date.now() / 1000);
        if (now - timestamp > 300) {
            return res.status(400).json({ error: "此 QR Code 已過期，請店家重新產生" });
        }

        // 3. 安全檢查：數位簽章驗證 (核心防偽機制)
        // 重新組合當時簽名的原文
        const originalMessage = `${itemId}|${reward}|${timestamp}|${nonce}`;
        
        // 透過 ethers.js 反向推導出「是哪個地址簽了這個名」
        const recoveredAddress = ethers.verifyMessage(originalMessage, signature);

        // 如果推導出來的地址不是店長的錢包，代表有人自己偽造了字串！
        if (recoveredAddress !== adminWallet.address) {
            console.log("⚠️ 偵測到偽造的 QR Code！");
            return res.status(403).json({ error: "無效的 QR Code (簽章錯誤)" });
        }

        console.log(`✅ 驗證成功！準備發放 ${reward} 點給 ${userAddress} (商品: ${itemId})`);

        // 4. 通過所有檢查，呼叫智能合約發放點數
        const tx = await contract.mint(userAddress, reward);
        const receipt = await tx.wait();

        res.json({
            success: true,
            reward: reward, // 告訴前端實際發了多少點
            txHash: receipt.hash
        });

    } catch (error) {
        console.error("❌ 發放失敗:", error);
        res.status(500).json({ error: "伺服器或區塊鏈錯誤" });
    }
});

app.post('/api/checkout', async (req, res) => {
    // 從前端接收使用者的錢包地址與購物車算好的總點數
    const { userAddress, totalPoints } = req.body;

    // 1. 基本資料檢查
    if (!userAddress || !totalPoints || totalPoints <= 0) {
        return res.status(400).json({ error: "參數錯誤或購物車為空" });
    }

    try {
        console.log(`🛒 收到結帳請求：準備發放 ${totalPoints} 點給 ${userAddress}...`);

        // 2. 呼叫智能合約發放點數 (店長代付 Gas Fee)
        const amountToMint = ethers.parseUnits(totalPoints.toString(), 18);
        const tx = await contract.mint(userAddress, amountToMint);
        const receipt = await tx.wait();

        console.log(`✅ 發放成功！交易雜湊: ${receipt.hash}`);

        // 3. 回傳成功訊息給前端
        res.json({
            success: true,
            reward: totalPoints,
            txHash: receipt.hash
        });

    } catch (error) {
        console.error("❌ 結帳發放失敗:", error);
        res.status(500).json({ error: "伺服器或區塊鏈連線錯誤" });
    }
});

let isCountdownStarted = false; 
let targetDrawTime = 0; 
let lastDrawResult = null; //紀錄最新一次的開獎結果
let drawHistory = [];

app.get('/api/lottery-status', async (req, res) => {
    try {
        let remainingSeconds = 60;
        if (isCountdownStarted) {
            const now = Date.now();
            remainingSeconds = Math.max(0, Math.floor((targetDrawTime - now) / 1000));
        }

        const players = await lotteryContract.getPlayers();

        res.json({
            isCountdownStarted,
            remainingSeconds,
            playersCount: players.length,
            lastDraw: lastDrawResult // 🌟 將最新開獎結果傳給前端
        });
    } catch (error) {
        console.error("狀態查詢失敗:", error);
        res.status(500).json({ error: "無法取得狀態" });
    }
});

lotteryContract.on("WinnerPicked", (winner, winningNumber, tokenId, event) => {
    console.log(`\n🎉🎉🎉 Chainlink VRF 開獎成功！ 🎉🎉🎉`);
    console.log(`👑 贏家地址: ${winner}`);
    console.log(`🏆 獲得專屬 NFT! 編號 (Token ID): ${tokenId.toString()}`);
    
    // 🌟 2. 從 event 中挖出真正的交易 Hash (Tx Hash)
    const realTxHash = event.log.transactionHash; 
    
    lastDrawResult = {
        hash: realTxHash, // 🌟 3. 把這裡換成真實的 Hash
        winner: winner,
        nftId: tokenId.toString(),
        timestamp: Date.now()
    };
    drawHistory.unshift(lastDrawResult);
    if (drawHistory.length > 10) drawHistory.pop();

    isCountdownStarted = false;
    targetDrawTime = 0; 
});

const autoLottery = async () => {
    if (isCountdownStarted) return;

    try {
        const players = await lotteryContract.getPlayers();
        
        if (players.length > 0) { 
            console.log(`🔥 有人加入了 (${players.length} 人)！開始倒數 `);
            isCountdownStarted = true; 
            targetDrawTime = Date.now() + 10000; 

            setTimeout(async () => {
                try {
                    console.log("🎰 倒數結束，正在向 Chainlink 請求隨機數...");
                    // 🌟 關鍵：這裡改成 requestWinner()
                    const tx = await lotteryContract.requestWinner();
                    await tx.wait();
                    console.log(`✅ 請求已發送！交易 Hash: ${tx.hash}`);
                    console.log(`⏳ 等待 Chainlink 預言機處理中 (約需 1~3 分鐘)...`);
                } catch (drawError) {
                    console.error("❌ 請求開獎失敗:", drawError);
                    isCountdownStarted = false;
                    targetDrawTime = 0; 
                }
            }, 60000);
        } else {
            console.log(`⏰ 目前無人參與，等待玩家加入...`);
        }
    } catch (error) {
        console.error("❌ 檢查人數失敗:", error);
    }
};

setInterval(autoLottery, 15000);
const PORT = process.env.PORT || 5000;
// 🌟 新增 API：讓前端抓取歷史紀錄
app.get('/api/history', (req, res) => {
    // 直接把 Node.js 記憶體裡的陣列回傳給前端
    res.json(drawHistory);
});

// 🌟 API：取得所有餐廳名單與地圖座標
app.get('/api/restaurants', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM restaurants');
        res.json({ status: 'success', data: result.rows });
    } catch (error) {
        console.error("讀取餐廳失敗:", error);
        res.status(500).json({ error: "無法取得餐廳資料" });
    }
});

// 🌟 API：取得特定餐廳的菜單
app.get('/api/menu/:restaurantId', async (req, res) => {
    const { restaurantId } = req.params;
    try {
        const result = await pool.query(
            'SELECT * FROM menu_items WHERE restaurant_id = $1 ORDER BY id ASC',
            [restaurantId]
        );
        res.json({ status: 'success', data: result.rows });
    } catch (error) {
        console.error("讀取菜單失敗:", error);
        res.status(500).json({ error: "無法取得菜單資料" });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 後端伺服器已啟動：http://localhost:${PORT}`);
});
