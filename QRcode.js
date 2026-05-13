// generate-qr.js
import { ethers } from 'ethers';
import 'dotenv/config';

// 使用 .env 裡面的店長私鑰來簽名
const adminWallet = new ethers.Wallet(process.env.SEPOLIA_PRIVATE_KEY);

async function generateQRCodeData() {
    const itemId = "P001"; // 商品 ID (例如雞排)
    const reward = 15;     // 掃描可獲得 15 點
    const timestamp = Math.floor(Date.now() / 1000); // 取得當前時間 (秒)
    const nonce = Math.random().toString(36).substring(2, 8); // 產生 6 位隨機碼防重放

    // 1. 組合原文 (使用 | 隔開)
    const message = `${itemId}|${reward}|${timestamp}|${nonce}`;

    // 2. 使用店長私鑰對原文進行數位簽章
    const signature = await adminWallet.signMessage(message);

    // 3. 組合最終要放進 QR Code 的完整字串
    const finalQrData = `${message}|${signature}`;

    console.log("==========================================");
    console.log("請將以下這整串字串複製到 QR Code 產生器中：\n");
    console.log(finalQrData);
    console.log("==========================================");
}

generateQRCodeData();