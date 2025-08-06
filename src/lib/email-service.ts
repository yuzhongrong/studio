/**
 * @fileOverview Service for sending email notifications based on buy signals using Resend.
 */
import type { Resend as ResendType } from 'resend';
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
 * Fetches active user emails and sends them a buy signal notification using Resend.
 * @param tokenInfo The information about the token that triggered the alert.
 */
export async function sendBuySignalEmails(tokenInfo: AlertData): Promise<void> {
    console.log(`[Email Service] Received request to send email for ${tokenInfo.symbol}`);
    
    if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY.includes('YOUR_API_KEY')) {
        console.warn('[Email Service] Error: Resend API Key is not configured or is a placeholder. Email features will be disabled.');
        return;
    }
    
    if (!process.env.MONGO_URI || process.env.MONGO_URI.includes("YOUR_CONNECTION_STRING")) {
        console.error('[Email Service] Error: MongoDB URI is not configured.');
        return;
    }

    try {
        const { Resend } = await import('resend');
        const resend: ResendType = new Resend(process.env.RESEND_API_KEY);

        const db = await getDb();
        if (!db) {
            console.error('[Email Service] Error: Database connection failed.');
            return;
        }

        const mailsCollection = db.collection('mails');
        const activeSubscribers = await mailsCollection.find({ status: 'active' }).toArray();
        

        if (activeSubscribers.length === 0) {
            console.log('[Email Service] No active subscribers found in the database. Skipping email send.');
            return;
        }
        
        console.log(`[Email Service] Found ${activeSubscribers.length} active subscribers. Preparing email batch.`);

        const emailSubject = `🔔 RSI Alert: Buy Signal for ${tokenInfo.symbol}`;
        const emailHtmlBody = `
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px; max-width: 600px; margin: auto;">
                <h2 style="text-align: center;">🔔 <strong>RSI Alert</strong> 🔔</h2>
                <p>Token: <strong>${tokenInfo.symbol}</strong></p>
                <p>Action: <strong>${tokenInfo.action}</strong></p>
                <p>RSI (1H): <code>${tokenInfo.rsi1h}</code></p>
                <p>RSI (5m): <code>${tokenInfo.rsi5m}</code></p>
                <p>MC: <code>${tokenInfo.marketCap}</code></p>
                <p>CA: <code>${tokenInfo.tokenContractAddress}</code></p>
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
            to: subscriber.email as string,
            subject: emailSubject,
            html: emailHtmlBody,
        }));
        
        console.log(`[Email Service] Attempting to send a batch of ${emailBatch.length} emails...`);
        
        const { data, error } = await resend.batch.send(emailBatch);

        if (error) {
            console.error('[Email Service] Resend API returned an error:', JSON.stringify(error, null, 2));
            return;
        }

        if (data && data.data) {
             console.log(`[Email Service] Resend API call successful. ${data.data.length} emails queued for ${tokenInfo.symbol}.`);
        } else {
             console.warn('[Email Service] Resend API call was successful, but no data was returned in the response.');
        }

    } catch (error: any) {
        console.error('[Email Service] A critical error occurred in sendBuySignalEmails:', error);
    }
}
