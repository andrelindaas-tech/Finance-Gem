const https = require('https');

// Cache crumb+cookie across warm invocations
let cachedSession = null;
let sessionExpiry = 0;

function httpsGet(url, headers) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const req = https.request({
            hostname: parsedUrl.hostname,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            headers: headers || {},
        }, (res) => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body }));
        });
        req.on('error', reject);
        req.end();
    });
}

async function getYahooCrumb() {
    // Return cached session if still valid
    if (cachedSession && Date.now() < sessionExpiry) {
        return cachedSession;
    }

    // Step 1: Hit fc.yahoo.com — a lightweight cookie-setting endpoint
    // Unlike finance.yahoo.com, this doesn't send massive tracking headers
    const cookieRes = await httpsGet('https://fc.yahoo.com', {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    });

    const setCookies = cookieRes.headers['set-cookie'];
    if (!setCookies) {
        throw new Error('No cookies received from fc.yahoo.com, status: ' + cookieRes.statusCode);
    }

    const cookieArray = Array.isArray(setCookies) ? setCookies : [setCookies];
    const cookieString = cookieArray.map(c => c.split(';')[0]).join('; ');

    // Step 2: Get crumb using the cookie
    const crumbRes = await httpsGet('https://query2.finance.yahoo.com/v1/test/getcrumb', {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cookie': cookieString,
    });

    const crumb = crumbRes.body.trim();
    if (!crumb || crumb.includes('Unauthorized') || crumb.includes('<') || crumbRes.statusCode !== 200) {
        throw new Error('Failed to obtain crumb, status ' + crumbRes.statusCode + ': ' + crumb.substring(0, 100));
    }

    cachedSession = { cookie: cookieString, crumb };
    sessionExpiry = Date.now() + 5 * 60 * 1000; // Cache 5 min
    return cachedSession;
}

module.exports = async function handler(req, res) {
    const { ticker } = req.query;

    if (!ticker) {
        return res.status(400).json({ error: 'Ticker is required' });
    }

    try {
        const session = await getYahooCrumb();

        // Fetch v10 quoteSummary with crumb auth
        const modules = 'defaultKeyStatistics,summaryDetail,financialData,price';
        const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=${modules}&crumb=${encodeURIComponent(session.crumb)}`;

        const dataRes = await httpsGet(url, {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Cookie': session.cookie,
        });

        if (dataRes.statusCode === 401) {
            cachedSession = null;
            sessionExpiry = 0;
            return res.status(401).json({ error: 'Yahoo auth expired, please retry' });
        }

        if (dataRes.statusCode !== 200) {
            return res.status(dataRes.statusCode).json({ error: `Yahoo returned ${dataRes.statusCode}: ${dataRes.body.substring(0, 200)}` });
        }

        const data = JSON.parse(dataRes.body);

        // Aggressively cache — fundamentals don't change by the second
        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
        res.status(200).json(data);

    } catch (error) {
        console.error('Yahoo QuoteSummary error:', error);
        cachedSession = null;
        sessionExpiry = 0;
        res.status(500).json({ error: String(error) });
    }
};
