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

/**
 * Fetches active user emails and sends them a buy signal notification using Resend.
 * @param tokenInfo The information about the token that triggered the alert.
 */
export async function sendBuySignalEmails(tokenInfo: AlertData): Promise<void> {
    if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY.includes('YOUR_API_KEY')) {
        console.warn('Resend API Key is not configured. Email features will be disabled.');
        return;
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    
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

        const emailSubject = `🔔 RSI Alert: Buy Signal for ${tokenInfo.symbol}`;
        const emailHtmlBody = `
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px; max-width: 600px; margin: auto;">
                <h2 style="text-align: center;">🔔 *RSI Alert* 🔔</h2>
                <p>Token: *${tokenInfo.symbol}*</p>
                <p>Action: *${tokenInfo.action}*</p>
                <p>RSI (1H): \`${tokenInfo.rsi1h}\`</p>
                <p>RSI (5m): \`${tokenInfo.rsi5m}\`</p>
                <p>MC: \`${tokenInfo.marketCap}\`</p>
                <p>CA: \`${tokenInfo.tokenContractAddress}\`</p>
                <p style="margin-top: 20px;">
                    <a href="https://gmgn.ai/sol/token/${tokenInfo.tokenContractAddress}" style="display: inline-block; padding: 10px 15px; background-color: #007bff; color: #ffffff; text-decoration: none; border-radius: 5px;">View on GMGN</a>
                </p>
                <br>
                <p style="font-size: 12px; color: #888;"><em>Disclaimer: This is not financial advice. Do your own research.</em></p>
            </div>
        `;

        const fromAddress = 'Pumpwatch Signals <signals@pumpwatch.virtualchats.xyz>';

        const emailBatch = activeSubscribers.map(subscriber => ({
            from: fromAddress,
            to: subscriber.email,
            subject: emailSubject,
            html: emailHtmlBody,
        }));
        
        const { data, error } = await resend.emails.send(emailBatch);

        if (error) {
            console.error('Resend batch sending failed:', error);
            return;
        }

        console.log(`Successfully queued ${data?.length || 0} emails for sending.`, data);

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
    const domain = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';
    const url = `${domain}/api/send-emails`;

    try {
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
