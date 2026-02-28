export const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
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

export const ARCTIC_PROMPT = `Du er en finansanalytiker-assistent. Sjekk om Arctic Securities har oppdatert sin "Top Picks"-liste nylig. 

Gi meg en strukturert JSON-respons med følgende format (og BARE JSON, ingen annen tekst):
{
  "picks": [
    {
      "ticker": "TICKER.OL",
      "name": "Selskapsnavn",
      "isNew": true/false,
      "change": "Ny" | "Opp" | "Ned" | "Ut" | "Uendret",
      "reasoning": "Kort begrunnelse på norsk (1-2 setninger)",
      "sentiment": "bullish" | "bearish" | "neutral"
    }
  ],
  "summary": "Kort oppsummering av endringene denne uken/måneden på norsk (2-3 setninger)",
  "date": "YYYY-MM-DD (datoen for siste oppdatering, bruk dagens dato om usikkert)",
  "source": "Arctic Securities Top Picks"
}

Viktige regler:
- Inkluder ALLE aksjer i Arctic Securities sin nåværende Top Picks-liste (vanligvis ca 10 aksjer)
- Merk tydelig hvilke som er NYE denne måneden med "isNew": true og "change": "Ny"
- Merk aksjer som er FJERNET med "change": "Ut"
- For Oslo Børs-aksjer, bruk .OL suffix på tickeren
- Gi en kort, profesjonell begrunnelse for hver anbefaling
- Skriv alt på norsk
- Returner KUN gyldig JSON, ingen markdown, ingen kodeblokker, ingen forklaringer`;

export async function fetchArcticTopPicks(): Promise<ArcticInsightResponse> {
    if (!GEMINI_API_KEY) {
        throw new Error('Gemini API key is not configured');
    }

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents: [{
                parts: [{ text: ARCTIC_PROMPT }]
            }],
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 4096,
                responseMimeType: "application/json",
            }
        })
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error('Gemini API error:', errorBody);
        throw new Error(`Gemini API feil: ${response.status}`);
    }

    const data = await response.json();

    // Extract the text content from the Gemini response
    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textContent) {
        throw new Error('Tomt svar fra Gemini');
    }

    try {
        // Clean the response - Gemini sometimes wraps in code blocks
        let cleaned = textContent.trim();
        if (cleaned.startsWith('\`\`\`json')) {
            cleaned = cleaned.slice(7);
        }
        if (cleaned.startsWith('\`\`\`')) {
            cleaned = cleaned.slice(3);
        }
        if (cleaned.endsWith('\`\`\`')) {
            cleaned = cleaned.slice(0, -3);
        }
        cleaned = cleaned.trim();

        const parsed: ArcticInsightResponse = JSON.parse(cleaned);
        return parsed;
    } catch (e) {
        console.error('Failed to parse Gemini response:', textContent);
        throw new Error('Kunne ikke tolke svaret fra Gemini');
    }
}
