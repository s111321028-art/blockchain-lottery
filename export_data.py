import psycopg2
import csv

# 這是你原本在本機開發的資料庫設定
DB_CONFIG = {
    "dbname": "postgres",
    "user": "postgres",
    "password": "aa921116",  
    "host": "localhost",
    "port": "5432"
}

def export_table_to_csv(table_name):
    conn = None
    try:
        # 連線到本機資料庫
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # 抓取該資料表的所有資料
        cursor.execute(f"SELECT * FROM {table_name};")
        rows = cursor.fetchall()
        
        # 抓取欄位名稱 (表頭 Header)
        colnames = [desc[0] for desc in cursor.description]
        
        # 建立並寫入 CSV 檔案 (設定 utf-8 避免中文亂碼)
        with open(f"{table_name}.csv", "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(colnames)  # 寫入第一行標題
            writer.writerows(rows)     # 寫入所有資料
            
        print(f"✅ 大成功！{table_name}.csv 已經順利匯出 ({len(rows)} 筆資料)！")
        
    except Exception as e:
        print(f"❌ 發生錯誤: {e}")
    finally:
        if conn:
            cursor.close()
            conn.close()

# 呼叫函式，直接幫你把兩個表都匯出
print("⏳ 開始從本機資料庫匯出資料...")
export_table_to_csv("restaurants")
export_table_to_csv("menu_items")