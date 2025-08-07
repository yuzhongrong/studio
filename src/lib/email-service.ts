/**
 * @fileOverview Service for sending email notifications based on buy signals using Resend.
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
 * Fetches active user emails and sends them a buy signal notification using a direct Resend API call.
 * @param tokenInfo The information about the token that triggered the alert.
 */
export async function sendBuySignalEmails(tokenInfo: AlertData): Promise<void> {
    console.log(`[Email Service] Received request to send email for ${tokenInfo.symbol}`);
    
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey || resendApiKey.includes('YOUR_API_KEY')) {
        console.warn('[Email Service] Error: Resend API Key is not configured or is a placeholder. Email features will be disabled.');
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
        
        if (activeSubscribers.length === 0) {
            console.log('[Email Service] No active subscribers found in the database. Skipping email send.');
            return;
        }
        
        const recipientEmails = activeSubscribers.map(sub => sub.email as string);
        console.log(`[Email Service] Found ${recipientEmails.length} active subscribers. Preparing to send emails.`);

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

        console.log(`[Email Service] Sending email to ${recipientEmails.length} recipients...`);
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify({
                from: fromAddress,
                to: recipientEmails,
                subject: emailSubject,
                html: emailHtmlBody,
            }),
        });

        if (!response.ok) {
            const errorBody = await response.json();
            console.error('[Email Service] Resend API returned an error:', JSON.stringify(errorBody, null, 2));
            return;
        }

        const data = await response.json();
        if (data && data.id) {
             console.log(`[Email Service] Resend API call successful. Batch email sent with ID: ${data.id}.`);
        } else {
             console.warn('[Email Service] Resend API call was successful, but the response format was unexpected.', data);
        }

    } catch (error: any) {
        console.error('[Email Service] A critical error occurred in sendBuySignalEmails:', error);
    }
}
