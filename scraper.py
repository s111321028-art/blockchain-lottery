from playwright.sync_api import sync_playwright
import psycopg2
import time
import random
import json
import re

# ==========================================
# 0. 資料庫連線設定
# ==========================================
DB_CONFIG = {
    "dbname": "postgres",
    "user": "postgres",
    "password": "aa921116", 
    "host": "localhost",
    "port": "5432"
}

# ==========================================
# 1. 寫入資料庫函數 (保留你原本寫好的完美架構)
# ==========================================
def save_to_database(raw_data):
    if not raw_data or 'data' not in raw_data:
        return
    
    r_name = raw_data['data'].get('name', '未命名餐廳')
    r_lat = raw_data['data'].get('latitude', 0.0)
    r_lng = raw_data['data'].get('longitude', 0.0)
    r_address = raw_data['data'].get('address', '無地址')
    print(f"   🏪 解析中：{r_name}")

    conn = None; cursor = None
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO restaurants (name, lat, lng, address)
            VALUES (%s, %s, %s, %s) RETURNING id;
        """, (r_name, r_lat, r_lng, r_address))
        restaurant_id = cursor.fetchone()[0]

        menus = raw_data['data'].get('menus', [])
        if not menus: return

        item_count = 0
        for category in menus[0].get('menu_categories', []):
            for product in category.get('products', []):
                p_name = product.get('name', '未命名餐點')
                variations = product.get('product_variations', [])
                p_price = variations[0].get('price', 0) if variations else 0
                p_reward = int(p_price * 0.1) # 10% 點數
                
                cursor.execute("""
                    INSERT INTO menu_items (restaurant_id, name, price, reward)
                    VALUES (%s, %s, %s, %s);
                """, (restaurant_id, p_name, p_price, p_reward))
                item_count += 1
                
        print(f"   ✅ 成功寫入 {item_count} 道菜單！")
        conn.commit()

    except Exception as e:
        print(f"   ❌ 資料庫錯誤: {e}")
        if conn: conn.rollback()
    finally:
        if cursor: cursor.close()
        if conn: conn.close()

# ==========================================
# 🚀 啟動 Playwright 自動化引擎
# ==========================================
def run_playwright_scraper():
    print("啟動 Playwright 真實 Chrome 引擎...")
    
    # 🌟 改成一個全新的相對路徑資料夾，Playwright 會自己建立它
    USER_DATA_DIR = r"./scraper_chrome_profile" 
    
    with sync_playwright() as p:
        try:
            # 🌟 核心關鍵：不再用 launch，而是用 connect_over_cdp 連線到我們剛剛手動開的 9222 port！
            browser = p.chromium.connect_over_cdp("http://localhost:9222")
            context = browser.contexts[0]
            page = context.pages[0]
        except Exception as e:
            print("❌ 連線失敗！請確認你有先用 Win+R 執行開啟 Chrome 的指令！")
            print(f"錯誤訊息: {e}")
            return
        # ------------------------------------------------
        # 🗺️ 階段一：直接去前台網頁抓取代碼
        print("\n🗺️ [階段一] 正在前往 Foodpanda 埔里首頁...")
        page.goto("https://www.foodpanda.com.tw/city/puli-township")
        
        print("⚠️ 系統警戒中：請在瀏覽器中完成登入、解開驗證碼、或搜尋埔里。")
        print("⏳ 程式將會【無限期等待】，你可以慢慢來，沒有時間壓力！")
        
        try:
            # 🌟 將 timeout 設為 0，代表程式會一直等你，直到畫面上出現餐廳連結
            page.wait_for_selector('a[href^="/restaurant/"]', timeout=0)
            
            print("🔓 偵測到餐廳列表了！人類辛苦了，接下來交給程式自動操作！")
            time.sleep(2) # 稍微等網頁穩一下
            
        except Exception as e:
            print("❌ 等待過程中發生錯誤，程式即將退出。")
            context.close()
            return
        
        print("   正在模擬人類往下捲動載入餐廳...")
        for _ in range(6):
            page.mouse.wheel(0, 1500)
            time.sleep(1.5)

        # 從畫面上的網址連結中，用正規表達式把代碼截取出來
        hrefs = page.evaluate('''() => {
            return Array.from(document.querySelectorAll('a[href^="/restaurant/"]')).map(a => a.getAttribute('href'));
        }''')

        unique_codes = set()
        for href in hrefs:
            # 網址長這樣: /restaurant/n1em/xxx，我們要抓 n1em
            match = re.search(r'/restaurant/([a-z0-9]+)', href)
            if match:
                unique_codes.add(match.group(1))

        vendor_codes = list(unique_codes)
        print(f"✅ 成功找到 {len(vendor_codes)} 家餐廳代碼！: {vendor_codes[:5]}")

        if not vendor_codes:
            print("❌ 找不到餐廳，瀏覽器即將關閉。")
            context.close()
            return

        # ------------------------------------------------
        # 🍽️ 階段二：讓瀏覽器打開 API 網址抓 JSON
        # ------------------------------------------------
        print("\n🚀 [階段二] 開始抓取菜單並寫入 PostgreSQL...")
        
        # 🌟 神之一手：把 Playwright 剛養好的無敵 Cookie 全部抽出來！
        playwright_cookies = context.cookies()
        cookie_string = "; ".join([f"{c['name']}={c['value']}" for c in playwright_cookies])

        # 準備你原本就在用的專屬 Headers，並動態塞入最新 Cookie
        MENU_HEADERS = {
            'accept': 'application/json, text/plain, */*',
            'accept-language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
            'origin': 'https://www.foodpanda.com.tw',
            'referer': 'https://www.foodpanda.com.tw/',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'x-fp-api-key': 'volo',
            # 👇 這三個就是 Foodpanda 伺服器在找的 Perseus 標頭 (請貼上你之前成功那版的數值)
            'perseus-client-id': '1769094127948.159840585323234630.bws3tkerda', 
            'perseus-session-id': '1780327747693.165424540997931823.6zxvvoz8ea',
            'dps-session-id': 'eyJzZXNzaW9uX2lkIjoiMmQ0ZDM4MDdjYWE2ODE2ODk5ZWMxYzMzYzhlMmVlMWYiLCJwZXJzZXVzX2lkIjoiMTc2OTA5NDEyNzk0OC4xNTk4NDA1ODUzMjMyMzQ2MzAuYndzM3RrZXJkYSIsInRpbWVzdGFtcCI6MTc4MDMyOTAzNX0=',
            # 👇 把剛剛抽出來的無敵 Cookie 塞進來！
            'cookie': cookie_string 
        }

        import requests # 確保最上面有 import requests

        for idx, code in enumerate(vendor_codes, 1):
            print(f"[{idx}/{len(vendor_codes)}] 正在處理: {code}")
            
            api_url = f"https://tw.fd-api.com/api/v5/vendors/{code}?include=menus,bundles,multiple_discounts&language_id=6&opening_type=delivery&basket_currency=TWD&latitude=23.967090&longitude=120.963711"
            
            try:
                # 🌟 改回用 requests 發送，因為它能完美帶上所有的 Perseus Headers
                res = requests.get(api_url, headers=MENU_HEADERS)
                
                if res.status_code == 200:
                    menu_data = res.json()
                    save_to_database(menu_data)
                else:
                    print(f"   ⚠️ 抓取失敗，狀態碼: {res.status_code}")
                    print(f"   伺服器回應: {res.text}")
                    
            except Exception as e:
                print(f"   ❌ 發生錯誤: {e}")

            # 模擬人類休息
            sleep_time = round(random.uniform(3.5, 6.5), 1)
            print(f"   💤 休息 {sleep_time} 秒...\n")
            time.sleep(sleep_time)

        # 結束關閉連線
        browser.close() # 如果你是用 connect_over_cdp，這裡維持 browser.close() 或 context.close()
        print("🎉 太神啦！埔里全鎮餐廳菜單已全數收錄至資料庫！")

if __name__ == "__main__":
    run_playwright_scraper()