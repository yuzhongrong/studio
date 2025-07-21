/**
 * @fileOverview Service for sending email notifications based on buy signals using Resend.
 */
import { getDb } from '@/lib/mongodb';
import { Resend } from 'resend';

// Initialize Resend at the module level for clarity.
const resend = process.env.RESEND_API_KEY && !process.env.RESEND_API_KEY.includes('YOUR_API_KEY') 
    ? new Resend(process.env.RESEND_API_KEY)
    : null;

if (!resend) {
    console.warn('Resend API Key is not configured or is a placeholder. Email features will be disabled.');
}

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
    
    if (!resend) {
        console.error('[Email Service] Error: Resend is not configured. Cannot send emails.');
        return;
    }
    
    if (!process.env.MONGO_URI || process.env.MONGO_URI.includes("YOUR_CONNECTION_STRING")) {
        console.error('[Email Service] Error: MongoDB URI is not configured.');
        return;
    }

    try {
        const db = await getDb();
        if (!db) {
            console.error('[Email Service] Error: Database connection failed.');
            return;
        }

        const mailsCollection = db.collection('mails');
        const activeSubscribers = await mailsCollection.find({ status: 'active' }).toArray();
        console.log(`[Email Service] Found ${activeSubscribers.length} active subscribers in the database.`);

        if (activeSubscribers.length === 0) {
            console.log('[Email Service] No active subscribers to email. Exiting.');
            return;
        }

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
        
        console.log(`[Email Service] Prepared a batch of ${emailBatch.length} emails. Attempting to send...`);
        
        const { data, error } = await resend.batch.send(emailBatch);

        if (error) {
            console.error('[Email Service] Resend API returned an error:', JSON.stringify(error, null, 2));
            return;
        }

        console.log(`[Email Service] Resend API call successful. Response data:`, JSON.stringify(data, null, 2));
        console.log(`[Email Service] Successfully queued ${data?.created_at ? emailBatch.length : 0} emails for ${tokenInfo.symbol}.`);

    } catch (error: any) {
        console.error('[Email Service] A critical error occurred in sendBuySignalEmails:', error);
    }
}
