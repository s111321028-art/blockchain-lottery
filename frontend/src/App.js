import { useState, useEffect } from "react";
import QRCode from 'qrcode'; // 🌟 使用純 JS 版 qrcode
import { ethers } from "ethers";
import { getTokenContract, getLotteryContract, LOTTERY_ADDRESS } from "./utils/contract";
import axios from "axios";
import "./App.css"; 

function App() {
  const [account, setAccount] = useState("");
  const [balance, setBalance] = useState("0");
  const [userName, setUserName] = useState("");
  const [qrImageUrl, setQrImageUrl] = useState(""); // 🌟 用來儲存生成的 QR Code 圖片位址
  const [countdown, setCountdown] = useState(60);
  
  // --- 🛒 購物車狀態 ---
  const [activeTab, setActiveTab] = useState("shop"); 
  const [cart, setCart] = useState([]);               
  const [isCheckingOut, setIsCheckingOut] = useState(false); 

  // --- 🎟️ 彩券與購買狀態 ---
  const [isBuyingTicket, setIsBuyingTicket] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const TICKET_PRICE = 10; 

  // --- 👑 店長與抽獎名單狀態 ---
  const [ownerAddress, setOwnerAddress] = useState("");
  const [players, setPlayers] = useState([]);
  const [isPickingWinner, setIsPickingWinner] = useState(false);

  // 🌟 自動生成 QR Code 圖片
  useEffect(() => {
    // 這裡會把目前的網址轉換成 Base64 圖片字串
    QRCode.toDataURL(window.location.href, { width: 300, margin: 2 })
      .then(url => setQrImageUrl(url))
      .catch(err => console.error("QR Code 生成失敗:", err));
  }, []);

  // 👑 讀取抽獎合約資料
  const fetchLotteryData = async () => {
    try {
      const lotteryContract = await getLotteryContract();
      const currentOwner = await lotteryContract.owner();
      setOwnerAddress(currentOwner.toLowerCase());
      const currentPlayers = await lotteryContract.getPlayers();
      setPlayers(currentPlayers);
    } catch (error) {
      console.error("讀取抽獎合約資料失敗:", error);
    }
  };
  
  // ⏰ 倒數計時邏輯
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // 當倒數到 0 時，重置回 60，並重新讀取合約資料 (確認是否已開獎)
          fetchLotteryData(); 
          updateBalance(account);
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer); // 🌟 元件卸載時清除計時器，避免記憶體洩漏
  }, [account]); // 當帳號切換時重新啟動
  // 🍔 商品菜單 
  const MENU = [
    { id: 'M01', name: '🍔 經典大麥克', price: 120, reward: 12 },
    { id: 'M02', name: '🍟 酥脆薯條', price: 50, reward: 5 },
    { id: 'M03', name: '☕ 冰拿鐵', price: 80, reward: 8 },
    { id: 'M04', name: '🍰 熔岩巧克力', price: 100, reward: 10 },
  ];

  const addToCart = (item) => setCart([...cart, item]);
  const clearCart = () => setCart([]);
  
  const totalAmount = cart.reduce((sum, item) => sum + item.price, 0);
  const totalPoints = cart.reduce((sum, item) => sum + item.reward, 0);
  
  useEffect(() => {
    if (account) {
      fetchLotteryData(); 
    }
  }, [account]);

  // 🎟️ 購買彩券的核心邏輯
  const buyTicket = async () => {
    if (!account) return alert("請先連接錢包");
    if (parseInt(balance) < TICKET_PRICE) return alert(`餘額不足！需要 ${TICKET_PRICE} 點。`);
    if (!userName.trim()) return alert("📝 請先輸入您的姓名，才能參加抽獎喔！");

    setShowConfirmModal(false); 
    setIsBuyingTicket(true);
    
    try {
      const tokenContract = await getTokenContract();
      const lotteryContract = await getLotteryContract();

      console.log("步驟 1: 授權扣款...");
      const approveTx = await tokenContract.approve(LOTTERY_ADDRESS, ethers.parseUnits("10", 18));
      await approveTx.wait(); 

      console.log("步驟 2: 呼叫抽獎合約...");
      // 🌟 傳入 userName
      const enterTx = await lotteryContract.enterLottery(userName);
      console.log("🎟️ 交易已發送，Hash:", enterTx.hash);
      await approveTx.wait();

      alert(`🎉 恭喜 ${userName}！購買成功！`);
      setUserName(""); 
      updateBalance(account); 
      fetchLotteryData(); 

    } catch (err) {
      console.error("購買失敗:", err);
      alert("❌ 購買失敗");
    } finally {
      setIsBuyingTicket(false);
    }
  };

  // --- 👑 店長開獎邏輯 ---
  const handlePickWinner = async () => {
    setIsPickingWinner(true);
    try {
      const lotteryContract = await getLotteryContract();
      const tx = await lotteryContract.pickWinner();
      alert("⏳ 正在開獎...");
      await tx.wait(); 
      alert("🎉 開獎成功！");
      fetchLotteryData();
      updateBalance(account); 
    } catch (err) {
      console.error("開獎失敗:", err);
    } finally {
      setIsPickingWinner(false);
    }
  };
  
  // --- 🌟 結帳點數邏輯 ---
  const handleCheckout = async () => {
    if (!account) return alert("請先連接錢包");
    setIsCheckingOut(true);
    const BACKEND_URL = "https://blockchain-lottery.onrender.com/api/reward";
    try {
      const response = await axios.post(BACKEND_URL, {
        userAddress: account,
        totalPoints: totalPoints
      });
      if (response.data.success) {
        alert(`🎉 結帳成功！獲得 ${totalPoints} 點！`);
        clearCart(); 
        setTimeout(() => updateBalance(account), 3000); 
      }
    } catch (err) {
      console.error("結帳錯誤:", err);
    } finally {
      setIsCheckingOut(false);
    }
  };

  // 餘額轉換 (整數)
  const updateBalance = async (address) => {
    try {
      const contract = await getTokenContract();
      const bal = await contract.balanceOf(address);
      const formattedBalance = ethers.formatUnits(bal, 18);
      setBalance(Math.floor(Number(formattedBalance)).toString()); 
    } catch (err) {
      console.error(err);
    }
  };

  async function connectWallet() {
    try {
      if (!window.ethereum) return alert("請先安裝 MetaMask");
      await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0xaa36a7' }] });
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      setAccount(accounts[0]);
      updateBalance(accounts[0]);
    } catch (error) {
      console.error(error);
    }
  }

  const formatAddress = (addr) => addr ? `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}` : "";

  return (
    <div className="app-container">
      <div className="app-content">
        <header className="app-header">
          <h1>🍔 DApp 點餐抽獎系統</h1>
        </header>

        {/* 🌟 修正後的 QR Code 區塊：直接顯示 <img> */}
        <div className="card" style={{ textAlign: 'center' }}>
          <h3 style={{ marginTop: 0 }}>📲 掃描進入系統</h3>
          <div style={{ padding: '10px', background: 'white', display: 'inline-block', borderRadius: '10px' }}>
            {qrImageUrl ? (
              <img src={qrImageUrl} alt="QR Code" style={{ width: '150px', display: 'block' }} />
            ) : (
              <p>QR Code 生成中...</p>
            )}
          </div>
          <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '10px' }}>掃描即刻參與點餐抽獎</p>
        </div>

        {!account ? (
          <button className="primary-btn" onClick={connectWallet}>🦊 連接 MetaMask</button>
        ) : (
          <>
            {/* 錢包與餘額卡片 */}
            <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ textAlign: 'left' }}>
                <p className="balance-title">我的點數</p>
                <h2 className="balance-amount">{balance}</h2>
              </div>
              <div className="wallet-badge">{formatAddress(account)}</div>
            </div>

            {/* 切換頁籤 */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <button className="primary-btn" style={{ background: activeTab === 'shop' ? '#2E7D32' : '#e0e0e0', color: activeTab === 'shop' ? 'white' : '#666' }} onClick={() => setActiveTab("shop")}>🛍️ 點餐</button>
              <button className="primary-btn" style={{ background: activeTab === 'lottery' ? '#1565c0' : '#e0e0e0', color: activeTab === 'lottery' ? 'white' : '#666' }} onClick={() => setActiveTab("lottery")}>🎟️ 彩券</button>
            </div>

            {/* 點餐介面 */}
            {activeTab === 'shop' && (
              <div className="card">
                <h3>📋 菜單</h3>
                {MENU.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: '#f8f9fa', marginBottom: '8px', borderRadius: '8px' }}>
                    <span>{item.name} (${item.price})</span>
                    <button onClick={() => addToCart(item)} style={{ background: '#4CAF50', color: 'white', border: 'none', borderRadius: '5px', padding: '5px 10px' }}>+ 加入</button>
                  </div>
                ))}
                {cart.length > 0 && (
                  <div style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '10px' }}>
                    <p>總額: ${totalAmount} (送 {totalPoints} 點)</p>
                    <button className="primary-btn" onClick={handleCheckout} disabled={isCheckingOut}>💳 結帳</button>
                  </div>
                )}
              </div>
            )}
            
            {/* --- 🌟 結帳中回饋遮罩 --- */}
            {isCheckingOut && (
              <div style={{
                position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
                backgroundColor: "rgba(255, 255, 255, 0.8)", zIndex: 1000,
                display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center"
              }}>
                {/* 這裡放一個簡單的動畫或圖示 */}
                <div style={{ 
                  fontSize: "4rem", animation: "spin 2s linear infinite", marginBottom: "20px" 
                }}>
                  ⏳
                </div>
                <h2 style={{ color: "#2E7D32" }}>🛒 正在為您結帳中...</h2>
                <p style={{ color: "#666" }}>請稍候，正在將 Web3 點數發送到您的錢包</p>
                
                {/* 加入一個簡單的 CSS 動畫在 style 標籤或 App.css 裡 */}
                <style>{`
                  @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                `}</style>
              </div>
            )}
            {/* 彩券介面 */}
            {activeTab === 'lottery' && (
              <div className="card">
                <h3>🏆 百萬大抽獎 (10 點)</h3>
                <input 
                  type="text" 
                  placeholder="📝 請輸入您的姓名 (必填)" 
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  style={{ width: '100%', padding: '10px', marginBottom: '15px', borderRadius: '8px', border: '1px solid #ccc', boxSizing: 'border-box' }}
                />
                <button className="primary-btn" onClick={() => setShowConfirmModal(true)} disabled={isBuyingTicket || parseInt(balance) < TICKET_PRICE}>{isBuyingTicket ? "🔄 處理中..." : "💰 購買彩券"}</button>
                <p style={{ marginTop: '10px', color: '#666' }}>目前參與人次：{players.length}</p>
                
                {/* --- 👑 店長專屬區塊 --- */}
                {account && ownerAddress && account.toLowerCase() === ownerAddress && (
                  <div style={{ marginTop: '20px', padding: '15px', background: '#fff3e0', borderRadius: '10px', border: '1px solid #ffe0b2' }}>
                    <h4 style={{ color: '#e65100', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      👑 店長後台 (自動抽獎中)
                    </h4>
                    
                    {/* 🌟 條件顯示區：只有人數達到 5 人，才顯示倒數計時 */}
                    {players.length >= 5 ? (
                      <div style={{ 
                        background: '#fff', 
                        padding: '10px', 
                        borderRadius: '8px', 
                        marginBottom: '15px', 
                        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)',
                        animation: 'fadeIn 0.5s' // 增加一個淡入效果，更有科技感
                      }}>
                        <p style={{ margin: 0, fontSize: '0.9rem', color: '#d32f2f', fontWeight: 'bold' }}>
                          🔥 已達抽獎門檻！開獎倒數：
                        </p>
                        <div style={{ 
                          fontSize: '1.8rem', 
                          fontWeight: 'bold', 
                          color: countdown <= 10 ? '#ff0000' : '#e65100',
                          fontFamily: 'monospace' 
                        }}>
                          00:{countdown < 10 ? `0${countdown}` : countdown}
                        </div>
                      </div>
                    ) : (
                      /* 🌟 人數未達 5 人時顯示的提示 */
                      <div style={{ padding: '10px', background: 'rgba(255,255,255,0.5)', borderRadius: '8px', marginBottom: '15px' }}>
                        <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>
                          ⏳ 等待參與人數達 5 人... (目前: {players.length}/5)
                        </p>
                        <div style={{ width: '100%', background: '#eee', height: '8px', borderRadius: '4px', marginTop: '8px' }}>
                          <div style={{ 
                            width: `${(players.length / 5) * 100}%`, 
                            background: '#e65100', 
                            height: '100%', 
                            borderRadius: '4px',
                            transition: 'width 0.5s ease' // 讓進度條跑起來很順滑
                          }}></div>
                        </div>
                      </div>
                    )}

                    <button 
                      className="primary-btn danger-btn" 
                      onClick={handlePickWinner}
                      disabled={isPickingWinner || players.length === 0}
                      style={{ 
                        background: '#e65100',
                        opacity: (isPickingWinner || players.length === 0) ? 0.5 : 1 
                      }}
                    >
                      {isPickingWinner ? "正在開獎中..." : "🎲 立即手動開獎"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* 確認視窗 */}
      {showConfirmModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div className="card" style={{ maxWidth: '350px' }}>
            <h3>⚠️ 確認購買？</h3>
            <p>即將花費 10 點參與抽獎。</p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button className="primary-btn" style={{ background: '#ccc' }} onClick={() => setShowConfirmModal(false)}>取消</button>
              <button className="primary-btn" onClick={buyTicket}>確認</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;