import { network } from "hardhat";

// Hardhat 3 的重大改變：先建立網路連線，才能取得綁定在該網路上的 ethers
const { ethers } = await network.create("sepolia");

async function main() {
  // 1. 取得部署帳號
  const [deployer] = await ethers.getSigners();
  console.log("使用帳號部署中:", deployer.address);

  // 2. 之前部署好的 Token 地址
  const tokenAddress = "0x89027C3feBbAF757100C43F8C75Fa451c1CF9823";

  // 3. 取得合約工廠 (必須傳入 deployer 授權)
  const Lottery = await ethers.getContractFactory("Lottery", deployer);
  
  console.log("正在部署 Lottery 合約...");

  // 4. 部署合約
  const lottery = await Lottery.deploy(tokenAddress);

  // 5. 等待部署完成
  await lottery.waitForDeployment();

  console.log("Lottery 部署成功！地址:", await lottery.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});