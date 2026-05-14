import 'dotenv/config'; // 自動載入 .env
import express from 'express';
import cors from 'cors';
import { ethers } from 'ethers';

const app = express();
app.use(cors());
app.use(express.json());

console.log("測試讀取 RPC_URL:", process.env.SEPOLIA_RPC_URL);

// --- 1. 初始化區塊鏈連線 ---
const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
const adminWallet = new ethers.Wallet(process.env.SEPOLIA_PRIVATE_KEY, provider);
const LOTTERY_ADDRESS = process.env.CONTRACT_ADDRESS;

const abi = [
    "function mint(address to, uint256 amount) public",
    "function balanceOf(address account) public view returns (uint256)"
];

const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, abi, adminWallet);

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

const autoLottery = async () => {
    try {
        const lotteryContract = new ethers.Contract(LOTTERY_ADDRESS, LOTTERY_ABI, wallet);
        
        // 先檢查有沒有人在池子裡
        const players = await lotteryContract.getPlayers();
        if (players.length >= 5) { // 🌟 這裡也改成 >= 5，確保前後端同步
            console.log("🔥 門檻已到，執行自動抽獎！");
            const tx = await lotteryContract.pickWinner();
            await tx.wait();
            console.log(`🎉 抽獎完成！交易 Hash: ${tx.hash}`);
        } else {
            console.log("⏰ 抽獎時間到，但目前無人參與，跳過本次開獎。");
        }
    } catch (error) {
        console.error("❌ 自動抽獎執行失敗:", error);
    }
};

// 設定每 1 分鐘 (60000 毫秒) 執行一次
setInterval(autoLottery, 60000);
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 後端伺服器已啟動：http://localhost:${PORT}`);
});