
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
 * @param tokenContractAddresses An array of token contract addresses.
 * @returns A promise that resolves to an array of market data objects.
 */
export async function fetchOkxMarketData(tokenContractAddresses: string[]): Promise<MarketData[]> {
    const OKX_API_KEY = process.env.OK_ACCESS_KEY;
    const OKX_SECRET_KEY = process.env.OK_SECRET_KEY;
    const OKX_PASSPHRASE = process.env.OK_ACCESS_PASSPHRASE;

    if (!OKX_API_KEY || !OKX_SECRET_KEY || !OKX_PASSPHRASE) {
        throw new Error('Missing OKX API credentials in environment variables.');
    }

    const requestPath = '/api/v5/dex/market/price-info';
    const method = 'POST';
    const body = JSON.stringify({
        chainIndex: "501",
        tokenContractAddressList: tokenContractAddresses
    });
    
    const timestamp = getTimestamp();
    const signature = sign(preHash(timestamp, method, requestPath, body), OKX_SECRET_KEY);

    const url = `https://web3.okx.com${requestPath}`;

    const headers = {
        'OK-ACCESS-KEY': OKX_API_KEY,
        'OK-ACCESS-SIGN': signature,
        'OK-ACCESS-TIMESTAMP': timestamp,
        'OK-ACCESS-PASSPHRASE': OKX_PASSPHRASE,
        'Content-Type': 'application/json',
    };

    const response = await fetch(url, { method, headers, body, cache: 'no-store' });
    
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`OKX Market API request failed with status ${response.status}: ${errorBody}`);
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
