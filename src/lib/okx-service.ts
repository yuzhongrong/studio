
/**
 * @fileOverview Service for fetching OKX candle data and calculating RSI.
 */

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Calculates the Relative Strength Index (RSI) for a given period.
 * @param closePrices An array of closing prices.
 * @param period The period to calculate RSI for (e.g., 14).
 * @returns The calculated RSI value, or null if there's not enough data.
 */
export function calculateRSI(closePrices: number[], period: number = 14): number | null {
  if (closePrices.length < period + 1) {
    return null; // Not enough data
  }

  // Use a non-destructive reverse by creating a copy with the spread operator first.
  const prices = [...closePrices].reverse();

  let gains = 0;
  let losses = 0;

  // Calculate changes from oldest to newest
  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i-1];
    if (change > 0) {
      gains += change;
    } else {
      losses -= change; // losses are positive
    }
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < prices.length; i++) {
      const change = prices[i] - prices[i-1];
      if (change > 0) {
          avgGain = (avgGain * (period - 1) + change) / period;
          avgLoss = (avgLoss * (period - 1)) / period;
      } else {
          avgLoss = (avgLoss * (period - 1) - change) / period;
          avgGain = (avgGain * (period - 1)) / period;
      }
  }
  
  if (avgLoss === 0) {
    return 100; // All gains, RSI is 100
  }

  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));

  return rsi;
}


/**
 * Fetches candle data from OKX API for a specific token and time frame.
 * @param tokenContractAddress The contract address of the token.
 * @param bar The time frame for the candles (e.g., '5m', '1H').
 * @param limit The number of candles to retrieve.
 * @returns A promise that resolves to an object containing parsed and raw data.
 */
export async function fetchOkxCandles(tokenAddress: string, bar: '5m' | '1H', limit: number): Promise<{ parsedData: Candle[], rawData: any }> {
    const OKX_API_KEY = process.env.OK_ACCESS_KEY;
    const OKX_PASSPHRASE = process.env.OK_ACCESS_PASSPHRASE;

    if (!OKX_API_KEY || !OKX_PASSPHRASE) {
      throw new Error('Missing OKX API credentials in environment variables.');
    }

    const url = `https://web3.okx.com/api/v5/dex/market/candles?chainIndex=501&tokenContractAddress=${tokenAddress}&bar=${bar}&limit=${limit}`;

    const headers = {
        'OK-ACCESS-KEY': OKX_API_KEY,
        'OK-ACCESS-PASSPHRASE': OKX_PASSPHRASE,
        'Content-Type': 'application/json',
    };

    const response = await fetch(url, { headers, cache: 'no-store' });
    
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`OKX API request for ${bar} failed with status ${response.status}: ${errorBody}`);
    }

    const jsonResponse = await response.json();

    if (jsonResponse.code !== '0') {
        throw new Error(`OKX API for ${bar} returned an error: ${jsonResponse.msg} (code: ${jsonResponse.code})`);
    }

    if (!jsonResponse.data || !Array.isArray(jsonResponse.data)) {
        return { parsedData: [], rawData: [] };
    }
    
    const parsedData = jsonResponse.data.map((d: string[]) => ({
        timestamp: parseInt(d[0], 10),
        open: parseFloat(d[1]),
        high: parseFloat(d[2]),
        low: parseFloat(d[3]),
        close: parseFloat(d[4]),
        volume: parseFloat(d[5]),
    }));
    
    return { parsedData, rawData: jsonResponse.data };
}
