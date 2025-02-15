from pymongo import MongoClient
import dateutil
from datetime import datetime
import csv

MONGODB_CONNECTION_STRING = "mongodb://staff-fm-admin:dev-admin@localhost:27018/staff-fm?authSource=admin"
VERIFICATIONS_CSV_PATH = "./verifications.csv"
STAFF_FM_USER_ID = "1236098444532125756"

if __name__ == "__main__":
    mongodb = MongoClient(MONGODB_CONNECTION_STRING)["staff-fm"]
    count = 0
    with open(VERIFICATIONS_CSV_PATH, mode='r', newline='', encoding='utf-8') as file:
        csv_reader = csv.reader(file)

        # Iterate over each row in the CSV
        next(csv_reader)
        for row in csv_reader:
            if row[1] == "":
                break
            username = row[2].lower() if row[2] != "" else None
            userId = row[1]
            already_verified = False
            existing = mongodb["Users"].find_one({"userId": userId})
            if existing is not None:
                if "verifications" in existing:
                    for verification in existing["verifications"]:
                        if username is None and "username" not in verification:
                            # verification without username means no last.fm account verification exists
                            print("Already verified", userId, username)
                            already_verified = True
                            break
                        if "username" in verification and verification["username"] == username:
                            # if username exists in verification, and it's the same, skip
                            print("Already verified", userId, username)
                            already_verified = True
                            break

            if already_verified:
                continue

            print("Importing", userId, username)
            count = count + 1
            verification  = {
                "verifiedOn": dateutil.parser.parse(row[4]) if row[4] != "" else datetime.now(),
                "verifiedById": STAFF_FM_USER_ID
            }

            if username is not None:
                verification["username"] = username

            result = mongodb["Users"].update_one(
                filter= {"userId": userId },
                update={ "$addToSet": { "verifications": verification } },
                upsert=True
            )

    print("Imported", count, "verifications.")
