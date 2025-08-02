import { getDb } from '@/lib/mongodb';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (
    !process.env.MONGO_URI ||
    process.env.MONGO_URI.includes('YOUR_CONNECTION_STRING')
  ) {
    console.error('API Error: MongoDB URI is not configured.');
    return NextResponse.json(
      { error: 'MongoDB is not configured.' },
      { status: 500 }
    );
  }

  try {
    const db = await getDb();
    if (!db) {
      console.error('API Error: Database connection failed. getDb() returned null.');
      return NextResponse.json(
        { error: 'Database connection failed.' },
        { status: 500 }
      );
    }

    const collection = db.collection('rsi_data');
    const data = await collection.find({}).toArray();

    // Ensure _id is serialized to a string for JSON transport
    const serializableData = data.map((item) => ({
      ...item,
      _id: item._id.toString(),
    }));

    // Return data with cache-control headers to prevent caching
    return NextResponse.json(serializableData, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error: any) {
    console.error('API Error fetching RSI data:', error);
    return NextResponse.json(
      { error: `An internal server error occurred: ${error.message}` },
      { status: 500 }
    );
  }
}
