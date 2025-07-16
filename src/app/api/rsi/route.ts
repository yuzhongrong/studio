import { getDb } from '@/lib/mongodb';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (
    !process.env.MONGO_URI ||
    process.env.MONGO_URI.includes('YOUR_CONNECTION_STRING')
  ) {
    return NextResponse.json(
      { error: 'MongoDB is not configured.' },
      { status: 500 }
    );
  }

  try {
    const db = await getDb();
    if (!db) {
      return NextResponse.json(
        { error: 'Database connection failed.' },
        { status: 500 }
      );
    }

    const collection = db.collection('rsi_data');
    const data = await collection.find({}).toArray();

    const serializableData = data.map((item) => ({
      ...item,
      _id: item._id.toString(),
    }));

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
