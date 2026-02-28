export default async function handler(req, res) {
    // Extract everything after /api/yahoo/ to reconstruct the Yahoo Finance URL
    // e.g. /api/yahoo/v8/finance/chart/DOFG.OL?range=1mo → https://query1.finance.yahoo.com/v8/finance/chart/DOFG.OL?range=1mo
    const { path } = req.query;
    const yahooPath = Array.isArray(path) ? path.join('/') : path;

    // Reconstruct query params (excluding the catch-all 'path' param)
    const queryParams = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query)) {
        if (key !== 'path') {
            queryParams.append(key, value);
        }
    }

    const qs = queryParams.toString();
    const yahooUrl = `https://query1.finance.yahoo.com/${yahooPath}${qs ? '?' + qs : ''}`;

    try {
        const response = await fetch(yahooUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            }
        });

        if (!response.ok) {
            return res.status(response.status).json({ error: `Yahoo returned ${response.status}` });
        }

        const data = await response.json();

        // Cache at the Vercel Edge to reduce Yahoo API hits
        res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
        res.status(200).json(data);

    } catch (error) {
        console.error('Yahoo proxy error:', error);
        res.status(500).json({ error: String(error) });
    }
}
