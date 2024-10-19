import sqlite3
from pymongo import MongoClient
import dateutil


MONGODB_CONNECTION_STRING = "mongodb://staff-fm-admin:dev-admin@localhost:27018/staff-fm?authSource=admin"
SQLITE_FILE_PATH = "~/whoknows/database.sqlite"
WHOKNOWS_USER_ID = "1197999321589743706"

if __name__ == "__main__":
    con = sqlite3.connect(SQLITE_FILE_PATH)
    mongodb = MongoClient(MONGODB_CONNECTION_STRING)["staff-fm"]

    cursor = con.cursor()
    cursor.execute("SELECT * from bans")
    count = 0
    for row in cursor.fetchall():
        print("Importing", row[2], row[3])
        mongodb["Users"].update_one(
           filter = { "userId": row[2] },
           update = { "$set": { 'crownsBan': {"bannedOn": dateutil.parser.parse(row[3]), "bannedById": WHOKNOWS_USER_ID} } },
           upsert = True
        )
        count = count + 1
    print("Imported", count, "crowns bans.")
