import { NextResponse } from 'next/server';
import { sendBuySignalEmails } from '@/lib/email-service';

export async function POST(request: Request) {
  try {
    const tokenInfo = await request.json();

    if (!tokenInfo || !tokenInfo.symbol) {
      return NextResponse.json(
        { error: 'Invalid token information provided.' },
        { status: 400 }
      );
    }

    // This is an async call, but we don't need to wait for it to finish.
    // The email sending process can run in the background.
    sendBuySignalEmails(tokenInfo);

    // Immediately respond to the client that the task has been accepted.
    return NextResponse.json(
      { message: 'Email alert process triggered successfully.' },
      { status: 202 } // 202 Accepted
    );
  } catch (error: any) {
    console.error('API Error in /api/send-emails:', error);
    return NextResponse.json(
      { error: `An internal server error occurred: ${error.message}` },
      { status: 500 }
    );
  }
}
