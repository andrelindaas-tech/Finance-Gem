const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const ARCTIC_PROMPT = `Du er en finansanalytiker-assistent. Sjekk om Arctic Securities har oppdatert sin "Top Picks"-liste nylig. 

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

export default async function handler(req, res) {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server' });
    }

    try {
        const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: ARCTIC_PROMPT }] }],
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 4096,
                    responseMimeType: 'application/json',
                },
            }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error('Gemini API error:', errorBody);
            return res.status(response.status).json({ error: `Gemini API returned ${response.status}` });
        }

        const data = await response.json();
        const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!textContent) {
            return res.status(502).json({ error: 'Empty response from Gemini' });
        }

        // Clean potential markdown wrappers
        let cleaned = textContent.trim();
        if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
        if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
        if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
        cleaned = cleaned.trim();

        const parsed = JSON.parse(cleaned);

        // Cache for 1 hour — Arctic Picks update at most monthly
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
        res.status(200).json(parsed);

    } catch (error) {
        console.error('Gemini proxy error:', error);
        res.status(500).json({ error: String(error) });
    }
}
