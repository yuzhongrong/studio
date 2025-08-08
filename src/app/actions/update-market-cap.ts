
'use server';

import { getDb } from '@/lib/mongodb';
import { fetchPairData } from '@/lib/dexscreener-service';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function updatePairDataFromDexScreener() {
    if (!process.env.MONGO_URI || process.env.MONGO_URI.includes("YOUR_CONNECTION_STRING")) {
        return { success: false, error: 'MongoDB is not configured. Please set MONGO_URI in your .env file.' };
    }

    try {
        const db = await getDb();
        if (!db) {
            return { success: false, error: 'MongoDB is not configured or connection failed.' };
        }
        
        const pairsCollection = db.collection('pairs');
        // Get all pair addresses from the pairs collection
        const pairs = await pairsCollection.find({}, { projection: { _id: 1 } }).toArray();
        const pairAddresses = pairs.map(p => p._id);

        if (pairAddresses.length === 0) {
            return { success: true, message: "No pairs in database to process for pair data update." };
        }
        
        console.log(`[PairData Task] Found ${pairAddresses.length} pairs to update from DexScreener.`);

        let updatedCount = 0;
        let failedCount = 0;
        
        for (const pairAddress of pairAddresses) {
            try {
                const pairData = await fetchPairData(pairAddress);
                
                if (pairData && pairData.pair) {
                    const updateData = pairData.pair;
                    // DexScreener uses pairAddress, but our _id is the same, so we don't need to add it.
                    // We just update the document with the new data.
                    const result = await pairsCollection.updateOne(
                        { _id: pairAddress },
                        { $set: { ...updateData, lastUpdated: new Date() } }
                    );
                    
                    if (result.modifiedCount > 0) {
                        updatedCount++;
                    }
                } else {
                     console.warn(`[PairData Task] No pair data returned for address: ${pairAddress}`);
                     failedCount++;
                }

                await sleep(1000); // Sleep 1 second between requests to avoid rate limiting
            } catch (error: any) {
                console.error(`[PairData Task] Failed to process pair ${pairAddress}: ${error.message}`);
                failedCount++;
            }
        }
        
        const message = `Pair data update from DexScreener complete. Successfully updated: ${updatedCount}, Failed to process: ${failedCount}.`;
        console.log(`[PairData Task] ${message}`);
        return { success: true, message: message };

    } catch (error: any) {
        console.error('[PairData Task] A critical error occurred in updatePairDataFromDexScreener:', error);
        return { success: false, error: `Failed to update pair data: ${error.message}` };
    }
}
