export default async function handler(req, res) {
    const { ticker } = req.query;

    if (!ticker) {
        return res.status(400).json({ error: 'Ticker is required' });
    }

    try {
        // Yahoo's tracking headers are now so large they crash Node.js's native HTTP parser via HPE_HEADER_OVERFLOW.
        // So scraping cookies/crumbs to access the v10 fundamental data is impossible on Vercel without a headless browser.
        // We fall back to the v8 Chart endpoint, which is unauthenticated and still provides live price and basic meta.

        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        };

        const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;

        const priceRes = await fetch(yahooUrl, { headers });

        if (!priceRes.ok) {
            throw new Error(`Yahoo v8 returned ${priceRes.status}`);
        }

        const priceData = await priceRes.json();
        const baseResult = priceData?.chart?.result?.[0]?.meta;

        if (!baseResult) {
            throw new Error('Could not parse Yahoo v8 response');
        }

        // Map it to exactly what the frontend expects
        // Key Stats will be null, but the UI handles this gracefully and the Dashboard will show correct prices.
        const mappedData = {
            price: {
                regularMarketPrice: baseResult.regularMarketPrice || null,
                regularMarketChangePercent: null, // Requires logic processing on frontend or charting endpoint
                regularMarketVolume: baseResult.regularMarketVolume || null,
                currency: baseResult.currency || 'NOK',
                shortName: ticker,
                marketCap: null, // Disabled due to Yahoo v10 restrictions
            },
            defaultKeyStatistics: {},
            summaryDetail: {},
            financialData: {}
        };

        // Aggressively cache the response at the Vercel Edge
        res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
        res.status(200).json(mappedData);

    } catch (error) {
        console.error('Yahoo Setup API error:', error);
        res.status(500).json({ error: String(error) });
    }
}
