// Vercel Serverless Function: Fetch Yahoo v10 QuoteSummary with proper crumb auth
// Uses undici with increased maxHeaderSize to bypass Node's header overflow crash

import { request } from 'undici';

// Cache crumb+cookie across invocations within the same serverless instance
let cachedSession = null;
let sessionExpiry = 0;

async function getYahooCrumb() {
    // Return cached session if still valid (cache for 5 minutes)
    if (cachedSession && Date.now() < sessionExpiry) {
        return cachedSession;
    }

    // Step 1: Hit Yahoo homepage with undici (supports maxHeaderSize option)
    const homepageRes = await request('https://finance.yahoo.com', {
        method: 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        },
        maxHeaderSize: 65536, // 64KB - Yahoo sends massive tracking headers
    });

    // Consume the body to avoid memory leak
    await homepageRes.body.dump();

    // Extract cookies from set-cookie headers
    const setCookies = homepageRes.headers['set-cookie'];
    if (!setCookies) throw new Error('No cookies received from Yahoo');

    const cookieArray = Array.isArray(setCookies) ? setCookies : [setCookies];
    const cookieString = cookieArray.map(c => c.split(';')[0]).join('; ');

    // Step 2: Use the cookie to get a valid crumb
    const crumbRes = await request('https://query1.finance.yahoo.com/v1/test/getcrumb', {
        method: 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Cookie': cookieString,
        },
    });

    const crumb = await crumbRes.body.text();

    if (!crumb || crumb.includes('Unauthorized')) {
        throw new Error('Failed to obtain crumb');
    }

    cachedSession = { cookie: cookieString, crumb };
    sessionExpiry = Date.now() + 5 * 60 * 1000; // Cache for 5 minutes
    return cachedSession;
}

export default async function handler(req, res) {
    const { ticker } = req.query;

    if (!ticker) {
        return res.status(400).json({ error: 'Ticker is required' });
    }

    try {
        const session = await getYahooCrumb();

        // Step 3: Fetch the actual quoteSummary with crumb auth
        const modules = 'defaultKeyStatistics,summaryDetail,financialData,price';
        const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=${modules}&crumb=${encodeURIComponent(session.crumb)}`;

        const dataRes = await request(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Cookie': session.cookie,
            },
        });

        const rawText = await dataRes.body.text();

        if (dataRes.statusCode === 401) {
            // Crumb expired, clear cache and retry once
            cachedSession = null;
            sessionExpiry = 0;
            return res.status(401).json({ error: 'Yahoo auth expired, retry' });
        }

        if (dataRes.statusCode !== 200) {
            return res.status(dataRes.statusCode).json({ error: `Yahoo returned ${dataRes.statusCode}` });
        }

        const data = JSON.parse(rawText);

        // Aggressively cache — fundamentals don't change by the second
        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
        res.status(200).json(data);

    } catch (error) {
        console.error('Yahoo QuoteSummary v10 error:', error);
        // Clear session cache on any error
        cachedSession = null;
        sessionExpiry = 0;
        res.status(500).json({ error: String(error) });
    }
}
