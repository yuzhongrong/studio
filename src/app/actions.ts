'use server';

import { suggestFilters, SuggestFiltersInput } from '@/ai/flows/suggest-filters';
import { getDb } from '@/lib/mongodb';

async function saveToMongo(data: any) {
    if (!process.env.MONGO_URI) {
        console.warn('MONGO_URI not set, skipping database save.');
        return;
    }
    try {
        const db = await getDb();
        const collection = db.collection('pairs');

        // Fix: The data is in `data.pairs`, not `data.data`
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
                await collection.bulkWrite(operations);
                console.log(`${operations.length} documents saved to MongoDB.`);
            }
        }
    } catch (error) {
        console.error('Failed to save data to MongoDB:', error);
        // We don't want to throw an error to the client if only the DB save fails
    }
}


export async function fetchApiData(url: string) {
  try {
    if (!url || !url.startsWith('http')) {
      return { data: null, error: 'Please enter a valid URL.' };
    }
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      return { data: null, error: `API Error: ${response.status} ${response.statusText}` };
    }
    const data = await response.json();

    // Save to MongoDB without blocking the client response
    saveToMongo(data).catch(console.error);

    return { data, error: null };
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch failed')) {
        return { data: null, error: 'Network error or invalid URL. Please check the API endpoint and your connection.' };
    }
    if (error instanceof SyntaxError) {
        return { data: null, error: 'Failed to parse JSON response. The API might not be returning valid JSON.' };
    }
    console.error('Fetch API Data Error:', error);
    return { data: null, error: 'An unknown error occurred while fetching data.' };
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
    } catch (error) {
        console.error('Failed to fetch data from MongoDB:', error);
        return { data: null, error: 'Failed to retrieve data from the database.' };
    }
}
