import { MongoClient, Db } from 'mongodb';

if (!process.env.MONGO_URI) {
  throw new Error('Invalid/Missing environment variable: "MONGO_URI"');
}

const uri = process.env.MONGO_URI;
const options = {};

let client: MongoClient;
let db: Db;

if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  let globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>;
    _mongoDbPromise?: Promise<Db>;
  };

  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri, options);
    globalWithMongo._mongoClientPromise = client.connect();
  }
  
  const clientPromise = globalWithMongo._mongoClientPromise;
  
  if (!globalWithMongo._mongoDbPromise) {
      globalWithMongo._mongoDbPromise = clientPromise.then(client => client.db());
  }

  const dbPromise = globalWithMongo._mongoDbPromise;

  getDb = async function() {
      return dbPromise;
  }

} else {
  // In production mode, it's best to not use a global variable.
  client = new MongoClient(uri, options);
  const clientPromise = client.connect();
  db = client.db();
  const dbPromise = clientPromise.then(client => client.db());

  getDb = async function() {
    return dbPromise;
  }
}

export let getDb: () => Promise<Db>;
