import { MongoClient, Db } from 'mongodb';
import { config } from 'dotenv';

// Ensure environment variables are loaded
config();

const uri = process.env.MONGO_URI;
let dbName = 'pumpwatch'; // Default database name

// A basic check for a placeholder value.
if (!uri || uri.includes("YOUR_CONNECTION_STRING")) {
  console.warn('MongoDB URI is not configured or is a placeholder. Database features will be disabled.');
} else {
    // Attempt to parse dbName from URI if not 'test'
    try {
        const url = new URL(uri);
        const pathDbName = url.pathname.slice(1);
        if (pathDbName && pathDbName !== 'test') { // 'test' is often a placeholder
            dbName = pathDbName;
        }
    } catch (e) {
        console.warn("Could not parse database name from MONGO_URI, defaulting to 'pumpwatch'.");
    }
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
      dbPromise = clientPromise.then(client => client.db(dbName));
    } else {
      // In production mode, it's best to not use a global variable.
      client = new MongoClient(uri, options);
      clientPromise = client.connect();
      dbPromise = clientPromise.then(client => client.db(dbName));
    }
}


export async function getDb(): Promise<Db | null> {
    if (!dbPromise) {
        return null;
    }
    try {
        return await dbPromise;
    } catch (error) {
        console.error("Failed to connect to the database", error);
        return null;
    }
}
