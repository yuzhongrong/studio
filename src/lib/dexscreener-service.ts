/**
 * @fileOverview Service for fetching data from the Dex Screener API.
 */

export interface DexScreenerPairResponse {
    schemaVersion: string;
    pairs: DexScreenerPair[] | null;
    pair: DexScreenerPair | null;
}

export interface DexScreenerPair {
    chainId: string;
    dexId: string;
    url: string;
    pairAddress: string;
    baseToken: Token;
    quoteToken: Token;
    priceNative: string;
    priceUsd?: string;
    txns: Txns;
    volume: Volume;
    priceChange: PriceChange;
    liquidity?: Liquidity;
    fdv?: number;
    marketCap?: number;
    pairCreatedAt?: number;
    info?: Info;
}

interface Token {
    address: string;
    name: string;
    symbol: string;
}

interface Txns {
    m5: { buys: number; sells: number };
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
}

interface Volume {
    h24: number;
    h6: number;
    h1: number;
    m5: number;
}

interface PriceChange {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
}

interface Liquidity {
    usd?: number;
    base: number;
    quote: number;
}

interface Info {
    imageUrl?: string;
    websites?: { label: string; url: string }[];
    socials?: { type: string; url: string }[];
}


/**
 * Fetches data for a single trading pair from the Dex Screener API.
 * @param pairAddress The address of the trading pair.
 * @returns A promise that resolves to the API response.
 */
export async function fetchPairData(pairAddress: string): Promise<DexScreenerPairResponse> {
    const url = `https://api.dexscreener.com/latest/dex/pairs/solana/${pairAddress}`;

    try {
        console.log(`[DexScreener Service] Fetching data from: ${url}`);
        const response = await fetch(url, { cache: 'no-store' });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`DexScreener API request failed with status ${response.status}: ${errorBody}`);
        }

        const data: DexScreenerPairResponse = await response.json();
        
        // The API might return an empty pairs array if the pair is not found.
        if (!data.pair) {
             console.warn(`Pair not found on DexScreener for address: ${pairAddress}`);
             return { schemaVersion: "1.0.0", pairs: null, pair: null };
        }

        return data;
    } catch (error: any) {
        console.error(`[DexScreener Service] Error fetching data for pair ${pairAddress}:`, error);
        throw error; // Re-throw the error to be handled by the caller
    }
}
