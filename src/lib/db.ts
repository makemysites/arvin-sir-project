import { MongoClient, type Db } from "mongodb";

// One cached connection per serverless instance (Vercel reuses warm instances).
declare global {
  var _mongoDb: Promise<Db> | undefined;
}

async function connect(): Promise<Db> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("exam_platform");

  // Idempotent — runs once per cold start.
  await Promise.all([
    db.collection("users").createIndex({ email: 1 }, { unique: true }),
    db.collection("otps").createIndex({ email: 1 }, { unique: true }),
    // Mongo auto-deletes expired OTP docs.
    db.collection("otps").createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }),
    db.collection("questions").createIndex({ exam_id: 1, position: 1 }),
    db.collection("attempts").createIndex({ exam_id: 1, student_id: 1 }, { unique: true }),
    db.collection("reviews").createIndex({ exam_id: 1, student_id: 1 }, { unique: true }),
    db.collection("issues").createIndex({ exam_id: 1, created_at: -1 }),
  ]);
  return db;
}

export function getDb(): Promise<Db> {
  if (!global._mongoDb) {
    global._mongoDb = connect().catch((err) => {
      global._mongoDb = undefined; // don't cache a failed connection; retry next request
      throw err;
    });
  }
  return global._mongoDb;
}
