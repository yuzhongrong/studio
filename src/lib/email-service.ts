/**
 * @fileOverview Service for sending email notifications based on buy signals using Resend.
 */
import { getDb } from '@/lib/mongodb';
import { Resend } from 'resend';

export interface AlertData {
    symbol: string;
    action: string;
    rsi1h: string;
    rsi5m: string;
    marketCap: string;
    tokenContractAddress: string;
}

let resend: Resend | null = null;
if (process.env.RESEND_API_KEY && !process.env.RESEND_API_KEY.includes('YOUR_API_KEY')) {
    resend = new Resend(process.env.RESEND_API_KEY);
} else {
    console.warn('Resend API Key is not configured. Email features will be disabled.');
}

/**
 * Fetches active user emails and sends them a buy signal notification using Resend.
 * @param tokenInfo The information about the token that triggered the alert.
 */
export async function sendBuySignalEmails(tokenInfo: AlertData): Promise<void> {
    if (!resend) {
        console.error('Email Service Error: Resend is not configured. Skipping email sending.');
        return;
    }
    
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
        const activeSubscribers = await mailsCollection.find({ status: 'active' }).toArray();

        if (activeSubscribers.length === 0) {
            console.log('No active email subscribers found. Skipping email notifications.');
            return;
        }

        const emailSubject = `🚨 Buy Signal Alert: ${tokenInfo.symbol}`;
        const emailHtmlBody = `
            <h1>Buy Signal Detected: ${tokenInfo.symbol}</h1>
            <p>A "Buy" signal has been detected for the token: <strong>${tokenInfo.symbol}</strong>.</p>
            <h3>Details:</h3>
            <ul>
                <li><strong>Token:</strong> ${tokenInfo.symbol}</li>
                <li><strong>RSI (1H):</strong> ${tokenInfo.rsi1h}</li>
                <li><strong>RSI (5m):</strong> ${tokenInfo.rsi5m}</li>
                <li><strong>Market Cap:</strong> ${tokenInfo.marketCap}</li>
                <li><strong>Contract Address:</strong> <code>${tokenInfo.tokenContractAddress}</code></li>
            </ul>
            <p><a href="https://gmgn.ai/sol/token/${tokenInfo.tokenContractAddress}">View on GMGN.ai</a></p>
            <br>
            <p><em>Disclaimer: This is not financial advice. Do your own research.</em></p>
        `;

        // The 'from' address must be a verified domain in your Resend account.
        const fromAddress = process.env.EMAIL_FROM_ADDRESS || 'alert@yourdomain.com';
        if (fromAddress.includes('yourdomain.com')) {
             console.error('Please configure a valid EMAIL_FROM_ADDRESS in your .env file.');
             return;
        }


        // Batch send emails
        const emailBatch = activeSubscribers.map(subscriber => ({
            from: fromAddress,
            to: subscriber.email,
            subject: emailSubject,
            html: emailHtmlBody,
        }));
        
        const { data, error } = await resend.batch.send(emailBatch);

        if (error) {
            console.error('Resend batch sending failed:', error);
            return;
        }

        console.log(`Successfully sent ${data?.created.length} emails.`, data);

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