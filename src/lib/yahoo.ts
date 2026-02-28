// Yahoo Finance API Helper
// In development, we use Vite's proxy (/api/yahoo) to bypass CORS.
// For production, this should point to a backend or a serverless function.

const YAHOO_BASE_URL = import.meta.env.PROD
    ? 'https://query1.finance.yahoo.com' // NOTE: Direct calls will fail in production due to CORS. You will need a backend proxy.
    : '/api/yahoo';

export type Interval = '1m' | '2m' | '5m' | '15m' | '30m' | '60m' | '90m' | '1h' | '1d' | '5d' | '1wk' | '1mo' | '3mo';
export type Range = '1d' | '5d' | '1wk' | '1mo' | '3mo' | '6mo' | '1y' | '2y' | '3y' | '5y' | '10y' | 'ytd' | 'max';

/**
 * Fetch chart data for a given ticker
 */
export async function fetchChartData(ticker: string, range: Range = '1mo', interval: Interval = '1d') {
    try {
        const response = await fetch(`${YAHOO_BASE_URL}/v8/finance/chart/${ticker}?range=${range}&interval=${interval}`);

        if (!response.ok) {
            throw new Error(`Failed to fetch chart data: ${response.statusText}`);
        }

        const data = await response.json();
        return data.chart.result?.[0] || null; // Return the full result object including meta
    } catch (error) {
        console.error('Yahoo Finance API Error (Chart):', error);
        return null;
    }
}

/**
 * Fetch current quotes for an array of tickers
 * Uses v8 chart endpoint to bypass 401 Unauthorized from the v7 quote endpoint
 */
export async function fetchQuotes(tickers: string[]) {
    if (!tickers || tickers.length === 0) return [];

    try {
        const promises = tickers.map(async (ticker) => {
            // Fetch 1d range to get the latest quote in meta
            const chartData = await fetchChartData(ticker, '1d', '1d');
            if (!chartData || !chartData.meta) return null;

            const meta = chartData.meta;
            const currentPrice = meta.regularMarketPrice || 0;
            const prevClose = meta.chartPreviousClose || 0;
            const change = currentPrice - prevClose;
            const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

            return {
                symbol: meta.symbol,
                shortName: meta.symbol, // Yahoo doesn't always send name in chart meta, fallback to ticker
                regularMarketPrice: currentPrice,
                regularMarketChange: change,
                regularMarketChangePercent: changePercent,
                currency: meta.currency,
            };
        });

        const results = await Promise.all(promises);
        return results.filter(Boolean); // remove nulls
    } catch (error) {
        console.error('Yahoo Finance API Error (Quotes workaround):', error);
        return [];
    }
}

/**
 * Helper to process chart data into the format Recharts expects:
 * Array of { time, price }
 */
export function processChartDataForRecharts(chartData: any) {
    if (!chartData || !chartData.timestamp || !chartData.indicators?.quote?.[0]?.close) {
        return [];
    }

    const timestamps: number[] = chartData.timestamp;
    const closingPrices: number[] = chartData.indicators.quote[0].close;

    return timestamps.map((ts, index) => {
        // Sometimes Yahoo returns null for a specific closing price
        const price = closingPrices[index];

        return {
            time: ts * 1000,
            price: price ? Number(price.toFixed(2)) : null,
            day: new Date(ts * 1000).toLocaleDateString('nb-NO', { month: 'short', day: 'numeric' })
        };
    }).filter(point => point.price !== null); // Filter out null points
}

/**
 * Fetch key financial stats (P/E, P/B, EPS, Market Cap, etc.)
 * Uses our local Vite backend proxy which runs `yahoo-finance2`.
 * This bypasses CORS and securely handles Yahoo's crumb authentication.
 */
export async function fetchKeyStats(ticker: string) {
    // ----------------------------------------------------------------------
    // TEMPORARY MOCK DATA
    // Due to active development hitting Yahoo's API aggressively, the IP
    // was temporarily rate-limited (HTTP 429). Returning mock data to
    // unblock UI development.
    // Uncomment the real fetch below when the rate limit expires.
    // ----------------------------------------------------------------------
    console.warn(`[MOCK MODE] Returning fake key stats for ${ticker} due to Yahoo rate limits`);

    return {
        // Valuation
        marketCap: ticker === 'DOFG.OL' ? 15280000000 : 850000000,
        pe: 14.2,
        forwardPe: 12.8,
        pb: 1.5,
        ps: 2.1,
        peg: 1.1,

        // Per Share
        eps: 8.54,
        bookValue: 56.40,

        // Dividends
        dividendYield: 0.042, // 4.2%
        dividendPerShare: 3.50,

        // Revenue / Profitability
        revenue: ticker === 'DOFG.OL' ? 12400000000 : 450000000,
        ebitda: ticker === 'DOFG.OL' ? 4200000000 : 120000000,
        profitMargin: 0.18, // 18%

        // 52-week
        fiftyTwoWeekHigh: 115.50,
        fiftyTwoWeekLow: 75.20,

        // Other
        beta: 1.25,
        shortName: ticker === 'DOFG.OL' ? 'DOF Group ASA' : ticker,
        currency: 'NOK',
    };

    /* --- REAL IMPLEMENTATION (Commented out) ---
    try {
        const response = await fetch(`/api/yfinance2/quoteSummary?ticker=${ticker}`);

        if (!response.ok) {
            console.error(`yahoo-finance2 proxy returned ${response.status}`);
            throw new Error(`Failed to fetch key stats: ${response.statusText}`);
        }

        const data = await response.json();
        if (!data) return null;

        const stats = data.defaultKeyStatistics || {};
        const financial = data.financialData || {};
        const summary = data.summaryDetail || {};
        const priceData = data.price || {};

        return {
            // Valuation
            marketCap: priceData.marketCap || summary.marketCap || null,
            pe: summary.trailingPE || stats.trailingPE || null,
            forwardPe: summary.forwardPE || stats.forwardPE || null,
            pb: stats.priceToBook || null,
            ps: stats.priceToSalesTrailing12Months || null,
            peg: stats.pegRatio || null,

            // Per Share
            eps: financial.earningsPerShare || stats.trailingEps || null,
            bookValue: stats.bookValue || null,

            // Dividends
            dividendYield: summary.dividendYield || summary.trailingAnnualDividendYield || null,
            dividendPerShare: summary.dividendRate || summary.trailingAnnualDividendRate || null,

            // Revenue / Profitability
            revenue: financial.totalRevenue || null,
            ebitda: financial.ebitda || null,
            profitMargin: financial.profitMargins || null,

            // 52-week
            fiftyTwoWeekHigh: summary.fiftyTwoWeekHigh || null,
            fiftyTwoWeekLow: summary.fiftyTwoWeekLow || null,

            // Other
            beta: summary.beta || stats.beta || null,
            shortName: priceData.shortName || priceData.longName || ticker,
            currency: priceData.currency || financial.financialCurrency || 'NOK',
        };
    } catch (error) {
        console.error('Yahoo Finance 2 Proxy Error (Key Stats):', error);
        return null;
    }
    */
}

/**
 * Autocomplete search for a specific ticker symbol
 */
export async function searchTickers(query: string) {
    if (!query || query.trim().length === 0) return [];

    try {
        // Increasing quotesCount to 15 so European index funds don't get buried under news or US equivalents
        const response = await fetch(`${YAHOO_BASE_URL}/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=15&newsCount=0`);

        if (!response.ok) {
            throw new Error(`Failed to search tickers: ${response.statusText}`);
        }

        const data = await response.json();
        return data.quotes || [];
    } catch (e) {
        console.error("Yahoo Search API Error:", e);
        return [];
    }
}
