import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { defineConfig } from "hardhat/config";
import dotenv from "dotenv";

dotenv.config();

const rpcUrl = process.env.SEPOLIA_RPC_URL;
const privateKey = process.env.SEPOLIA_PRIVATE_KEY;

if (!rpcUrl) throw new Error("Missing SEPOLIA_RPC_URL in .env");
if (!privateKey) throw new Error("Missing SEPOLIA_PRIVATE_KEY in .env");

const formattedKey = privateKey.startsWith("0x")
  ? privateKey
  : `0x${privateKey}`;

export default defineConfig({
  plugins: [hardhatToolboxMochaEthersPlugin],
  solidity: {
    profiles: {
      default: { version: "0.8.28" },
    },
  },
  networks: {
    sepolia: {
      type: "http",
      chainType: "l1",
      url: rpcUrl,
      accounts: [formattedKey],
    },
  },
});