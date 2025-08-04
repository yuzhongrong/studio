import { MongoClient, Db } from 'mongodb';
import { config } from 'dotenv';

// Ensure environment variables are loaded
config();

const uri = process.env.MONGO_URI;
const dbName = 'pumpwatch'; // Explicitly set the database name

// A basic check for a placeholder value.
if (!uri || uri.includes("YOUR_CONNECTION_STRING")) {
  console.warn('MongoDB URI is not configured or is a placeholder. Database features will be disabled.');
}

const options = {};

let client: MongoClient | undefined;
let clientPromise: Promise<MongoClient> | undefined;
let dbPromise: Promise<Db> | undefined;

if (uri && !uri.includes("YOUR_CONNECTION_STRING")) {
    if (process.env.NODE_ENV === 'development') {
      // In development mode, use a global variable so that the value
      // is preserved across module reloads caused by HMR (Hot Module Replacement).
      let globalWithMongo = global as typeof globalThis & {
        _mongoClientPromise?: Promise<MongoClient>;
      };

      if (!globalWithMongo._mongoClientPromise) {
        client = new MongoClient(uri, options);
        globalWithMongo._mongoClientPromise = client.connect();
      }
      clientPromise = globalWithMongo._mongoClientPromise;
      // Explicitly connect to the intended database name
      dbPromise = clientPromise.then(client => client.db(dbName));
    } else {
      // In production mode, it's best to not use a global variable.
      client = new MongoClient(uri, options);
      clientPromise = client.connect();
      // Explicitly connect to the intended database name
      dbPromise = clientPromise.then(client => client.db(dbName));
    }
}


export async function getDb(): Promise<Db | null> {
    if (!dbPromise) {
        return null;
    }
    try {
        const db = await dbPromise;
        // Log the database name on first successful connection to confirm.
        if (db && db.databaseName) {
            // console.log(`Successfully connected to database: ${db.databaseName}`);
        }
        return db;
    } catch (error) {
        console.error("Failed to connect to the database", error);
        return null;
    }
}

export async function createTtlIndex() {
  const db = await getDb();
  if (!db) {
    console.error('Cannot create TTL index because database connection is not available.');
    return;
  }
  try {
    const pairsCollection = db.collection('pairs');
    // Index ensures that documents are automatically removed from a collection after a certain amount of time
    await pairsCollection.createIndex(
      { "lastUpdated": 1 },
      { expireAfterSeconds: 86400 } // 24 hours
    );
    console.log("TTL index on 'pairs' collection for 'lastUpdated' field ensured.");
  } catch (error) {
    console.error("Failed to create TTL index:", error);
  }
}
