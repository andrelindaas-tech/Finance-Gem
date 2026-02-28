// These are kept for type reference but the actual prompt + key live server-side in api/gemini/arctic.js
export const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY; // unused in production
export const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

export interface TopPick {
    ticker: string;
    name: string;
    isNew: boolean;
    change?: string; //  e.g. "Ny", "Opp", "Ned", "Ut", "Uendret"
    reasoning: string;
    sentiment: 'bullish' | 'bearish' | 'neutral';
}

export interface ArcticInsightResponse {
    picks: TopPick[];
    summary: string;
    date: string;
    source: string;
}

export const ARCTIC_PROMPT = ''; // Prompt lives server-side now

/**
 * Fetch Arctic Securities Top Picks via our Vercel serverless proxy.
 * The proxy calls Gemini server-side so the API key isn't exposed.
 */
export async function fetchArcticTopPicks(): Promise<ArcticInsightResponse> {
    const response = await fetch('/api/gemini/arctic');

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorBody.error || `API feil: ${response.status}`);
    }

    return response.json();
}
