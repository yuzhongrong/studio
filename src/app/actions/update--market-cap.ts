
'use server';

import { getDb } from '@/lib/mongodb';
import { fetchOkxMarketData } from '@/lib/okx-market-service';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function updateMarketCapData() {
    if (!process.env.MONGO_URI || process.env.MONGO_URI.includes("YOUR_CONNECTION_STRING")) {
        return { success: false, error: 'MongoDB is not configured. Please set MONGO_URI in your .env file.' };
    }

    try {
        const db = await getDb();
        if (!db) {
            return { success: false, error: 'MongoDB is not configured or connection failed.' };
        }
        
        const pairsCollection = db.collection('pairs');
        // Get all unique contract addresses from the pairs collection
        const pairs = await pairsCollection.find({}, { projection: { baseToken: 1, quoteToken: 1 } }).toArray();
        const solAddress = "So11111111111111111111111111111111111111112";

        const allContractAddresses = pairs.map(p => {
            return p.baseToken?.address === solAddress ? p.quoteToken?.address : p.baseToken?.address;
        }).filter((addr): addr is string => !!addr);

        if (allContractAddresses.length === 0) {
            return { success: true, message: "No pairs in database to process for market cap update." };
        }
        
        console.log(`[MarketCap Task] Found ${allContractAddresses.length} addresses to update.`);

        const BATCH_SIZE = 10;
        let updatedCount = 0;
        let failedCount = 0;
        
        for (let i = 0; i < allContractAddresses.length; i += BATCH_SIZE) {
            const batch = allContractAddresses.slice(i, i + BATCH_SIZE);
            console.log(`[MarketCap Task] Processing batch ${i / BATCH_SIZE + 1} with ${batch.length} addresses...`);
            try {
                const marketData = await fetchOkxMarketData(batch);
                console.log('[MarketCap Task] Received market data from OKX:', JSON.stringify(marketData, null, 2));


                if (marketData && marketData.length > 0) {
                    const operations = marketData.map(item => ({
                        updateOne: {
                            filter: { 
                                $or: [
                                    { "baseToken.address": item.tokenContractAddress },
                                    { "quoteToken.address": item.tokenContractAddress }
                                ]
                            },
                            update: { 
                                $set: { 
                                    marketCap: parseFloat(item.marketCap) 
                                } 
                            }
                        }
                    }));

                    if (operations.length > 0) {
                        const result = await pairsCollection.bulkWrite(operations);
                        updatedCount += result.modifiedCount;
                        console.log(`[MarketCap Task] Batch updated. Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);
                    }
                }
                
                await sleep(1000); // Sleep between batches to avoid rate limiting
            } catch (error: any) {
                console.error(`[MarketCap Task] Failed to process batch: ${error.message}`);
                failedCount += batch.length;
            }
        }
        
        const message = `Market cap update complete. Successfully updated: ${updatedCount}, Failed to process: ${failedCount}.`;
        console.log(`[MarketCap Task] ${message}`);
        return { success: true, message: message };

    } catch (error: any) {
        console.error('[MarketCap Task] A critical error occurred in updateMarketCapData:', error);
        return { success: false, error: `Failed to update market cap data: ${error.message}` };
    }
}
