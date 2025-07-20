/**
 * @fileOverview Service for sending email notifications based on buy signals.
 */
import { getDb } from '@/lib/mongodb';

export interface AlertData {
    symbol: string;
    action: string;
    rsi1h: string;
    rsi5m: string;
    marketCap: string;
    tokenContractAddress: string;
}

/**
 * Fetches active user emails and sends them a buy signal notification.
 * This is a placeholder and should be integrated with a real email service provider.
 * @param tokenInfo The information about the token that triggered the alert.
 */
export async function sendBuySignalEmails(tokenInfo: AlertData): Promise<void> {
    console.log(`Starting to send email alerts for ${tokenInfo.symbol}...`);
    
    if (!process.env.MONGO_URI || process.env.MONGO_URI.includes("YOUR_CONNECTION_STRING")) {
        console.error('Email Service Error: MongoDB URI is not configured.');
        return;
    }

    try {
        const db = await getDb();
        if (!db) {
            console.error('Email Service Error: Database connection failed.');
            return;
        }

        const mailsCollection = db.collection('mails');
        // Find all documents where the status is 'active'
        const activeSubscribers = await mailsCollection.find({ status: 'active' }).toArray();

        if (activeSubscribers.length === 0) {
            console.log('No active email subscribers found. Skipping email notifications.');
            return;
        }

        const emailSubject = `🚨 Buy Signal Alert: ${tokenInfo.symbol}`;
        const emailBody = `
            A "Buy" signal has been detected for the token: ${tokenInfo.symbol}.

            Details:
            - Token: ${tokenInfo.symbol}
            - RSI (1H): ${tokenInfo.rsi1h}
            - RSI (5m): ${tokenInfo.rsi5m}
            - Market Cap: ${tokenInfo.marketCap}
            - Contract Address: ${tokenInfo.tokenContractAddress}

            View on GMGN: https://gmgn.ai/sol/token/${tokenInfo.tokenContractAddress}

            Disclaimer: This is not financial advice.
        `;

        // This loop simulates sending emails.
        // Replace this with your actual email sending logic (e.g., using SendGrid, Resend, Nodemailer).
        for (const subscriber of activeSubscribers) {
            console.log(`--> Sending email to: ${subscriber.email}`);
            console.log(`    Subject: ${emailSubject}`);
            // In a real application, an await call to an email API would be here.
            // e.g., await sendEmail(subscriber.email, emailSubject, emailBody);
        }

        console.log(`Successfully processed email notifications for ${activeSubscribers.length} subscribers.`);

    } catch (error: any) {
        console.error('An error occurred in sendBuySignalEmails:', error);
    }
}


/**
 * Triggers the email alert API endpoint.
 * This function is called from a server action to trigger the background email sending process.
 * @param alertData The data for the alert.
 */
export async function triggerEmailAlerts(alertData: AlertData) {
    // This needs to be the absolute URL when deployed.
    // In development, localhost is fine. For production, use the actual domain.
    const domain = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';
    const url = `${domain}/api/send-emails`;

    try {
        // We use fetch to call our own API endpoint.
        // We don't need to wait for the response ('fire and forget').
        fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(alertData),
        });
        console.log(`Signal sent to /api/send-emails for token ${alertData.symbol}`);
    } catch (error) {
        console.error('Failed to trigger email alert service:', error);
    }
}
