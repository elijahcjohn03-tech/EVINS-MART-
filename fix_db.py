
import sqlite3
import json

conn = sqlite3.connect('instance/database.db')
cursor = conn.cursor()

try:
    cursor.execute('ALTER TABLE product ADD COLUMN color VARCHAR(50)')
except Exception as e:
    print('Alter error:', e)

with open('products.json', 'r', encoding='utf-8') as f:
    products = json.load(f)

for p in products:
    if 'color' in p:
        cursor.execute('UPDATE product SET color = ? WHERE id = ?', (p['color'], p['id']))

conn.commit()
conn.close()
print('Done!')

