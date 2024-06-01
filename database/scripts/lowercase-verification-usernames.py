from pymongo import MongoClient

MONGODB_CONNECTION_STRING = "mongodb://staff-fm-admin:dev-admin@localhost:27018/staff-fm?authSource=admin"

if __name__ == "__main__":
    mongodb = MongoClient(MONGODB_CONNECTION_STRING)["staff-fm"]
    cursor =  mongodb["Users"].find({})
    count = 0
    for doc in cursor:
        pk = doc.get("userId")
        print("Updating {}", pk)
        for verification in doc.get("verifications"):
            username = verification.get("username")
            if username:
                print(username)
                username = username.lower()
                mongodb["Users"].update_one({"userId": pk, "verifications._id": verification.get("_id")}, {"$set": { 'verifications.$.username': username } } )
        count = count + 1
    print("Updated", count, "users.")
