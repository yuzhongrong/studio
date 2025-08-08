
/**
 * @fileOverview Service for fetching OKX market data (price, market cap).
 * This service handles API signing as required by OKX.
 */

import crypto from 'crypto-js';

export interface MarketData {
    chainIndex: string;
    marketCap: string;
    price: string;
    priceChange1H: string;
    priceChange24H: string;
    priceChange4H: string;
    priceChange5M: string;
    time: string;
    tokenContractAddress: string;
    volume1H: string;
    volume24H: string;
    volume4H: string;
    volume5M: string;
}

function getTimestamp() {
    return new Date().toISOString();
}

function preHash(timestamp: string, method: string, requestPath: string, body: string) {
    return timestamp + method + requestPath + body;
}

function sign(message: string, secret: string) {
    const hash = crypto.HmacSHA256(message, secret);
    return crypto.enc.Base64.stringify(hash);
}

/**
 * Fetches market data from OKX API for a specific list of tokens.
 * @param tokens An array of token contract address strings.
 * @returns A promise that resolves to an array of market data objects.
 */
export async function fetchOkxMarketData(tokens: string[]): Promise<MarketData[]> {
    const OKX_API_KEY = process.env.OK_ACCESS_KEY;
    const OKX_SECRET_KEY = process.env.OK_SECRET_KEY;
    const OKX_PASSPHRASE = process.env.OK_ACCESS_PASSPHRASE;

    if (!OKX_API_KEY || !OKX_SECRET_KEY || !OKX_PASSPHRASE) {
        throw new Error('Missing OKX API credentials in environment variables.');
    }
    
    const requestPath = '/api/v5/dex/market/price-info';
    const method = 'POST';
    const bodyPayload = {
        chainIndex: '501',
        tokenContractAddress: tokens.join(',')
    };
    const bodyString = JSON.stringify(bodyPayload);
    
    const timestamp = getTimestamp();
    const message = preHash(timestamp, method, requestPath, bodyString);
    const signature = sign(message, OKX_SECRET_KEY);

    const url = `https://web3.okx.com${requestPath}`;

    const headers = {
        'OK-ACCESS-KEY': OKX_API_KEY,
        'OK-ACCESS-SIGN': signature,
        'OK-ACCESS-TIMESTAMP': timestamp,
        'OK-ACCESS-PASSPHRASE': OKX_PASSPHRASE,
        'Content-Type': 'application/json',
    };
    
    console.log('[MarketCap Task] Preparing OKX API Request...');
    console.log(`[MarketCap Task] Request URL: ${url}`);
    console.log(`[MarketCap Task] Request Method: ${method}`);
    console.log('[MarketCap Task] Request Headers:', JSON.stringify(headers, null, 2));
    console.log('[MarketCap Task] Request Body:', bodyString);

    const response = await fetch(url, { method, headers, body: bodyString, cache: 'no-store' });
    
    const responseBody = await response.json();

    if (!response.ok) {
        console.error('[MarketCap Task] OKX API Error Response:', JSON.stringify(responseBody, null, 2));
        throw new Error(`OKX Market API request failed with status ${response.status}: ${responseBody.msg} (code: ${responseBody.code})`);
    }

    if (responseBody.code !== '0') {
        console.error(`OKX Market API returned an error: ${responseBody.msg} (code: ${responseBody.code})`);
        throw new Error(`OKX Market API returned an error: ${responseBody.msg} (code: ${responseBody.code})`);
    }

    if (!responseBody.data || !Array.isArray(responseBody.data)) {
        return [];
    }
    
    return responseBody.data as MarketData[];
}
