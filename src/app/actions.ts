'use server';

import { suggestFilters, SuggestFiltersInput } from '@/ai/flows/suggest-filters';
import { getDb } from '@/lib/mongodb';

async function saveToMongo(data: any) {
    if (!process.env.MONGO_URI) {
        console.warn('MONGO_URI not set, skipping database save.');
        // We will now let the caller handle UI feedback for this case
        throw new Error('MongoDB URI is not configured on the server.');
    }
    try {
        const db = await getDb();
        const collection = db.collection('pairs');

        if (data && data.pairs && Array.isArray(data.pairs)) {
            const operations = data.pairs.map((item: any) => {
                if (item.pairAddress) {
                    return {
                        updateOne: {
                            filter: { _id: item.pairAddress },
                            update: { $set: { ...item, _id: item.pairAddress } },
                            upsert: true,
                        },
                    };
                }
                return null;
            }).filter((op: any) => op !== null);

            if (operations.length > 0) {
                const result = await collection.bulkWrite(operations);
                console.log(`${result.upsertedCount + result.modifiedCount} documents processed in MongoDB.`);
                return { success: true, message: `${result.upsertedCount + result.modifiedCount} documents saved.` };
            }
             return { success: true, message: 'No new data to save.' };
        } else {
            // Throw an error if the expected data structure is not found
            throw new Error("Invalid data structure received from API. Expected a 'pairs' array.");
        }
    } catch (error: any) {
        console.error('Failed to save data to MongoDB:', error);
        // Re-throw the error to be caught by the calling function
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

    // Now we await the save operation and catch potential errors
    try {
      await saveToMongo(data);
    } catch (dbError: any) {
      // If DB save fails, we still return the fetched data but include the DB error in the response.
      // This allows the user to see the data while being notified of the DB issue.
      return { data, error: dbError.message };
    }

    return { data, error: null, successMessage: 'API data fetched and saved to DB successfully.' };

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
        // The _id field from MongoDB is not serializable for React Server Components by default.
        // We convert it to a string.
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
