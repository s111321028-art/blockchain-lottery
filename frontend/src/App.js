import React, { useState, useEffect, useRef } from 'react';
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
  const lastSeenDrawRef = useRef(Date.now());

  const [showWinnerPopup, setShowWinnerPopup] = useState(false);
  const [lastDrawHash, setLastDrawHash] = useState("");

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
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [history, setHistory] = useState([]);


  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'order') {
      setIsMenuVisible(true);
    }
  }, []);

  // 🌟 自動生成 QR Code 圖片
  useEffect(() => {
    // 獲取目前不帶參數的基礎網址 (例如 https://xxx.vercel.app)
    const baseUrl = window.location.origin + window.location.pathname;
    // 在網址後面強制加上 ?mode=order
    const orderUrl = `${baseUrl}?mode=order`;

    QRCode.toDataURL(orderUrl, { width: 300, margin: 2 })
      .then(url => setQrImageUrl(url))
      .catch(err => console.error("QR Code 生成失敗:", err));
  }, []);
  
  useEffect(() => {
    if (activeTab === 'history') {
      axios.get("http://localhost:5000/api/history")
        .then(res => setHistory(res.data))
        .catch(err => console.error("無法抓取歷史紀錄:", err));
    }
  }, [activeTab, lastDrawHash]); // 依賴 activeTab 和 lastDrawHash

  useEffect(() => {
    if (window.ethereum) {
      // 當使用者在 MetaMask 切換帳號時，會觸發這個事件
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) {
          console.log("🔄 偵測到 MetaMask 帳號切換為:", accounts[0]);
          setAccount(accounts[0]);       // 1. 更新畫面上的地址
          updateBalance(accounts[0]);    // 2. 更新畫面的點數餘額
          fetchLotteryData();            // 3. 重新抓取抽獎名單
        } else {
          // 如果使用者把所有帳號都斷開連線
          setAccount("");
          setBalance("0");
        }
      });
    }

    // 避免記憶體洩漏，元件卸載時清除監聽
    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', () => {});
      }
    };
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
  
useEffect(() => {
    const fetchLotteryStatus = async () => {
      try {
        const response = await axios.get("http://localhost:5000/api/lottery-status");
        setCountdown(response.data.remainingSeconds);

        // 🌟 終極殺手鐧：用「時間戳記」來判斷！
        // 如果後端有開獎紀錄，且開獎時間「晚於」我們上次看過的時間，那就是新開獎！
        if (response.data.lastDraw && response.data.lastDraw.timestamp > lastSeenDrawRef.current) {
            console.log("🎉 偵測到全新開獎！準備彈出橫幅...", response.data.lastDraw.hash);
            
            setLastDrawHash(response.data.lastDraw.hash);
            setShowWinnerPopup(true); // 彈出中獎橫幅
            
            // 把這次開獎的時間記錄下來，避免下一秒又重複彈出
            lastSeenDrawRef.current = response.data.lastDraw.timestamp;

            // 10 秒後自動關閉橫幅
            setTimeout(() => setShowWinnerPopup(false), 10000); 
        }

        // 人數有變動時，更新合約狀態
        if (response.data.playersCount !== players.length) {
          fetchLotteryData();
          updateBalance(account); 
        }
      } catch (error) {
        console.error("同步倒數時間失敗:", error);
      }
    };

    const timer = setInterval(fetchLotteryStatus, 1000);
    return () => clearInterval(timer);
  }, [account, players.length]);


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
      
      const ticketPriceWei = ethers.parseUnits(TICKET_PRICE.toString(), 18);
      // 🌟 設定每次大額度授權的數量 (例如：一次授權 100 點，夠買 10 張彩券)
      const CHUNK_ALLOWANCE = 100;
      const chunkAllowanceWei = ethers.parseUnits(CHUNK_ALLOWANCE.toString(), 18);

      // --- 🌟 步驟 1: 檢查目前的授權額度 (Allowance) ---
      console.log("步驟 1: 檢查授權額度...");
      const currentAllowance = await tokenContract.allowance(account, LOTTERY_ADDRESS);

      // 如果目前的授權額度「小於」一張彩券的價錢 (10 點)，就需要重新要求授權
      if (currentAllowance < ticketPriceWei) {
          console.log(`額度不足，向 MetaMask 請求 ${CHUNK_ALLOWANCE} 點的授權...`);
          // 💡 這裡不再是無限大，而是請求我們設定好的 chunkAllowanceWei (100 點)
          const approveTx = await tokenContract.approve(LOTTERY_ADDRESS, chunkAllowanceWei);
          await approveTx.wait(); 
          console.log(`✅ ${CHUNK_ALLOWANCE} 點授權完成！`);
      } else {
          // 順便把剩餘額度印出來，方便開發者觀察
          const remaining = ethers.formatUnits(currentAllowance, 18);
          console.log(`✅ 授權額度充足 (剩餘 ${remaining} 點)，跳過 Approve 步驟！`);
      }

      // --- 🌟 步驟 2: 呼叫抽獎合約 ---
      console.log("步驟 2: 呼叫抽獎合約...");
      const enterTx = await lotteryContract.enterLottery(userName);
      console.log("🎟️ 交易已發送，Hash:", enterTx.hash);
      
      await enterTx.wait(); 

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

 
  // --- 🌟 結帳點數邏輯 ---
  const handleCheckout = async () => {
    if (!account) return alert("請先連接錢包");
    setIsCheckingOut(true);
    try {
      const response = await axios.post("https://blockchain-lottery.onrender.com/api/checkout", {
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
  
  // 🔄 強制喚起 MetaMask 重新選擇帳號
  const switchAccount = async () => {
    try {
      if (!window.ethereum) return alert("請先安裝 MetaMask");

      // 關鍵魔法：強制要求 MetaMask 重新給予 eth_accounts 權限，這會彈出選擇帳號的視窗
      await window.ethereum.request({
        method: 'wallet_requestPermissions',
        params: [{ eth_accounts: {} }]
      });

      // 授權完成後，重新抓取最新的帳號
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        updateBalance(accounts[0]);
        console.log("已成功切換至帳號:", accounts[0]);
      }
    } catch (error) {
      console.error("切換帳號失敗或使用者取消:", error);
    }
  };

  const formatAddress = (addr) => addr ? `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}` : "";

  return (
    <div className="app-container">
      {/* 判斷目前是「入口畫面」還是「系統主畫面」 */}
      {!isMenuVisible ? (
        /* --- 畫面 A：掃描入口 (沒掃描前只看得到這個) --- */
        <div className="app-content" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '80vh' }}>
          <header className="app-header">
            <h1>點餐抽獎系統</h1>
          </header>
          <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
            <h3 style={{ fontSize: '1.5rem', marginTop: 0 }}>📲 掃描進入系統</h3>
            <div style={{ padding: '20px', background: 'white', display: 'inline-block', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
              {qrImageUrl ? (
                <img src={qrImageUrl} alt="QR Code" style={{ width: '200px', display: 'block' }} />
              ) : (
                <p>QR Code 生成中...</p>
              )}
            </div>
            <p style={{ fontSize: '1rem', color: '#666', marginTop: '20px' }}>請使用手機掃描上方 QR Code 開始點餐</p>
          </div>
        </div>
      ) : (
        /* --- 畫面 B：主系統頁面 (掃描後才出現) --- */
        <div className="app-content">
          <header className="app-header">
            <h1>🍔 DApp 點餐抽獎系統</h1>
          </header>

          {!account ? (
            /* 未連接錢包時的提示 */
            <div className="card" style={{ textAlign: 'center', padding: '30px' }}>
              <p style={{ marginBottom: '20px', color: '#555' }}>歡迎進入系統！請先連接錢包以開始點餐。</p>
              <button className="primary-btn" onClick={connectWallet}>🦊 連接 MetaMask</button>
            </div>
          ) : (
            <>
              {/* 錢包與餘額卡片 */}
              <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ textAlign: 'left' }}>
                  <p className="balance-title">我的點數</p>
                  <h2 className="balance-amount">{balance}</h2>
                </div>
                <div 
                className="wallet-badge" 
                onClick={switchAccount}
                title="點擊切換/重新連接帳號"
                style={{ 
                  cursor: 'pointer', 
                  transition: 'opacity 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
                onMouseOver={(e) => e.currentTarget.style.opacity = 0.7}
                onMouseOut={(e) => e.currentTarget.style.opacity = 1}
              >
                🔄 {formatAddress(account)}
              </div>
              </div>

              {/* 切換頁籤 */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <button 
                  className="primary-btn" 
                  style={{ background: activeTab === 'shop' ? '#2E7D32' : '#e0e0e0', color: activeTab === 'shop' ? 'white' : '#666' }} 
                  onClick={() => setActiveTab("shop")}
                >
                  🛍️ 點餐
                </button>
                <button 
                  className="primary-btn" 
                  style={{ background: activeTab === 'lottery' ? '#1565c0' : '#e0e0e0', color: activeTab === 'lottery' ? 'white' : '#666' }} 
                  onClick={() => setActiveTab("lottery")}
                >
                  🎟️ 彩券
                </button>
                <button 
                  className="primary-btn" 
                  style={{ background: activeTab === 'history' ? '#8e44ad' : '#e0e0e0', color: activeTab === 'history' ? 'white' : '#666' }} 
                  onClick={() => setActiveTab("history")}
                >
                  📜 歷史紀錄
                </button>
              </div>

              {/* 點餐介面 (Shop Tab) */}
              {activeTab === 'shop' && (
                <div className="card">
                  <h3>📋 菜單</h3>
                  {MENU.map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: '#f8f9fa', marginBottom: '8px', borderRadius: '8px' }}>
                      <span>{item.name} (${item.price})</span>
                      <button onClick={() => addToCart(item)} style={{ background: '#4CAF50', color: 'white', border: 'none', borderRadius: '5px', padding: '5px 10px', cursor: 'pointer' }}>+ 加入</button>
                    </div>
                  ))}
                  {cart.length > 0 && (
                    <div style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '10px' }}>
                      <p style={{ fontWeight: 'bold' }}>總額: ${totalAmount} (送 {totalPoints} 點)</p>
                      <button className="primary-btn" onClick={handleCheckout} disabled={isCheckingOut}>
                        {isCheckingOut ? "🔄 處理中..." : "💳 結帳"}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* --- 彩券介面 (Lottery Tab) --- */}
              {activeTab === 'lottery' && (
                <div className="card">
                  <h3>🏆 抽獎 (10 點)</h3>
                  <input 
                    type="text" 
                    placeholder="📝 請輸入您的姓名 (必填)" 
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    style={{ width: '100%', padding: '10px', marginBottom: '15px', borderRadius: '8px', border: '1px solid #ccc', boxSizing: 'border-box' }}
                  />
                  <button className="primary-btn" onClick={() => setShowConfirmModal(true)} disabled={isBuyingTicket || parseInt(balance) < TICKET_PRICE}>
                    {isBuyingTicket ? "🔄 處理中..." : "💰 購買彩券"}
                  </button>
                  <p style={{ marginTop: '10px', color: '#666' }}>目前參與人次：{players.length}</p>
                  
                  <div style={{ marginTop: '20px', padding: '15px', background: '#fff3e0', borderRadius: '10px', border: '1px solid #ffe0b2' }}>
                    <h4 style={{ color: '#e65100', margin: '0 0 10px 0', textAlign: 'center' }}>👑 開獎狀態</h4>
                    
                    {players.length > 0 ? (
                      countdown > 0 ? (
                        /* --- 狀態 A：倒數計時中 --- */
                        <div style={{ background: '#fff', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                          <p style={{ margin: 0, color: '#d32f2f', fontWeight: 'bold' }}>🔥 玩家已加入！開獎倒數：</p>
                          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#e65100' }}>
                            {countdown === 60 ? "01:00" : `00:${countdown < 10 ? `0${countdown}` : countdown}`}
                          </div>
                        </div>
                      ) : (
                        /* --- 狀態 B：時間到，正在開獎中 (等待區塊鏈) --- */
                        <div style={{ background: '#fff', padding: '15px 10px', borderRadius: '8px', textAlign: 'center' }}>
                          <p style={{ margin: 0, color: '#d32f2f', fontWeight: 'bold', fontSize: '1.2rem', animation: 'pulse 1s infinite alternate' }}>
                            🎰 目前正在開獎中...
                          </p>
                          <p style={{ margin: '5px 0 0 0', fontSize: '0.9rem', color: '#666' }}>
                            請稍候，等待區塊鏈確認交易 ⏳
                          </p>
                          {/* 簡單的閃爍動畫 CSS */}
                          <style>{`@keyframes pulse { from { opacity: 0.6; } to { opacity: 1; transform: scale(1.05); } }`}</style>
                        </div>
                      )
                    ) : (
                      /* --- 狀態 C：無人參與 --- */
                      <div style={{ padding: '10px', background: 'rgba(255,255,255,0.5)', borderRadius: '8px', textAlign: 'center' }}>
                        <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>
                          ⏳ 目前無人參與，等待玩家加入...
                        </p>
                      </div>
                    )}
                  </div>   
                </div>
                
              )}
              {/* --- 歷史紀錄介面 (History Tab) --- */}
              {activeTab === 'history' && (
                <div className="card">
                  <h3>📜 最近 10 筆開獎紀錄</h3>
                  {history.length > 0 ? (
                    history.map((record, index) => (
                      <div key={record.hash} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 10px', background: index === 0 ? '#fff9c4' : '#f8f9fa', marginBottom: '8px', borderRadius: '8px', alignItems: 'center' }}>
                        <span style={{ color: '#666', fontSize: '0.9rem' }}>
                          {new Date(record.timestamp).toLocaleString()}
                        </span>
                        <a 
                          href={`https://sepolia.etherscan.io/tx/${record.hash}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{ color: '#1976d2', textDecoration: 'none', fontWeight: 'bold', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '5px' }}
                        >
                          {record.hash.substring(0, 10)}... ↗
                        </a>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#999', background: '#f5f5f5', borderRadius: '8px' }}>
                      目前尚無開獎紀錄，趕快成為第一位贏家！
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* --- 全域遮罩：結帳中 --- */}
      {isCheckingOut && (
        <div style={{
          position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
          backgroundColor: "rgba(255, 255, 255, 0.9)", zIndex: 1000,
          display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center"
        }}>
          <div style={{ fontSize: "4rem", animation: "spin 2s linear infinite", marginBottom: "20px" }}>⏳</div>
          <h2 style={{ color: "#2E7D32" }}>🛒 正在為您結帳中...</h2>
          <p style={{ color: "#666" }}>請稍候，正在發送 Web3 點數到您的錢包</p>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* --- 全域遮罩：購買確認 --- */}
      {showConfirmModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div className="card" style={{ maxWidth: '350px', width: '90%' }}>
            <h3>⚠️ 確認購買？</h3>
            <p>即將花費 10 點參與抽獎。</p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button className="primary-btn" style={{ background: '#ccc' }} onClick={() => setShowConfirmModal(false)}>取消</button>
              <button className="primary-btn" onClick={buyTicket}>確認</button>
            </div>
          </div>
        </div>
      )}
      {/* --- 全域廣播：開獎成功橫幅 --- */}
      {showWinnerPopup && (
        <div style={{
          position: 'fixed', top: '30px', left: '50%', transform: 'translateX(-50%)',
          background: 'linear-gradient(135deg, #FFD700, #FFA500, #FF4500)',
          padding: '20px 40px', borderRadius: '50px',
          boxShadow: '0 10px 30px rgba(255, 140, 0, 0.6)',
          zIndex: 10000, color: 'white', textAlign: 'center',
          animation: 'slideDownBounce 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)'
        }}>
          <style>{`
            @keyframes slideDownBounce {
              0% { top: -150px; opacity: 0; }
              100% { top: 30px; opacity: 1; }
            }
          `}</style>
          <div style={{ fontSize: '2rem', marginBottom: '10px', textShadow: '0 2px 5px rgba(0,0,0,0.3)' }}>
            🎊 抽獎完成！ 🎊
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
            獎金已發放至幸運兒的錢包！請檢查您的餘額！
          </div>
          <div style={{ fontSize: '0.9rem', marginTop: '10px', background: 'rgba(0,0,0,0.2)', padding: '5px 10px', borderRadius: '10px' }}>
            區塊鏈紀錄: {lastDrawHash.substring(0, 10)}...{lastDrawHash.substring(lastDrawHash.length - 8)}
          </div>
          <button
            onClick={() => setShowWinnerPopup(false)}
            style={{ marginTop: '15px', background: 'white', color: '#FF4500', border: 'none', padding: '8px 20px', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}
          >
            太棒了！
          </button>
        </div>
      )}
    </div>
  );
}

export default App;