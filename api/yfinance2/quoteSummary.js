const https = require('https');

// Cache crumb+cookie across warm invocations
let cachedSession = null;
let sessionExpiry = 0;

function getYahooCrumb() {
    return new Promise((resolve, reject) => {
        // Use Node's native https with maxHeaderSize to handle Yahoo's massive tracking headers
        const options = {
            hostname: 'finance.yahoo.com',
            path: '/',
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            },
            maxHeaderSize: 65536, // 64KB - Yahoo sends enormous tracking headers
        };

        const req = https.request(options, (res) => {
            // We only need the cookies, drain the body
            res.resume();

            const setCookies = res.headers['set-cookie'];
            if (!setCookies) {
                reject(new Error('No cookies received from Yahoo'));
                return;
            }

            const cookieString = setCookies.map(c => c.split(';')[0]).join('; ');

            // Step 2: Get crumb using the cookie
            const crumbOptions = {
                hostname: 'query1.finance.yahoo.com',
                path: '/v1/test/getcrumb',
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Cookie': cookieString,
                },
            };

            const crumbReq = https.request(crumbOptions, (crumbRes) => {
                let crumb = '';
                crumbRes.on('data', d => crumb += d);
                crumbRes.on('end', () => {
                    if (!crumb || crumb.includes('Unauthorized') || crumb.includes('<')) {
                        reject(new Error('Failed to obtain crumb: ' + crumb.substring(0, 100)));
                        return;
                    }
                    resolve({ cookie: cookieString, crumb });
                });
            });
            crumbReq.on('error', reject);
            crumbReq.end();
        });

        req.on('error', reject);
        req.end();
    });
}

module.exports = async function handler(req, res) {
    const { ticker } = req.query;

    if (!ticker) {
        return res.status(400).json({ error: 'Ticker is required' });
    }

    try {
        // Return cached session if still valid
        if (!cachedSession || Date.now() >= sessionExpiry) {
            cachedSession = await getYahooCrumb();
            sessionExpiry = Date.now() + 5 * 60 * 1000; // Cache 5 min
        }

        // Fetch v10 quoteSummary with crumb auth
        const modules = 'defaultKeyStatistics,summaryDetail,financialData,price';
        const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=${modules}&crumb=${encodeURIComponent(cachedSession.crumb)}`;

        const dataRes = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Cookie': cachedSession.cookie,
            },
        });

        if (dataRes.status === 401) {
            // Crumb expired, clear cache
            cachedSession = null;
            sessionExpiry = 0;
            return res.status(401).json({ error: 'Yahoo auth expired, please retry' });
        }

        if (!dataRes.ok) {
            return res.status(dataRes.status).json({ error: `Yahoo returned ${dataRes.status}` });
        }

        const data = await dataRes.json();

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
