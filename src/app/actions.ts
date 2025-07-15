'use server';

import { suggestFilters, SuggestFiltersInput } from '@/ai/flows/suggest-filters';
import { getDb } from '@/lib/mongodb';
import { fetchOkxCandlesAndCalculateRsi } from '@/lib/okx-service';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function saveToMongo(data: any) {
    if (!process.env.MONGO_URI) {
        console.warn('MONGO_URI not set, skipping database save.');
        throw new Error('MongoDB URI is not configured on the server.');
    }
    try {
        const db = await getDb();
        const collection = db.collection('pairs');
        const solAddress = "So11111111111111111111111111111111111111112";

        if (data && data.data && Array.isArray(data.data)) {
            const operations = data.data.map((item: any) => {
                if (item.pairAddress && !item.Error && item.baseToken && item.quoteToken &&
                    item.baseToken.address !== solAddress &&
                    item.quoteToken.address === solAddress
                ) {
                    // Use replaceOne with upsert to either insert a new document 
                    // or completely replace an existing one.
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

export async function getMongoData() {
    if (!process.env.MONGO_URI) {
        return { data: null, error: 'MongoDB is not configured.' };
    }
    try {
        const db = await getDb();
        const collection = db.collection('pairs');
        const data = await collection.find({}).toArray();
        const serializableData = data.map(item => ({
            ...item,
            _id: item._id.toString(),
        }));
        return { data: serializableData, error: null };
    } catch (error: any) {
        console.error('Failed to fetch data from MongoDB:', error);
        return { data: null, error: `Failed to retrieve data from the database: ${error.message}` };
    }
}

export async function updateRsiData() {
    if (!process.env.MONGO_URI) {
        return { success: false, error: 'MongoDB is not configured.' };
    }
    try {
        const db = await getDb();
        const pairsCollection = db.collection('pairs');
        const rsiCollection = db.collection('rsi_data');
        const pairs = await pairsCollection.find({}).toArray();

        if (pairs.length === 0) {
            return { success: true, successMessage: "No pairs in database to process." };
        }

        const solAddress = "So11111111111111111111111111111111111111112";
        let updatedCount = 0;

        for (const pair of pairs) {
            let tokenContractAddress = pair.baseToken?.address;
            if (tokenContractAddress === solAddress) {
                tokenContractAddress = pair.quoteToken?.address;
            }

            if (!tokenContractAddress) {
                console.warn(`Skipping pair ${pair._id} due to missing token address.`);
                continue;
            }

            try {
                const rsiData = await fetchOkxCandlesAndCalculateRsi(tokenContractAddress);
                
                if(rsiData) {
                  await rsiCollection.updateOne(
                      { _id: tokenContractAddress },
                      { $set: { ...rsiData, _id: tokenContractAddress, lastUpdated: new Date() } },
                      { upsert: true }
                  );
                  updatedCount++;
                }
                
                await sleep(1000);

            } catch (error: any) {
                console.error(`Failed to process RSI for ${tokenContractAddress}: ${error.message}`);
            }
        }

        return { success: true, successMessage: `Successfully updated RSI for ${updatedCount} tokens.` };

    } catch (error: any) {
        console.error('Failed to update RSI data:', error);
        return { success: false, error: `Failed to update RSI data: ${error.message}` };
    }
}
