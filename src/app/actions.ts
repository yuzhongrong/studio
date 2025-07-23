'use server';

import { suggestFilters, SuggestFiltersInput } from '@/ai/flows/suggest-filters';
import { getDb } from '@/lib/mongodb';
import { fetchOkxCandles, calculateRSI } from '@/lib/okx-service';
import { sendTelegramAlert } from '@/lib/telegram-service';
import { sendBuySignalEmails } from '@/lib/email-service';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function saveToMongo(data: any) {
    if (!process.env.MONGO_URI || process.env.MONGO_URI.includes("YOUR_CONNECTION_STRING")) {
        console.warn('MONGO_URI not set or is a placeholder, skipping database save.');
        return { success: true, message: 'Database not configured, skipped saving.' };
    }
    try {
        const db = await getDb();
        if (!db) {
             return { success: true, message: 'Database not configured, skipped saving.' };
        }
        const collection = db.collection('pairs');
        
        // Diagnostic step: Check for TTL indexes on the 'mails' collection
        try {
            const mailsCollection = db.collection('mails');
            const indexes = await mailsCollection.indexes();
            // console.log("Checking indexes for 'mails' collection:", JSON.stringify(indexes, null, 2));
            const ttlIndex = indexes.find(idx => idx.hasOwnProperty('expireAfterSeconds'));
            if (ttlIndex) {
                console.warn(`
                ********************************************************************************
                WARNING: TTL index found on 'mails' collection!
                This is likely the cause of subscriptions disappearing automatically.
                Index details: ${JSON.stringify(ttlIndex)}
                To fix this, you need to drop this index from your MongoDB 'mails' collection.
                ********************************************************************************
                `);
            }
        } catch (indexError) {
            // console.error("Could not check indexes for 'mails' collection. It might not exist yet.", indexError);
        }

        const solAddress = "So11111111111111111111111111111111111111112";
        const usdcAddress = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
        const allowedQuoteTokens = [solAddress, usdcAddress];

        if (data && data.data && Array.isArray(data.data)) {
            const operations = data.data.map((item: any) => {
                if (item.pairAddress && !item.Error && item.baseToken && item.quoteToken &&
                    item.baseToken.address !== solAddress &&
                    allowedQuoteTokens.includes(item.quoteToken.address)
                ) {
                    return {
                        replaceOne: {
                            filter: { _id: item.pairAddress },
                            replacement: { ...item, _id: item.pairAddress },
                            upsert: true,
                        },
                    };
                }
                return null;
            }).filter((op: any) => op !== null);

            if (operations.length > 0) {
                const result = await collection.bulkWrite(operations);
                const { upsertedCount, modifiedCount } = result;
                const message = `${upsertedCount} new documents added, ${modifiedCount} documents updated.`;
                console.log(message);
                return { success: true, message: message };
            }
             return { success: true, message: 'No new valid data to save.' };
        } else {
            throw new Error("Invalid data structure from API. Expected a 'data' array in the response.");
        }
    } catch (error: any) {
        console.error('Failed to save data to MongoDB. Full error: ', JSON.stringify(error, null, 2));
        if (error.name === 'MongoNetworkError' || error.name === 'MongoServerSelectionError') {
             throw new Error(`Database connection failed. Please check if the server can reach the database. Details: ${error.message}`);
        }
        throw new Error(`Database save failed: ${error.message}`);
    }
}


export async function fetchApiData(url: string) {
  try {
    if (!url || !url.startsWith('http')) {
      return { data: null, error: 'Please enter a valid URL.' };
    }
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      const errorText = await response.text();
      return { data: null, error: `API Error: ${response.status} ${response.statusText}. Details: ${errorText}` };
    }
    
    const responseText = await response.text();
    let data;
    try {
        data = JSON.parse(responseText);
    } catch (e) {
         return { data: null, error: 'Failed to parse JSON response. The API might not be returning valid JSON.' };
    }

    try {
      const dbResult = await saveToMongo(data);
      return { data, error: null, successMessage: dbResult.message };
    } catch (dbError: any) {
      return { data, error: dbError.message };
    }

  } catch (error: any) {
    if (error instanceof TypeError && error.message.includes('fetch failed')) {
        return { data: null, error: 'Network error or invalid URL. Please check the API endpoint and your connection.' };
    }
    console.error('Fetch API Data Error:', error);
    return { data: null, error: `An unknown error occurred: ${error.message}` };
  }
}

export async function getFilterSuggestions(input: SuggestFiltersInput) {
    try {
        const result = await suggestFilters(input);
        return { suggestions: result.filterExpressions, error: null };
    } catch (error) {
        console.error('Get Filter Suggestions Error:', error);
        return { suggestions: null, error: 'Failed to get suggestions from AI. Please try again.' };
    }
}

const formatMarketCap = (marketCap: number) => {
    if (!marketCap) return 'N/A';
    if (marketCap >= 1_000_000_000) return `${(marketCap / 1_000_000_000).toFixed(2)}B`;
    if (marketCap >= 1_000_000) return `${(marketCap / 1_000_000).toFixed(2)}M`;
    if (marketCap >= 1_000) return `${(marketCap / 1_000).toFixed(2)}K`;
    return marketCap.toFixed(2);
};

export async function updateRsiData() {
    if (!process.env.MONGO_URI || process.env.MONGO_URI.includes("YOUR_CONNECTION_STRING")) {
        return { success: false, error: 'MongoDB is not configured. Please set MONGO_URI in your .env file.' };
    }
    try {
        await sleep(1000); 

        const db = await getDb();
        if (!db) {
            return { success: false, error: 'MongoDB is not configured or connection failed.' };
        }
        const pairsCollection = db.collection('pairs');
        const rsiCollection = db.collection('rsi_data');
        const pairs = await pairsCollection.find({}).toArray();

        if (pairs.length === 0) {
            return { success: true, message: "No pairs in database to process." };
        }

        const solAddress = "So11111111111111111111111111111111111111112";
        let updatedCount = 0;
        let failedCount = 0;

        for (const pair of pairs) {
            try {
                let tokenContractAddress = pair.baseToken?.address;
                if (tokenContractAddress === solAddress) {
                    tokenContractAddress = pair.quoteToken?.address;
                }
                
                if (!tokenContractAddress) {
                    console.warn(`Skipping pair ${pair.pairAddress} because a valid token address could not be found.`);
                    continue;
                }

                const { parsedData: candles5m, rawData: raw5m } = await fetchOkxCandles(tokenContractAddress, '5m', 200);
                await sleep(1000);
                const { parsedData: candles1h, rawData: raw1h } = await fetchOkxCandles(tokenContractAddress, '1H', 200);
                
                const rsi5m = calculateRSI(candles5m.map(c => c.close));
                const rsi1h = calculateRSI(candles1h.map(c => c.close));
                
                if (rsi1h && rsi5m) {
                    const marketCapFormatted = formatMarketCap(pair.marketCap);
                    const alertData = {
                        symbol: pair.baseToken?.symbol || 'N/A',
                        action: '买入',
                        rsi1h: rsi1h.toFixed(2),
                        rsi5m: rsi5m.toFixed(2),
                        marketCap: marketCapFormatted,
                        tokenContractAddress: tokenContractAddress,
                    };
                    
                    const alertCondition = rsi1h < 30 && rsi1h >= 10 && rsi5m < 30;
                    
                    if (alertCondition) {
                        if (process.env.TELEGRAM_NOTIFICATIONS_ENABLED === 'true') {
                            const message = `
🔔 *RSI Alert* 🔔
Token: *${alertData.symbol}*
Action: *${alertData.action}*
RSI (1H): \`${alertData.rsi1h}\`
RSI (5m): \`${alertData.rsi5m}\`
MC: \`${alertData.marketCap}\`
CA: \`${alertData.tokenContractAddress}\`

[View on GMGN](https://gmgn.ai/sol/token/${alertData.tokenContractAddress})
                            `;
                            await sendTelegramAlert(message);
                        }
                        
                        console.log(`Production condition met for ${alertData.symbol}. Triggering email send.`);
                        await sendBuySignalEmails(alertData);
                    }
                }

                const rsiDataToSave = {
                    tokenContractAddress: tokenContractAddress,
                    'rsi-5m': rsi5m,
                    'rsi-1h': rsi1h,
                    'rsi_200_5m': raw5m,
                    'rsi_200_1h': raw1h,
                    symbol: pair.baseToken?.symbol,
                    priceChange: pair.priceChange,
                    marketCap: pair.marketCap,
                    info: pair.info,
                    lastUpdated: new Date()
                };
                
                await rsiCollection.updateOne(
                    { tokenContractAddress: tokenContractAddress },
                    { $set: rsiDataToSave },
                    { upsert: true }
                );
                updatedCount++;
                
                await sleep(1000);

            } catch (error: any) {
                failedCount++;
                console.error(`Failed to process RSI for pair ${pair.pairAddress}: ${error.message}`);
                await sleep(1000);
            }
        }

        const message = `RSI update complete. Successfully updated: ${updatedCount}, Failed: ${failedCount}.`;
        console.log(message);
        return { success: true, message: message };

    } catch (error: any) {
        console.error('A critical error occurred in updateRsiData:', error);
        return { success: false, error: `Failed to update RSI data: ${error.message}` };
    }
}
