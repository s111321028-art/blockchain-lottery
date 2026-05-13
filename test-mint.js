import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider("https://sepolia.infura.io/v3/42db55e93f6648d496deea46b6d3065b");

const ownerWallet = new ethers.Wallet("235b5b1f3fc341b4a9bcf3897e0dc8abf3811d8cebcb0fd2ba7f97e433a080c1", provider);
const hackerWallet = new ethers.Wallet("81aeb1bcc0575f00f34d22d4990cd6808f73776e3cc0813511c92f47ca50853f", provider);

const contractAddress = "0xFa890A3b1c24F3381f7CADd42196729913B859f5";

const contractABI = [
  "function mint(address to, uint256 amount)",
  "function owner() view returns (address)"
];

async function testAccessControl() {
    console.log("開始測試權限控制...\n");

    const contractRead = new ethers.Contract(contractAddress, contractABI, provider);

    const onChainOwner = await contractRead.owner();

    console.log("合約 owner:", onChainOwner);
    console.log("ownerWallet:", ownerWallet.address, "\n");

    try {
        console.log("測試 A：Owner mint");
        const contractOwner = contractRead.connect(ownerWallet);
        
        // 💡 關鍵修改：加上 { gasLimit: 100000 } 強制送出交易，跳過 estimateGas
        const tx = await contractOwner.mint(ownerWallet.address, 10, { gasLimit: 100000 });
        
        console.log("交易已送出，等待上鏈... 交易雜湊:", tx.hash);
        await tx.wait();
        
        console.log("✅ Owner 成功 mint\n");
    } catch (err) {
        console.log("❌ Owner 失敗", err.message);
    }

    // 測試 B
    try {
        console.log("測試 B：Hacker mint");
        const contractHacker = contractRead.connect(hackerWallet);

        const tx = await contractHacker.mint(hackerWallet.address, 1000);
        await tx.wait();

        console.log("❌ 駭客成功（嚴重漏洞）");
    } catch (err) {
        console.log("✅ 駭客被擋下");
        console.log("錯誤:", err.shortMessage || err.reason || err.message);
    }
}

testAccessControl();