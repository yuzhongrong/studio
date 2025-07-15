/**
 * @fileOverview Service for fetching OKX candle data and calculating RSI.
 */

if (!process.env.OK_ACCESS_KEY || !process.env.OK_ACCESS_PASSPHRASE) {
  throw new Error('Missing OKX API credentials in environment variables.');
}

const OKX_API_KEY = process.env.OK_ACCESS_KEY;
const OKX_PASSPHRASE = process.env.OK_ACCESS_PASSPHRASE;

interface Candle {
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
function calculateRSI(closePrices: number[], period: number = 14): number | null {
  if (closePrices.length < period + 1) {
    return null; // Not enough data
  }

  let gains = 0;
  let losses = 0;
  const priceChanges = [];

  for (let i = 1; i < closePrices.length; i++) {
    priceChanges.push(closePrices[i] - closePrices[i-1]);
  }

  // Calculate initial average gains and losses
  for (let i = 0; i < period; i++) {
    const change = priceChanges[i];
    if (change > 0) {
      gains += change;
    } else {
      losses -= change; // losses are positive
    }
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  // Smooth the average gains and losses
  for (let i = period; i < priceChanges.length; i++) {
    const change = priceChanges[i];
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
 * Aggregates fine-grained candles into larger time-frame candles.
 * @param candles The input candles to aggregate.
 * @param aggregationFactor The number of input candles to form one output candle (e.g., 12 for 5m -> 1h).
 * @returns An array of aggregated candles.
 */
function aggregateCandles(candles: Candle[], aggregationFactor: number = 12): Candle[] {
  if (candles.length < aggregationFactor) {
    return [];
  }

  const aggregated: Candle[] = [];
  const numCandles = candles.length;
  
  // Start from a point that ensures the first aggregation block is complete
  const startIndex = numCandles % aggregationFactor;

  for (let i = startIndex; i < numCandles; i += aggregationFactor) {
    const chunk = candles.slice(i, i + aggregationFactor);
    if (chunk.length < aggregationFactor) {
      continue;
    }

    const firstCandle = chunk[0];
    const lastCandle = chunk[chunk.length - 1];

    const aggregatedCandle: Candle = {
      timestamp: firstCandle.timestamp,
      open: firstCandle.open,
      high: Math.max(...chunk.map(c => c.high)),
      low: Math.min(...chunk.map(c => c.low)),
      close: lastCandle.close,
      volume: chunk.reduce((sum, c) => sum + c.volume, 0),
    };
    aggregated.push(aggregatedCandle);
  }

  return aggregated;
}


async function fetchOkx5mCandles(tokenAddress: string): Promise<Candle[]> {
    const before = Date.now();
    const limit = 299; // Increased limit for better RSI accuracy
    const url = `https://web3.okx.com/api/v5/dex/market/candles?chainIndex=501&tokenContractAddress=${tokenAddress}&before=${before}&bar=5m&limit=${limit}`;

    const headers = {
        'OK-ACCESS-KEY': OKX_API_KEY,
        'OK-ACCESS-PASSPHRASE': OKX_PASSPHRASE,
        'Content-Type': 'application/json',
    };

    const response = await fetch(url, { headers, cache: 'no-store' });
    
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`OKX API request for 5m failed with status ${response.status}: ${errorBody}`);
    }

    const jsonResponse = await response.json();

    if (jsonResponse.code !== '0') {
        throw new Error(`OKX API for 5m returned an error: ${jsonResponse.msg} (code: ${jsonResponse.code})`);
    }

    if (!jsonResponse.data || !Array.isArray(jsonResponse.data)) {
        return [];
    }

    // The data is returned with the most recent candle first, we need to reverse it for RSI calculation
    const reversedData = [...jsonResponse.data].reverse();

    return reversedData.map((d: string[]) => ({
        timestamp: parseInt(d[0], 10),
        open: parseFloat(d[1]),
        high: parseFloat(d[2]),
        low: parseFloat(d[3]),
        close: parseFloat(d[4]),
        volume: parseFloat(d[5]),
    }));
}


export async function fetchOkxCandlesAndCalculateRsi(tokenAddress: string) {
    try {
        const candles5m = await fetchOkx5mCandles(tokenAddress);
        
        // Calculate 5m RSI
        const closePrices5m = candles5m.map(c => c.close);
        const rsi5m = calculateRSI(closePrices5m);

        // Aggregate 5m candles to 1h candles
        const candles1h = aggregateCandles(candles5m, 12);

        // Calculate 1h RSI from aggregated data
        const closePrices1h = candles1h.map(c => c.close);
        const rsi1h = calculateRSI(closePrices1h);

        return {
            tokenContractAddress: tokenAddress,
            'rsi-5m': rsi5m,
            'rsi-1h': rsi1h,
            'rsd_200_5m': candles5m
        };

    } catch (error: any) {
        console.error(`Error processing OKX data for ${tokenAddress}:`, error.message);
        // Return null or re-throw depending on desired behavior for failed tokens
        return null;
    }
}
