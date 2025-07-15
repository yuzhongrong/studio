'use server';

import { suggestFilters, SuggestFiltersInput } from '@/ai/flows/suggest-filters';

export async function fetchApiData(url: string) {
  try {
    if (!url || !url.startsWith('http')) {
      return { data: null, error: 'Please enter a valid URL.' };
    }
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      return { data: null, error: `API Error: ${response.status} ${response.statusText}` };
    }
    const data = await response.json();
    return { data, error: null };
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch failed')) {
        return { data: null, error: 'Network error or invalid URL. Please check the API endpoint and your connection.' };
    }
    if (error instanceof SyntaxError) {
        return { data: null, error: 'Failed to parse JSON response. The API might not be returning valid JSON.' };
    }
    console.error('Fetch API Data Error:', error);
    return { data: null, error: 'An unknown error occurred while fetching data.' };
  }
}

export async function getFilterSuggestions(input: SuggestFiltersInput) {
    try {
        const result = await suggestFilters(input);
        return { suggestions: result.filterExpressions, error: null };
    } catch (error) {
        console.error('Get Filter Suggestions Error:', error);
        return { suggestions: null, error: 'Failed to get suggestions from AI. Please try again.' };
    }
}
