// This is a server-side only module
import { fetchApiData, updateRsiData } from '@/app/actions';
import { updatePairDataFromDexScreener } from '@/app/actions/update-market-cap';


const DEXSCREENER_POLLING_INTERVAL_MS = 60000; // 1 minute
const RSI_POLLING_INTERVAL_MS = 30000; // 30 seconds
const PAIR_DATA_POLLING_INTERVAL_MS = 45000; // 45 seconds


const API_ENDPOINT = "https://dexscreen-scraper-delta.vercel.app/dex?generated_text=%26filters%5BmarketCap%5D%5Bmin%5D%3D2000000%26filters%5BchainIds%5D%5B0%5D%3Dsolana";

let isPolling = false;
let isStarted = false; 
let isRsiTaskRunning = false;
let isPairDataTaskRunning = false;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Task 1: Periodically fetches data from the dexscreener endpoint and saves it.
 */
async function pollDexscreenerData() {
  console.log('Starting Dexscreener data polling loop.');
  while (isPolling) {
    try {
      console.log('Polling for new dexscreener data...');
      const apiResult = await fetchApiData(API_ENDPOINT);
      
      if (apiResult.error) {
        console.error('Dexscreener polling error:', apiResult.error);
      } else {
        console.log('Dexscreener polling success:', apiResult.successMessage);
      }
    } catch (error) {
      console.error('An unexpected error occurred during the dexscreener polling loop:', error);
    }
    await sleep(DEXSCREENER_POLLING_INTERVAL_MS);
  }
}

/**
 * Task 2: Periodically fetches candle data from OKX and updates RSI values in the database.
 * This function uses a lock to prevent overlapping executions.
 */
async function pollRsiData() {
    console.log('Starting RSI data polling loop.');
    while(isPolling) {
        if (isRsiTaskRunning) {
            console.warn('RSI update is still running. Skipping this cycle.');
            await sleep(RSI_POLLING_INTERVAL_MS);
            continue;
        }

        try {
            isRsiTaskRunning = true;
            console.log('Triggering RSI data update from OKX...');
            const rsiResult = await updateRsiData();
            
            if (rsiResult.error) {
                console.error('RSI update process finished with an error:', rsiResult.error);
            } else {
                console.log('RSI update process finished successfully.', rsiResult.message);
            }
        } catch (error) {
            console.error('An unexpected error occurred during the RSI polling loop:', error);
        } finally {
            isRsiTaskRunning = false;
        }
        await sleep(RSI_POLLING_INTERVAL_MS);
    }
}

/**
 * Task 3: Periodically updates pair data from DexScreener.
 * This function uses a lock to prevent overlapping executions.
 */
async function pollPairData() {
    console.log('Starting Pair Data polling loop from DexScreener.');
    while(isPolling) {
        if (isPairDataTaskRunning) {
            console.warn('Pair Data update is still running. Skipping this cycle.');
            await sleep(PAIR_DATA_POLLING_INTERVAL_MS);
            continue;
        }

        try {
            isPairDataTaskRunning = true;
            console.log('Triggering Pair Data update from DexScreener...');
            const pairDataResult = await updatePairDataFromDexScreener();
            
            if (pairDataResult.error) {
                console.error('Pair Data update process finished with an error:', pairDataResult.error);
            } else {
                console.log('Pair Data update process finished successfully.', pairDataResult.message);
            }
        } catch (error) {
            console.error('An unexpected error occurred during the Pair Data polling loop:', error);
        } finally {
            isPairDataTaskRunning = false;
        }
        await sleep(PAIR_DATA_POLLING_INTERVAL_MS);
    }
}


export function startPolling() {
  if (isStarted) {
    return;
  }
  isStarted = true;
  isPolling = true;

  console.log('Background polling services started.');

  // Start all polling loops to run in parallel
  pollDexscreenerData();
  pollRsiData();
  pollPairData();
}

export function stopPolling() {
  if (isPolling) {
    isPolling = false;
    console.log('Background polling services stopped.');
  }
}
