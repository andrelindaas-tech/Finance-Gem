const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const YAHOO_QUOTE_URL = 'https://query1.finance.yahoo.com/v7/finance/quote';

// 40 major Oslo Børs (OSEBX) tickers — mix of large, mid, and some smaller cap
const OSEBX_TICKERS = [
    // Energy & Oil
    'EQNR.OL', 'AKRBP.OL', 'VAR.OL', 'AKER.OL', 'BAKKA.OL',
    // Shipping & Offshore
    'FRO.OL', 'HAFNI.OL', 'SUBC.OL', 'DOFG.OL', 'FLNG.OL',
    // Seafood
    'MOWI.OL', 'SALM.OL', 'LSG.OL', 'AUSS.OL',
    // Finance & Insurance
    'DNB.OL', 'MORG.OL', 'SRBNK.OL', 'GJFS.OL',
    // Telecom & Tech
    'TEL.OL', 'NOD.OL', 'OPER.OL', 'CRAYN.OL',
    // Consumer & Industry
    'ORK.OL', 'SCATC.OL', 'NHY.OL', 'YAR.OL', 'TOM.OL',
    // Real Estate & Misc
    'ENTRA.OL', 'OLT.OL', 'KOG.OL',
    // Mid-cap with upside potential
    'PROT.OL', 'NAS.OL', 'KAHOT.OL', 'AUTO.OL', 'BELCO.OL',
    'BWO.OL', 'BGBIO.OL', 'NONG.OL', 'RECSI.OL', 'PARB.OL',
];

/**
 * Fetch real-time fundamentals for all OSEBX tickers in one batch call.
 * Returns a compact string for Gemini + the raw data for filtering.
 */
async function fetchOsebxData() {
    const symbols = OSEBX_TICKERS.join(',');
    const url = `${YAHOO_QUOTE_URL}?symbols=${symbols}`;

    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
    });

    if (!response.ok) {
        throw new Error(`Yahoo Finance returned ${response.status}`);
    }

    const data = await response.json();
    const quotes = data.quoteResponse?.result || [];

    // Pre-filter: only include stocks with actual financial data
    const filtered = quotes.filter(q =>
        q.regularMarketPrice > 0 &&
        q.symbol &&
        (q.trailingPE || q.priceToBook || q.dividendYield)
    );

    // Build compact data lines for Gemini
    const lines = filtered.map(q => {
        const pe = q.trailingPE ? q.trailingPE.toFixed(1) : '-';
        const fwdPe = q.forwardPE ? q.forwardPE.toFixed(1) : '-';
        const pb = q.priceToBook ? q.priceToBook.toFixed(2) : '-';
        const divYield = q.trailingAnnualDividendYield
            ? (q.trailingAnnualDividendYield * 100).toFixed(1) + '%'
            : '-';
        const mcap = q.marketCap
            ? (q.marketCap >= 1e9 ? (q.marketCap / 1e9).toFixed(1) + 'B' : (q.marketCap / 1e6).toFixed(0) + 'M')
            : '-';
        const low52 = q.fiftyTwoWeekLow?.toFixed(1) || '?';
        const high52 = q.fiftyTwoWeekHigh?.toFixed(1) || '?';
        const price = q.regularMarketPrice?.toFixed(1) || '?';
        const chgPct = q.regularMarketChangePercent?.toFixed(1) || '0';
        const name = q.shortName || q.longName || q.symbol;

        return `${q.symbol}|${name}|Pris:${price}|Chg:${chgPct}%|PE:${pe}|FwdPE:${fwdPe}|PB:${pb}|Div:${divYield}|MCap:${mcap}|52w:${low52}-${high52}`;
    });

    return { lines, count: filtered.length };
}

function buildPrompt(dataLines) {
    const today = new Date().toISOString().split('T')[0];
    return `Du er en erfaren verdiinvestor og nordisk aksjeanalytiker. Du får nå FAKTISKE sanntids-data fra Oslo Børs.

OPPGAVE: Analyser disse ${dataLines.length} aksjene og identifiser de mest UNDERVURDERTE basert på verdsettelsesmetrikkene.

DATA (format: Ticker|Navn|Pris|Endring|PE|FwdPE|PB|Utbytte|MarkedsCap|52ukers-range):
${dataLines.join('\n')}

ANALYSEREGLER:
- Velg 8-12 aksjer som er mest interessante for en verdiinvestor
- Forklar HVORFOR basert på de faktiske tallene (f.eks. "PE på 7.0 er langt under sektorsnitt")
- Sammenlign med sektorgjennomsnitt der relevant
- Vurder utbytteavkastning, P/E, P/B, og 52-ukers posisjon
- Aksjer nær 52-ukers bunn med sterke fundamentaler er spesielt interessante
- Merk 2-3 som "bullish" (sterkest kjøp), resten som "neutral" (hold/moderat), og 1-2 som "bearish" (oververdsatte)

SVAR I NØYAKTIG DETTE JSON-FORMATET:
{
  "picks": [
    {
      "ticker": "TICKER.OL",
      "name": "Selskapsnavn",
      "isNew": false,
      "change": "Uendret",
      "reasoning": "2-3 setninger på norsk med referanse til faktiske tall fra dataen",
      "sentiment": "bullish"
    }
  ],
  "summary": "3-4 setninger markedsoversikt og hovedfunn fra analysen på norsk. Nevn nøkkeltrender og de sterkeste signalene.",
  "date": "${today}",
  "source": "AI Verdianalyse"
}

VIKTIG:
- Sorter picks med de mest undervurderte først
- Skriv alt på norsk
- Reasoning MÅ referere til faktiske tall fra dataen ovenfor  
- Returner KUN gyldig JSON`;
}

export default async function handler(req, res) {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server' });
    }

    try {
        // Step 1: Fetch real Yahoo data for all OSEBX tickers
        const { lines, count } = await fetchOsebxData();

        if (lines.length === 0) {
            return res.status(502).json({ error: 'Could not fetch any stock data from Yahoo' });
        }

        // Step 2: Build data-driven prompt
        const prompt = buildPrompt(lines);

        // Step 3: Call Gemini with thinking budget cap for speed
        const geminiResponse = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.4,
                    maxOutputTokens: 4096,
                    responseMimeType: 'application/json',
                    thinkingConfig: {
                        thinkingBudget: 1024,
                    },
                },
            }),
        });

        if (!geminiResponse.ok) {
            const errorBody = await geminiResponse.text();
            console.error('Gemini API error:', errorBody);
            return res.status(geminiResponse.status).json({ error: `Gemini API returned ${geminiResponse.status}` });
        }

        const data = await geminiResponse.json();
        const textContent = data.candidates?.[0]?.content?.parts?.find(p => p.text)?.text;

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

        // Add metadata about the data source
        parsed.meta = {
            tickersAnalyzed: count,
            dataSource: 'Yahoo Finance (live)',
            model: 'gemini-2.5-flash',
        };

        // Cache for 1 hour at edge
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
        res.status(200).json(parsed);

    } catch (error) {
        console.error('Gemini proxy error:', error);
        res.status(500).json({ error: String(error) });
    }
}
