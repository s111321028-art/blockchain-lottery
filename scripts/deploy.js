import hre from "hardhat";

async function main() {
  // 關鍵修正：在 Hardhat 3 中，必須從 network 中取得 ethers
  const { ethers } = await hre.network.getOrCreate();

  // 1. 取得部署帳號
  const [deployer] = await ethers.getSigners();
  console.log("使用帳號部署中:", deployer.address);

  // 2. 取得合約工廠 (必須傳入 deployer 作為授權)
  const PointToken = await ethers.getContractFactory("PointToken", deployer);

  console.log("正在部署 PointToken...");

  // 3. 部署合約
  const token = await PointToken.deploy();

  // 4. 等待部署完成 (確保合約上鏈)
  await token.waitForDeployment();

  // 5. 取得並印出部署後的地址
  console.log("Token deployed to:", await token.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});