import hre from "hardhat";

async function main() {
  // 1. 從網路連線中取得 ethers (Hardhat 3 語法)
  const { ethers } = await hre.network.getOrCreate();

  // 2. 取得操作帳號
  const [user] = await ethers.getSigners();
  console.log("操作帳號 (User):", user.address);

  // 3. 綁定合約地址 (並將 user 作為預設發送者)
  const tokenAddress = "0xea1AC900a63fbEA9cEb3Ac010d11C2F74361FBEB";
  const lotteryAddress = "0x6913a675Fd243Ea2E723198692235814545C30c1";

  const token = await ethers.getContractAt("PointToken", tokenAddress, user);
  const lottery = await ethers.getContractAt("Lottery", lotteryAddress, user);

  // -------------------------
  // 開始執行合約互動
  // -------------------------

  // [步驟一] Mint 代幣
  console.log("\n1. 正在 Mint 100 個 Token...");
  const mintTx = await token.mint(user.address, 100);
  await mintTx.wait(); // ⚠️ 關鍵：等待交易上鏈
  
  const balance = await token.balanceOf(user.address);
  console.log("   目前餘額 (Balance):", balance.toString());

  // 💡 [潛在必踩雷點：Approve 授權]
  // 如果你的 Lottery 參加條件是「花費 PointToken」，
  // 你必須先授權 Lottery 合約去扣你的錢，否則 enterLottery 會直接報錯！
  // 假設票價是 10 個 Token，請取消下面這三行的註解：
  /*
  console.log("\n2. 正在授權 Lottery 扣除 Token...");
  const approveTx = await token.approve(lotteryAddress, 10); // 10 是要授權的數量
  await approveTx.wait();
  */

  // [步驟二] 參加抽獎
  console.log("\n3. 正在參加抽獎 (Enter Lottery)...");
  const enterTx = await lottery.enterLottery();
  await enterTx.wait(); // 等待上鏈
  console.log("   成功參加抽獎！");

  // [步驟三] 抽籤
  console.log("\n4. 正在開獎 (Pick Winner)...");
  const pickTx = await lottery.pickWinner();
  await pickTx.wait(); // 等待上鏈

  // [步驟四] 查詢結果
  const winner = await lottery.winner();
  console.log("\n🎉 開獎結果！贏家是:", winner);
}

main().catch((error) => {
  console.error("腳本執行錯誤:", error);
  process.exitCode = 1;
});