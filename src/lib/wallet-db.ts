import { getDb } from '@/lib/mongodb';

export interface Wallet {
    publicKey: string;
    secretKey: string; // This should be encrypted in a real-world app
    name?: string;
}

const getWalletsCollection = async () => {
    const db = await getDb();
    if (!db) {
        throw new Error('Database connection failed.');
    }
    return db.collection<Wallet>('wallets');
}

export async function saveWallet(wallet: Wallet) {
    const collection = await getWalletsCollection();
    // Use publicKey as the unique ID to prevent duplicates
    return await collection.replaceOne({ publicKey: wallet.publicKey }, wallet, { upsert: true });
}

export async function getWallets(): Promise<Wallet[]> {
    const collection = await getWalletsCollection();
    return await collection.find({}).toArray();
}

export async function getWallet(publicKey: string): Promise<Wallet | null> {
    const collection = await getWalletsCollection();
    return await collection.findOne({ publicKey });
}
