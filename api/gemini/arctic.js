const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const ARCTIC_PROMPT = `Du er en erfaren nordisk aksjeanalytiker som spesialiserer seg på Oslo Børs og skandinaviske markeder.

Oppgave: Lag en oppdatert "Top Picks"-liste med 8-12 norske aksjer du anbefaler basert på fundamental analyse, makroøkonomiske trender, og sektortilhørighet.

Gi meg en strukturert JSON-respons med følgende format (og BARE JSON, ingen annen tekst):
{
  "picks": [
    {
      "ticker": "TICKER.OL",
      "name": "Selskapsnavn",
      "isNew": false,
      "change": "Uendret",
      "reasoning": "Kort begrunnelse på norsk (1-2 setninger)",
      "sentiment": "bullish" | "bearish" | "neutral"
    }
  ],
  "summary": "Kort markedsoppsummering og hovedtema for anbefalingene (2-3 setninger på norsk)",
  "date": "${new Date().toISOString().split('T')[0]}",
  "source": "AI Markedsanalyse"
}

Viktige regler:
- Fokuser på velkjente norske aksjer fra Oslo Børs (bruk .OL suffix)
- Inkluder en blanding av sektorer: energi, shipping, sjømat, teknologi, finans, industri
- Gi minst 2-3 aksjer med "bullish" sentiment (Kjøp), 1-2 "bearish" (Selg), og resten "neutral" (Hold)
- Merk 1-2 aksjer som nye tillegg med "isNew": true og "change": "Ny"
- Merk 1 aksje som fjernet med "change": "Ut" og "sentiment": "bearish"
- Begrunnelsene skal være korte, profesjonelle og referere til relevante faktorer (verdivurdering, markedstrend, utbytte, etc.)
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
