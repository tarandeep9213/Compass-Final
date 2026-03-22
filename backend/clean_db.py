import sqlite3

conn = sqlite3.connect("cashroom.db")
cursor = conn.cursor()

cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = cursor.fetchall()

for table in tables:
    if table[0] != "sqlite_sequence":
        cursor.execute(f"DELETE FROM {table[0]};")

conn.commit()
conn.close()

print("All tables cleaned")