import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { ethers } from "ethers";
import { getTokenContract, getLotteryContract, LOTTERY_ADDRESS } from "./utils/contract";
import axios from "axios";
import "./App.css"; 

// 🌟 引入地圖套件
import { MapContainer, TileLayer, Marker, Popup, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// 🌟 修正 Leaflet 在 React 中預設圖標消失的問題
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
iconUrl: icon,
shadowUrl: iconShadow,
iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;


// 打造的打發時間小遊戲
const WaitMiniGame = () => {
  const [score, setScore] = useState(0);
  const [position, setPosition] = useState({ top: '40%', left: '40%' });

  // 每 0.8 秒自動隨機移動位置
  useEffect(() => {
    const interval = setInterval(() => {
      moveCoin();
    }, 800);
    return () => clearInterval(interval);
  }, []);

  const moveCoin = () => {
    // 限制在框框內隨機移動 (10% ~ 80%)
    const randomTop = Math.floor(Math.random() * 70) + 10;
    const randomLeft = Math.floor(Math.random() * 70) + 10;
    setPosition({ top: `${randomTop}%`, left: `${randomLeft}%` });
  };

  const handleClick = (e) => {
    e.stopPropagation(); // 防止點擊穿透
    setScore((s) => s + 1);
    moveCoin(); // 點到就立刻換位置
  };

  return (
    <div style={{ background: '#fff', padding: '15px', borderRadius: '12px', textAlign: 'center', border: '2px dashed #e65100' }}>
      <h4 style={{ color: '#d32f2f', margin: '0 0 5px 0', animation: 'pulse 1s infinite alternate' }}>
        🎰 開獎中...
      </h4>
      <p style={{ margin: '0 0 15px 0', fontSize: '0.85rem', color: '#666' }}>
        區塊鏈確認約需 1~3 分鐘，無聊的話來點擊鑽石吧！<br/>
        <strong style={{ fontSize: '1.2rem', color: '#2E7D32' }}>目前得分：{score}</strong>
      </p>
      
      {/* 遊戲區域 */}
      <div style={{ position: 'relative', width: '100%', height: '180px', background: '#f5f5f5', borderRadius: '8px', overflow: 'hidden', boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.1)' }}>
        <div
          onClick={handleClick}
          style={{
            position: 'absolute',
            top: position.top,
            left: position.left,
            width: '45px',
            height: '45px',
            background: 'linear-gradient(135deg, #FFD700, #FFA500)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
            cursor: 'crosshair',
            transition: 'top 0.2s ease-out, left 0.2s ease-out', // 🌟 加入平滑移動動畫
            boxShadow: '0 4px 10px rgba(255, 165, 0, 0.5)',
            userSelect: 'none'
          }}
        >
          💎
        </div>
      </div>
    </div>
  );
};

function App() {
const [account, setAccount] = useState("");
const [balance, setBalance] = useState("0");
const [userName, setUserName] = useState("");
const [qrImageUrl, setQrImageUrl] = useState(""); 
const [countdown, setCountdown] = useState(60);
const lastSeenDrawRef = useRef(Date.now());
const [myNFTs, setMyNFTs] = useState([]);
const [isLoadingNFTs, setIsLoadingNFTs] = useState(false);
const [showWinnerPopup, setShowWinnerPopup] = useState(false);
const [lastDrawHash, setLastDrawHash] = useState("");
const API_BASE_URL = "https://blockchain-lottery-1.onrender.com";

// --- 🛒 購物車與頁籤狀態 ---
// 🌟 將預設頁籤改為地圖 map
const [activeTab, setActiveTab] = useState("map"); 
const [cart, setCart] = useState([]);               
const [isCheckingOut, setIsCheckingOut] = useState(false); 

// --- 🎟️ 彩券與購買狀態 ---
const [isBuyingTicket, setIsBuyingTicket] = useState(false);
const [showConfirmModal, setShowConfirmModal] = useState(false);
const TICKET_PRICE = 10; 

// --- 👑 店長與抽獎名單狀態 ---
// eslint-disable-next-line no-unused-vars
const [ownerAddress, setOwnerAddress] = useState("");
const [players, setPlayers] = useState([]);
const [isMenuVisible, setIsMenuVisible] = useState(false);
const [history, setHistory] = useState([]);

// --- 📍 地圖餐廳資料狀態 ---
const [restaurants, setRestaurants] = useState([]);

useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('mode') === 'order') {
    setIsMenuVisible(true);
  }
}, []);


useEffect(() => {
  const baseUrl = window.location.origin + window.location.pathname;
  const orderUrl = `${baseUrl}?mode=order`;
  QRCode.toDataURL(orderUrl, { width: 300, margin: 2 })
    .then(url => setQrImageUrl(url))
    .catch(err => console.error("QR Code 生成失敗:", err));
}, []);

// 🌟 自動抓取後端 API 的餐廳地圖資料
useEffect(() => {
  if (activeTab === 'map') {
    // 連線到我們剛剛寫好的 Python FastAPI
    axios.get(`${API_BASE_URL}/api/restaurants`)
      .then(res => {
        if (res.data.status === 'success') {
          setRestaurants(res.data.data);
        }
      })
      .catch(err => console.error("無法抓取餐廳地圖資料:", err));
  } else if (activeTab === 'history') {
    axios.get(`${API_BASE_URL}/api/history`)
      .then(res => setHistory(res.data))
      .catch(err => console.error("無法抓取歷史紀錄:", err));
  }
}, [activeTab, lastDrawHash]);

useEffect(() => {
  if (window.ethereum) {
    window.ethereum.on('accountsChanged', (accounts) => {
      if (accounts.length > 0) {
        setAccount(accounts[0]);       
        updateBalance(accounts[0]);    
        fetchLotteryData();            
      } else {
        setAccount("");
        setBalance("0");
      }
    });
  }
  return () => {
    if (window.ethereum) {
      window.ethereum.removeListener('accountsChanged', () => {});
    }
  };
}, []);

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
const fetchMyNFTs = async () => {
  if (!account) return;
  setIsLoadingNFTs(true);
  try {
    const lotteryContract = await getLotteryContract();
    
    // 1. 檢查該錢包有沒有抽中過 NFT
    const nftBalance = await lotteryContract.balanceOf(account);
    if (nftBalance > 0) {
      
      // 2. 利用區塊鏈過濾器，找出這個帳號所有的「中獎紀錄」來取得 tokenId
      const filter = lotteryContract.filters.WinnerPicked(account);
      const events = await lotteryContract.queryFilter(filter);
      
      const fetchedNFTs = [];
      
      // 3. 根據 tokenId 抓取 IPFS 上的 JSON 資料與圖片
      for (let event of events) {
        const tokenId = event.args[2]; // tokenId 是事件的第 3 個參數
        const tokenURI = await lotteryContract.tokenURI(tokenId);
        
        // 將 ipfs:// 轉換為一般瀏覽器能讀取的 Pinata Gateway 網址
        let httpURI = tokenURI;
        if (tokenURI.startsWith("ipfs://")) {
            httpURI = tokenURI.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/");
        }
        
        try {
          // 讀取 Metadata JSON
          const metaRes = await axios.get(httpURI);
          const metadata = metaRes.data;
          
          // 轉換圖片網址
          let imageUrl = metadata.image;
          if (imageUrl && imageUrl.startsWith("ipfs://")) {
              imageUrl = imageUrl.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/");
          }
          
          fetchedNFTs.push({
            tokenId: tokenId.toString(),
            name: metadata.name,
            description: metadata.description,
            image: imageUrl
          });
        } catch (metaErr) {
          console.error(`無法解析 Token ID ${tokenId} 的資料:`, metaErr);
        }
      }
      setMyNFTs(fetchedNFTs);
    } else {
      setMyNFTs([]); // 沒有 NFT 就清空
    }
  } catch (error) {
    console.error("讀取 NFT 失敗:", error);
  } finally {
    setIsLoadingNFTs(false);
  }
};

// 🌟 當切換到「收藏」頁籤時，自動抓取資料
useEffect(() => {
  if (activeTab === 'collection' && account) {
    fetchMyNFTs();
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [activeTab, account]);

useEffect(() => {
  const fetchLotteryStatus = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/lottery-status`);
      setCountdown(response.data.remainingSeconds);

      if (response.data.lastDraw && response.data.lastDraw.timestamp > lastSeenDrawRef.current) {
          setLastDrawHash(response.data.lastDraw.hash);
          setShowWinnerPopup(true); 
          lastSeenDrawRef.current = response.data.lastDraw.timestamp;
          setTimeout(() => setShowWinnerPopup(false), 10000); 
      }

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

const [currentMenu, setCurrentMenu] = useState([]); // 存當前餐廳的菜單
const [selectedRestaurant, setSelectedRestaurant] = useState(null); // 存當前選中的餐廳

const addToCart = (item) => setCart([...cart, item]);
const clearCart = () => setCart([]);

const totalAmount = cart.reduce((sum, item) => sum + item.price, 0);
const totalPoints = Math.floor(totalAmount * 0.1);

const removeFromCart = (indexToRemove) => {
    setCart(cart.filter((_, index) => index !== indexToRemove));
  };

useEffect(() => {
  if (account) fetchLotteryData(); 
}, [account]);

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
    const CHUNK_ALLOWANCE = 100;
    const chunkAllowanceWei = ethers.parseUnits(CHUNK_ALLOWANCE.toString(), 18);

    const currentAllowance = await tokenContract.allowance(account, LOTTERY_ADDRESS);

    if (currentAllowance < ticketPriceWei) {
        const approveTx = await tokenContract.approve(LOTTERY_ADDRESS, chunkAllowanceWei);
        await approveTx.wait(); 
    }

    // 呼叫新合約的 enterLottery (不需要傳名字，因為合約直接紀錄地址)
    const enterTx = await lotteryContract.enterLottery();
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

const handleCheckout = async () => {
  if (!account) return alert("請先連接錢包");
  setIsCheckingOut(true);
  try {
    const response = await axios.post("https://blockchain-lottery-1.onrender.com/api/checkout", {
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

    // 1. 🌟 關鍵修正：先請求「連線帳號」，確保網站已被授權
    const provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.send("eth_requestAccounts", []);
    const currentAccount = accounts[0];

    // 2. 帳號授權成功後，再檢查並切換到 Sepolia 測試網
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0xaa36a7' }]
      });
    } catch (switchError) {
      // 錯誤碼 4902 代表使用者的 MetaMask 沒有這個網路
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0xaa36a7',
              chainName: 'Sepolia Testnet',
              nativeCurrency: { name: 'SepoliaETH', symbol: 'SEP', decimals: 18 },
              rpcUrls: ['https://rpc.sepolia.org'] // 使用官方穩定的 RPC
            }]
          });
        } catch (addError) {
          return alert("新增 Sepolia 網路失敗：" + addError.message);
        }
      } else {
        return alert("切換網路失敗：" + switchError.message);
      }
    }

    // 3. 帳號與網路都確認完畢，更新畫面狀態
    setAccount(currentAccount);
    updateBalance(currentAccount);

  } catch (error) {
    console.error("錢包連線詳細錯誤:", error);
    alert("連線錢包發生錯誤，請檢查 MetaMask 是否已解鎖。");
  }
}

const switchAccount = async () => {
  try {
    if (!window.ethereum) return alert("請先安裝 MetaMask");
    await window.ethereum.request({
      method: 'wallet_requestPermissions',
      params: [{ eth_accounts: {} }]
    });
    const provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.send("eth_requestAccounts", []);
    if (accounts.length > 0) {
      setAccount(accounts[0]);
      updateBalance(accounts[0]);
    }
  } catch (error) {
    console.error("切換帳號失敗或使用者取消:", error);
  }
};

const formatAddress = (addr) => addr ? `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}` : "";

return (
  <div className="app-container">
    {!isMenuVisible ? (
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
      <div className="app-content" style={{ maxWidth: '1000px', width: '100%', margin: '0 auto', transition: 'max-width 0.3s ease' }}>
        <header className="app-header">
          <h1>點餐抽獎系統</h1>
        </header>

        {!account ? (
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
              <div className="wallet-badge" onClick={switchAccount} title="點擊切換/重新連接帳號" style={{ cursor: 'pointer', transition: 'opacity 0.2s', display: 'flex', alignItems: 'center', gap: '5px' }}>
                🔄 {formatAddress(account)}
              </div>
            </div>

            {/* 🌟 切換頁籤 (加入地圖頁籤) */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <button 
                className="primary-btn" 
                style={{ background: activeTab === 'map' ? '#e65100' : '#e0e0e0', color: activeTab === 'map' ? 'white' : '#666', flex: '1', minWidth: '80px' }} 
                onClick={() => setActiveTab("map")}
              >
                🗺️ 地圖
              </button>
              <button 
                className="primary-btn" 
                style={{ background: activeTab === 'shop' ? '#2E7D32' : '#e0e0e0', color: activeTab === 'shop' ? 'white' : '#666', flex: '1', minWidth: '80px' }} 
                onClick={() => setActiveTab("shop")}
              >
                🛍️ 點餐
              </button>
              <button 
                className="primary-btn" 
                style={{ background: activeTab === 'lottery' ? '#1565c0' : '#e0e0e0', color: activeTab === 'lottery' ? 'white' : '#666', flex: '1', minWidth: '80px' }} 
                onClick={() => setActiveTab("lottery")}
              >
                🎟️ 彩券
              </button>
              <button 
                className="primary-btn" 
                style={{ background: activeTab === 'history' ? '#8e44ad' : '#e0e0e0', color: activeTab === 'history' ? 'white' : '#666', flex: '1', minWidth: '100px' }} 
                onClick={() => setActiveTab("history")}
              >
                📜 紀錄
              </button>
              {/* 把這個按鈕加在「📜 紀錄」按鈕的旁邊 */}
              <button 
                className="primary-btn" 
                style={{ background: activeTab === 'collection' ? '#9c27b0' : '#e0e0e0', color: activeTab === 'collection' ? 'white' : '#666', flex: '1', minWidth: '100px' }} 
                onClick={() => setActiveTab("collection")}
              >
                🎒 我的收藏
              </button>
            </div>

            {/* 📍 地圖介面 (Map Tab) */}
            {activeTab === 'map' && (
            <div className="card" style={{ padding: 0, overflow: 'hidden', height: '500px', position: 'relative', borderRadius: '15px', width: '100%' }}>
                {/* 顯示總店數 */}
                <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 400, background: 'rgba(255,255,255,0.9)', padding: '5px 10px', borderRadius: '20px', fontWeight: 'bold', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}>
                  {restaurants.length} 間合作餐廳
                </div>
                
                {/* 呼叫 Leaflet 地圖，設定中心在埔里 (暨南大學附近) */}
                <MapContainer center={[23.967, 120.966]} zoom={14} style={{ width: '100%', height: '100%' }}>
                  <TileLayer
                    attribution='&copy; OpenStreetMap'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {/* 遍歷資料庫回傳的餐廳並加上圖釘 */}
                  {restaurants.map((shop) => (
                      <Marker key={shop.id} position={[shop.lat, shop.lng]}>
                        
                        {/* 🌟 絕招：加入 Tooltip！滑鼠移過去就會浮現 */}
                        <Tooltip direction="top" offset={[0, -35]} opacity={0.9}>
                          <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#e65100' }}>
                            {shop.name}
                          </span>
                        </Tooltip>

                        {/* 點擊後彈出的視窗 (維持你原本的完美設計) */}
                        <Popup>
                          <h3 style={{ margin: '0 0 5px 0', color: '#e65100' }}>{shop.name}</h3>
                          <p style={{ margin: '0 0 10px 0', fontSize: '0.8rem', color: '#666' }}>{shop.address}</p>
                          <button 
                            onClick={() => {
                              setSelectedRestaurant(shop);
                              axios.get(`${API_BASE_URL}/api/menu/${shop.id}`)
                                .then(res => setCurrentMenu(res.data.data))
                                .catch(err => console.error("抓菜單失敗:", err));
                              setActiveTab('shop'); 
                            }} 
                            style={{ background: '#2E7D32', color: 'white', border: 'none', padding: '8px 10px', borderRadius: '5px', cursor: 'pointer', width: '100%', fontWeight: 'bold' }}
                          >
                            點擊進店點餐 🛍️
                          </button>
                        </Popup>
                        
                      </Marker>
                    ))}
                </MapContainer>
              </div>
            )}

            {/* 🛍️ 點餐介面 (Shop Tab) - 升級雙欄排版 */}
            {activeTab === 'shop' && (
              <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                
                {/* === 左邊欄位：購物車 === */}
                <div className="card" style={{ flex: '1', minWidth: '100px', position: 'sticky', top: '20px' }}>
                  <h3>🛒 你的購物車</h3>
                  {cart.length === 0 ? (
                    <p style={{ color: '#888', padding: '20px 0', textAlign: 'center' }}>購物車空空如也，快去點餐吧！</p>
                  ) : (
                    <>
                      <div style={{ maxHeight: '350px', overflowY: 'auto', marginBottom: '15px', paddingRight: '5px' }}>
                        {cart.map((item, index) => (
                          <div key={index} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 10px', borderBottom: '1px solid #eee', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.95rem', fontWeight: '500' }}>{item.name}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                              <span style={{ fontWeight: 'bold', color: '#e65100' }}>${item.price}</span>
                              {/* 🌟 刪除按鈕 */}
                              <button 
                                onClick={() => removeFromCart(index)}
                                style={{ background: '#ff4d4f', color: 'white', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', transition: '0.2s' }}
                                title="移除此品項"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{ borderTop: '2px dashed #ccc', paddingTop: '15px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '5px' }}>
                          <span>總金額:</span>
                          <span>${totalAmount}</span>
                        </div>
                        <p style={{ color: '#2E7D32', fontSize: '0.9rem', textAlign: 'right', margin: '0 0 15px 0' }}>🎁 結帳可獲得 {totalPoints} 點</p>
                        <button className="primary-btn" onClick={handleCheckout} disabled={isCheckingOut}>
                          {isCheckingOut ? "🔄 處理中..." : "💳 結帳送出"}
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* === 右邊欄位：菜單清單 === */}
                <div className="card" style={{ 
                  flex: '1.5', 
                  minWidth: '300px', 
                  maxHeight: '75vh', /* 🌟 絕招一：限制最大高度，大約佔螢幕的 75% */
                  overflowY: 'auto', /* 🌟 絕招一：超過高度時，只在這個區塊內產生捲軸 */
                  position: 'relative'
                }}>
                  
                  {/* 🌟 讓標題「黏」在頂部，往下捲動時才不會不見 */}
                  <h3 style={{ position: 'sticky', top: '-25px', background: 'white', zIndex: 10, padding: '20px 0 10px 0', marginTop: '-20px', borderBottom: '2px dashed #eee' }}>
                    📋 {selectedRestaurant ? `${selectedRestaurant.name} 的菜單` : "菜單 (請先從地圖選擇餐廳)"}
                  </h3>
                  
                  {currentMenu && currentMenu.length > 0 ? (
                    /* 🌟 絕招二：改用 CSS Grid 網格排版，畫面夠寬時自動變成「雙排」甚至「三排」 */
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px', marginTop: '15px' }}>
                      {currentMenu.map(item => (
                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 15px', background: '#f8f9fa', borderRadius: '10px', border: '1px solid #e9ecef', alignItems: 'center', transition: 'transform 0.1s' }} onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'} onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}>
                          <span style={{ fontSize: '1.05rem', fontWeight: '500' }}>
                            {item.name} <br/>
                            <span style={{ color: '#e65100', fontSize: '0.9rem', fontWeight: 'bold' }}>${item.price}</span>
                          </span>
                          <button 
                            onClick={() => addToCart(item)} 
                            style={{ background: '#4CAF50', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 15px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
                          >
                            + 加入
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: '#888', padding: '40px 0', textAlign: 'center' }}>
                      {selectedRestaurant ? "⏳ 菜單載入中，或該店暫無資料" : "👈 請先前往地圖頁籤選擇一家餐廳"}
                    </p>
                  )}
                </div>

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
                      <div style={{ background: '#fff', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                        <p style={{ margin: 0, color: '#d32f2f', fontWeight: 'bold' }}>🔥 玩家已加入！開獎倒數：</p>
                        <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#e65100' }}>
                          {`00:${countdown < 10 ? `0${countdown}` : countdown}`}
                        </div>
                      </div>
                    ) : (
                      <WaitMiniGame />
                    ) 
                  ) : (
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
            {/* --- 我的 NFT 收藏介面 (Collection Tab) --- */}
            {activeTab === 'collection' && (
              <div className="card">
                <h3 style={{ borderBottom: '2px dashed #9c27b0', paddingBottom: '10px', color: '#9c27b0' }}>
                  🎒 專屬 VIP 數位收藏庫
                </h3>
                
                {isLoadingNFTs ? (
                  <div style={{ padding: '40px 0', textAlign: 'center', color: '#666' }}>
                    <div style={{ fontSize: '2rem', animation: 'spin 1s linear infinite' }}>🔄</div>
                    <p>正在從區塊鏈同步您的藏品...</p>
                  </div>
                ) : myNFTs.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px', marginTop: '20px' }}>
                    {myNFTs.map((nft) => (
                      <div key={nft.tokenId} style={{ 
                        background: 'linear-gradient(145deg, #ffffff, #f0f0f0)', 
                        borderRadius: '15px', 
                        overflow: 'hidden', 
                        boxShadow: '5px 5px 15px rgba(0,0,0,0.1), -5px -5px 15px rgba(255,255,255,0.8)',
                        transition: 'transform 0.3s ease',
                        cursor: 'pointer'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
                      onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                      >
                        {/* 圖片展示區 */}
                        <div style={{ width: '100%', height: '220px', background: '#e0e0e0', position: 'relative' }}>
                          {nft.image ? (
                            <img src={nft.image} alt={nft.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#999' }}>圖片載入中</div>
                          )}
                          {/* Token ID 標籤 */}
                          <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.6)', color: 'white', padding: '3px 8px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                            #{nft.tokenId}
                          </div>
                        </div>
                        
                        {/* 資訊展示區 */}
                        <div style={{ padding: '15px' }}>
                          <h4 style={{ margin: '0 0 5px 0', color: '#333', fontSize: '1.1rem' }}>{nft.name || "未命名 NFT"}</h4>
                          <p style={{ margin: 0, color: '#777', fontSize: '0.85rem', lineHeight: '1.4' }}>
                            {nft.description || "這是一張專屬於您的限量餐廳憑證。"}
                          </p>
                          <div style={{ marginTop: '15px', paddingTop: '10px', borderTop: '1px solid #ddd', fontSize: '0.75rem', color: '#9c27b0', textAlign: 'center', fontWeight: 'bold' }}>
                            ✨ 已由區塊鏈永久驗證
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: '40px 20px', textAlign: 'center', background: '#f5f5f5', borderRadius: '15px', marginTop: '20px' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '10px' }}>😢</div>
                    <h4 style={{ margin: '0 0 10px 0', color: '#555' }}>您目前還沒有任何收藏</h4>
                    <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: '20px' }}>趕快到彩券區試試手氣，贏取獨一無二的 VIP 憑證吧！</p>
                    <button className="primary-btn" onClick={() => setActiveTab("lottery")}>前往抽獎 🎟️</button>
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
