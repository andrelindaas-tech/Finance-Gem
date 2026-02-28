export default async function handler(req, res) {
    const { ticker } = req.query;

    if (!ticker) {
        return res.status(400).json({ error: 'Ticker is required' });
    }

    // FMP uses no suffix for Oslo / European stocks sometimes, or a different suffix. 
    // For Oslo Børs (.OL in Yahoo), FMP often uses .OL as well, but sometimes it doesn't. 
    // Let's assume .OL works for now, but we prepare to strip it if needed.
    const fmpTicker = ticker.toUpperCase();
    const API_KEY = process.env.VITE_FMP_API_KEY;

    if (!API_KEY) {
        return res.status(500).json({ error: 'FMP API key not configured' });
    }

    try {
        // Fetch Quote (Price, Market Cap, EPS, PE)
        const quoteRes = await fetch(`https://financialmodelingprep.com/api/v3/quote/${fmpTicker}?apikey=${API_KEY}`);
        const quoteData = await quoteRes.json();

        // Fetch Key Metrics (PB, PS, PEG, Dividend Yield)
        const metricsRes = await fetch(`https://financialmodelingprep.com/api/v3/key-metrics-ttm/${fmpTicker}?apikey=${API_KEY}`);
        const metricsData = await metricsRes.json();

        // Fetch Income Statement (Revenue, EBITDA)
        const incomeRes = await fetch(`https://financialmodelingprep.com/api/v3/income-statement/${fmpTicker}?limit=1&apikey=${API_KEY}`);
        const incomeData = await incomeRes.json();

        if (!quoteData || quoteData.length === 0) {
            return res.status(404).json({ error: 'Ticker not found' });
        }

        const q = quoteData[0];
        const m = metricsData && metricsData.length > 0 ? metricsData[0] : {};
        const i = incomeData && incomeData.length > 0 ? incomeData[0] : {};

        // Map FMP data to the same schema the frontend expects from Yahoo
        const mappedData = {
            // Valuation
            marketCap: q.marketCap || null,
            pe: q.pe || null,
            forwardPe: null, // FMP requires a different endpoint for forward PE, keeping simple
            pb: m.pbRatioTTM || null,
            ps: m.priceToSalesRatioTTM || null,
            peg: m.peRatioTTM / (m.earningsYieldTTM * 100) || null, // Approximation if PEG not directly avail

            // Per Share
            eps: q.eps || null,
            bookValue: m.bookValuePerShareTTM || null,

            // Dividends
            // FMP returns dividendYieldTTM as a decimal (e.g. 0.045 for 4.5%)
            dividendYield: m.dividendYieldPercentageTTM ? (m.dividendYieldPercentageTTM / 100) : m.dividendYieldTTM || null,
            dividendPerShare: m.dividendPerShareTTM || null,

            // Revenue / Profitability
            revenue: i.revenue || null,
            ebitda: i.ebitda || null,
            profitMargin: m.netIncomePerEBT ? (m.netIncomePerEBT) : null, // Not a perfect match, but a proxy

            // 52-week
            fiftyTwoWeekHigh: q.yearHigh || null,
            fiftyTwoWeekLow: q.yearLow || null,

            // Other
            beta: m.beta || null, // Might not be available in TTM metrics
            shortName: q.name || ticker,
            currency: q.currency || 'NOK',
        };

        // Add Vercel Edge Caching to protect the FMP API from getting spammed
        res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
        res.status(200).json(mappedData);

    } catch (error) {
        console.error('FMP Vercel API error:', error);
        res.status(500).json({ error: String(error) });
    }
}
