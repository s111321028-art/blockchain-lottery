from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import psycopg2
import os
from dotenv import load_dotenv

# 🌟 自動尋找並載入同資料夾底下的 .env 檔案
load_dotenv()

app = FastAPI()

# ⚠️ 允許 React 跨網域存取你的 API (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # 允許所有前端連線
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 🌟 改從環境變數讀取 Supabase 連線字串 (如果讀不到，預留原本的本地端設定作為備份)
DATABASE_URL = os.getenv("DATABASE_URL")

@app.get("/api/menu/{restaurant_id}")
def get_menu(restaurant_id: int):
    conn = None
    try:
        # 使用雲端連線字串
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        
        # 根據 restaurant_id 去 menu_items 資料庫抓菜單
        cursor.execute("SELECT id, name, price, reward FROM menu_items WHERE restaurant_id = %s;", (restaurant_id,))
        rows = cursor.fetchall()
        
        menu_items = []
        for row in rows:
            menu_items.append({
                "id": row[0],
                "name": row[1],
                "price": row[2],
                "reward": row[3]
            })
            
        return {"status": "success", "data": menu_items}
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        if conn: conn.close()
        
@app.get("/api/restaurants")
def get_restaurants():
    """這個 API 專門用來把餐廳座標送到前端地圖"""
    conn = None
    try:
        # 使用雲端連線字串
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        
        # 抓取餐廳的 ID, 名稱, 緯度, 經度, 地址
        cursor.execute("SELECT id, name, lat, lng, address FROM restaurants;")
        rows = cursor.fetchall()
        
        # 把 SQL 資料包裝成 JSON 陣列
        restaurant_list = []
        for row in rows:
            restaurant_list.append({
                "id": row[0],
                "name": row[1],
                
                # 🌟 核心修正：強制轉換成 float，防範 Leaflet 字串崩潰地雷
                "lat": float(row[2]) if row[2] is not None else 0.0,
                "lng": float(row[3]) if row[3] is not None else 0.0,
                
                "address": row[4]
            })
            
        return {"status": "success", "data": restaurant_list}

    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        if conn:
            cursor.close()
            conn.close()

@app.get("/")
def read_root():
    return {"message": "歡迎來到埔里美食區塊鏈 API 伺服器！"}