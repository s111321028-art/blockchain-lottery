import { ethers } from "ethers";

// 1. 填入你的 Token 合約地址 (用來查餘額、發點數)
const TOKEN_ADDRESS = "0x89027C3feBbAF757100C43F8C75Fa451c1CF9823"; 

// 必須是你剛剛部署的全新抽獎合約地址
export const LOTTERY_ADDRESS = "0xea3eE83ade87a2856565f6186BaF7bbC7Ba78878";// 假設這是你的抽獎合約

// Token 的 ABI
const tokenABI = [
  "function balanceOf(address account) public view returns (uint256)",
  "function mint(address to, uint256 amount) public",
  "function approve(address spender, uint256 amount) public returns (bool)",
  "function allowance(address owner, address spender) public view returns (uint256)"
];

// Lottery 的 ABI
const lotteryABI = [
  "function enterLottery() public",
  "function requestWinner() public",
  "function getPlayers() view returns (address[])",
  "function recentWinner() view returns (address)",
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function owner() view returns (address)", // 🌟 補上這行，App.js 就不會當機了
  "event WinnerPicked(address indexed winner, uint256 winningNumber, uint256 tokenId)"
];


// 給 App.js 查餘額用的
export const getTokenContract = async () => {
    if (!window.ethereum) throw new Error("請安裝 MetaMask");
    
    // 每次呼叫時，都重新取得最新的 provider 和目前 MetaMask 啟用的 signer
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner(); 
    
    return new ethers.Contract(TOKEN_ADDRESS, tokenABI, signer);
};

// 給未來第三週抽獎用的
export const getLotteryContract = async () => {
    if (!window.ethereum) throw new Error("請安裝 MetaMask");
    
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    
    return new ethers.Contract(LOTTERY_ADDRESS, lotteryABI, signer);
};