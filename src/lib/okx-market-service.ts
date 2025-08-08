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
    // OKX API requires timestamp in ISO8601 format without milliseconds.
    return new Date().toISOString().slice(0, -5) + 'Z';
}

function preHash(timestamp: string, method: string, requestPath: string, body: object | null) {
    let bodyStr = '';
    if (body) {
        bodyStr = JSON.stringify(body);
    }
    return timestamp + method + requestPath + bodyStr;
}

function sign(message: string, secret: string) {
    const hash = crypto.HmacSHA256(message, secret);
    return crypto.enc.Base64.stringify(hash);
}

/**
 * Fetches market data from OKX API for a specific list of tokens.
 * @param tokenContractAddresses An array of token contract addresses.
 * @returns A promise that resolves to an array of market data objects.
 */
export async function fetchOkxMarketData(tokenContractAddresses: string[]): Promise<MarketData[]> {
    const OKX_API_KEY = '9a31548a-6b3a-4f5c-89b5-78d1f7e0349b';
    const OKX_SECRET_KEY = 'ECD61FCC9D17DDA622FB4FA19D11C096';
    const OKX_PASSPHRASE = 'shuai1999';
    
    const requestPath = '/api/v5/dex/market/price-info';
    const method = 'POST';
    const bodyParams = {
        chainIndex: "501",
        tokenContractAddress: tokenContractAddresses
    };
    
    const timestamp = getTimestamp();
    const message = preHash(timestamp, method, requestPath, bodyParams);
    const signature = sign(message, OKX_SECRET_KEY);

    const url = `https://web3.okx.com${requestPath}`;

    const headers = {
        'OK-ACCESS-KEY': OKX_API_KEY,
        'OK-ACCESS-SIGN': signature,
        'OK-ACCESS-TIMESTAMP': timestamp,
        'OK-ACCESS-PASSPHRASE': OKX_PASSPHRASE,
        'Content-Type': 'application/json',
    };

    // --- DEBUG LOGGING ---
    console.log('[MarketCap Task] Preparing OKX API Request...');
    console.log(`[MarketCap Task] Request URL: ${url}`);
    console.log(`[MarketCap Task] Request Method: ${method}`);
    console.log('[MarketCap Task] Request Headers:', JSON.stringify(headers, null, 2));
    console.log('[MarketCap Task] Request Body:', JSON.stringify(bodyParams));
    // --- END DEBUG LOGGING ---

    const response = await fetch(url, { method, headers, body: JSON.stringify(bodyParams), cache: 'no-store' });
    
    if (!response.ok) {
        const errorBody = await response.json();
        console.error('[MarketCap Task] OKX API Error Response:', JSON.stringify(errorBody, null, 2));
        throw new Error(`OKX Market API request failed with status ${response.status}: ${errorBody.msg} (code: ${errorBody.code})`);
    }

    const jsonResponse = await response.json();

    if (jsonResponse.code !== '0') {
        throw new Error(`OKX Market API returned an error: ${jsonResponse.msg} (code: ${jsonResponse.code})`);
    }

    if (!jsonResponse.data || !Array.isArray(jsonResponse.data)) {
        return [];
    }
    
    return jsonResponse.data as MarketData[];
}
