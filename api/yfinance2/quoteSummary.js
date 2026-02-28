import yahooFinance from 'yahoo-finance2';

export default async function handler(req, res) {
    const { ticker } = req.query;

    if (!ticker) {
        return res.status(400).json({ error: 'Ticker is required' });
    }

    try {
        // Fetch fundamental data securely via the Node.js library wrapper v2
        const data = await yahooFinance.quoteSummary(ticker, {
            modules: ['defaultKeyStatistics', 'financialData', 'summaryDetail', 'price']
        });

        // Add Vercel Edge Caching to protect the Yahoo API from 429 bans
        res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
        res.status(200).json(data);
    } catch (error) {
        console.error('yahooFinance Vercel API error:', error);
        res.status(500).json({ error: String(error) });
    }
}
