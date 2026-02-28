import https from 'https';

// Cache crumb+cookie across warm serverless invocations
let cachedSession = null;
let sessionExpiry = 0;

function httpsGet(url, headers = {}) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const req = https.request({
            hostname: parsedUrl.hostname,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            headers,
        }, (res) => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => resolve({
                statusCode: res.statusCode,
                headers: res.headers,
                body,
            }));
        });
        req.on('error', reject);
        req.end();
    });
}

async function getYahooCrumb() {
    if (cachedSession && Date.now() < sessionExpiry) {
        return cachedSession;
    }

    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

    // Step 1: Hit fc.yahoo.com to get a lightweight session cookie
    // fc.yahoo.com typically returns a 404 body but DOES set the A3 cookie we need
    const cookieRes = await httpsGet('https://fc.yahoo.com', { 'User-Agent': ua });

    const setCookies = cookieRes.headers['set-cookie'];
    if (!setCookies) {
        throw new Error(`No cookies from fc.yahoo.com (status ${cookieRes.statusCode})`);
    }

    const cookieArray = Array.isArray(setCookies) ? setCookies : [setCookies];
    const cookieString = cookieArray.map(c => c.split(';')[0]).join('; ');

    // Step 2: Get crumb
    const crumbRes = await httpsGet('https://query2.finance.yahoo.com/v1/test/getcrumb', {
        'User-Agent': ua,
        'Cookie': cookieString,
    });

    const crumb = crumbRes.body.trim();
    if (!crumb || crumbRes.statusCode !== 200 || crumb.startsWith('<')) {
        throw new Error(`Crumb failed (status ${crumbRes.statusCode}): ${crumb.substring(0, 80)}`);
    }

    cachedSession = { cookie: cookieString, crumb };
    sessionExpiry = Date.now() + 5 * 60 * 1000;
    return cachedSession;
}

export default async function handler(req, res) {
    const { ticker } = req.query;
    if (!ticker) {
        return res.status(400).json({ error: 'Ticker is required' });
    }

    try {
        const session = await getYahooCrumb();

        const modules = 'defaultKeyStatistics,summaryDetail,financialData,price';
        const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=${modules}&crumb=${encodeURIComponent(session.crumb)}`;

        const dataRes = await httpsGet(url, {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Cookie': session.cookie,
        });

        if (dataRes.statusCode === 401) {
            cachedSession = null;
            sessionExpiry = 0;
            return res.status(401).json({ error: 'Yahoo auth expired, retry' });
        }

        if (dataRes.statusCode !== 200) {
            return res.status(dataRes.statusCode).json({
                error: `Yahoo returned ${dataRes.statusCode}`,
                body: dataRes.body.substring(0, 200),
            });
        }

        const data = JSON.parse(dataRes.body);

        // Cache fundamentals aggressively (5 min cache, 10 min stale)
        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
        res.status(200).json(data);

    } catch (error) {
        console.error('Yahoo QuoteSummary error:', error);
        cachedSession = null;
        sessionExpiry = 0;
        res.status(500).json({ error: String(error) });
    }
}
