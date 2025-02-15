from pymongo import MongoClient
import dateutil
import re
from datetime import datetime

MONGODB_CONNECTION_STRING = "mongodb://staff-fm-admin:dev-admin@localhost:27018/staff-fm?authSource=admin"
FLAGS_TXT_PATH = "./flags.txt"
STAFF_FM_USER_ID = "1236098444532125756"

if __name__ == "__main__":
    mongodb = MongoClient(MONGODB_CONNECTION_STRING)["staff-fm"]
    count = 0
    with open(FLAGS_TXT_PATH, "r") as file:
        for line in file:
            match = re.match(r"^\d+\.\s([\w\-\.]+):\s(.+)\(", line)
            document = {
                "term": match.group(0),
                "reason": match.group(1),
                "createdAt": datetime.now(),
                "createdBy": "1236098444532125756"
            }
            print("Importing", match.group(0))
            mongodb["Flags"].insert_one(document)
            count = count + 1

    print("Imported", count, "flags.")
