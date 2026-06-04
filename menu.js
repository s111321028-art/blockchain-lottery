import requests
import psycopg2
import json

# ==========================================
# 1. 資料庫連線設定 (請替換成你的密碼)
# ==========================================
DB_CONFIG = {
    "dbname": "postgres",
    "user": "postgres",
    "password": "YOUR_PASSWORD_HERE", # ⚠️ 替換成你的 PostgreSQL 密碼
    "host": "localhost",
    "port": "5432"
}

def fetch_foodpanda_menu():
    """發送 HTTP 請求獲取 Foodpanda 餐廳菜單"""
    headers = {
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
        'api-version': '7',
        'origin': 'https://www.foodpanda.com.tw',
        'priority': 'u=1, i',
        'referer': 'https://www.foodpanda.com.tw/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
        'x-fp-api-key': 'volo',
        'x-pd-language-id': '6',
    }

    url = 'https://tw.fd-api.com/api/v5/vendors/jpzo?include=menus,bundles,multiple_discounts&language_id=6&opening_type=delivery&basket_currency=TWD&latitude=23.96835567567703&longitude=120.97385069853132'

    print("🚀 正在向 Foodpanda 發送請求...")
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status() # 檢查是否有 HTTP 錯誤
        return response.json()
    except Exception as e:
        print(f"❌ 請求失敗: {e}")
        return None

def extract_and_save_data(raw_data):
    """解析 JSON 資料並寫入 PostgreSQL"""
    if not raw_data or 'data' not in raw_data:
        print("❌ 無法解析資料格式，請確認 JSON 結構")
        return

    # --- 1. 萃取餐廳基本資訊 ---
    restaurant_info = raw_data['data']
    r_name = restaurant_info.get('name', '未命名餐廳')
    r_lat = restaurant_info.get('latitude', 0.0)
    r_lng = restaurant_info.get('longitude', 0.0)
    r_address = restaurant_info.get('address', '無地址')
    
    print(f"\n🏪 找到餐廳：{r_name}")
    print(f"📍 座標：{r_lat}, {r_lng} | 地址：{r_address}")

    # --- 2. 準備寫入資料庫 ---
    conn = None
    cursor = None
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        print("\n✅ 成功連線至資料庫，準備寫入...")

        # 寫入餐廳，並取得自動生成的 ID
        insert_restaurant_sql = """
            INSERT INTO restaurants (name, lat, lng, address)
            VALUES (%s, %s, %s, %s)
            RETURNING id;
        """
        cursor.execute(insert_restaurant_sql, (r_name, r_lat, r_lng, r_address))
        restaurant_id = cursor.fetchone()[0]

        # --- 3. 萃取菜單資訊並寫入 ---
        # Foodpanda 的菜單結構通常是：menus -> [categories] -> products
        menus = restaurant_info.get('menus', [])
        if not menus:
            print("⚠️ 找不到菜單資料")
            return

        insert_menu_sql = """
            INSERT INTO menu_items (restaurant_id, name, price, reward)
            VALUES (%s, %s, %s, %s);
        """
        
        item_count = 0
        for category in menus[0].get('menu_categories', []):
            for product in category.get('products', []):
                p_name = product.get('name', '未命名餐點')
                # 價格可能藏在 product_variations 裡面
                variations = product.get('product_variations', [])
                if variations:
                    p_price = variations[0].get('price', 0)
                else:
                    p_price = 0
                
                # 計算回饋點數 (例如價格的 10%)
                p_reward = int(p_price * 0.1)
                
                cursor.execute(insert_menu_sql, (restaurant_id, p_name, p_price, p_reward))
                item_count += 1
                
        print(f"🍽️ 成功新增 {item_count} 道菜單項目！")

        # 提交變更
        conn.commit()
        print("🎉 所有資料已成功寫入 PostgreSQL！")

    except Exception as e:
        print(f"❌ 資料庫寫入失敗: {e}")
        if conn:
            conn.rollback() # 發生錯誤時退回
    finally:
        if cursor: cursor.close()
        if conn: conn.close()

# ==========================================
# 執行主程式
# ==========================================
if __name__ == "__main__":
    print("開始執行 Foodpanda 埔里爬蟲程式...")
    raw_json_data = fetch_foodpanda_menu()
    extract_and_save_data(raw_json_data)