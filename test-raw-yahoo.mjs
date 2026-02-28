async function testRawYahoo() {
    const ticker = process.argv[2] || 'DOFG.OL';

    try {
        console.log(`\n--- Fetching Raw Yahoo v8/v10 Data for ${ticker} ---`);

        console.log(`1. v8 Chart Data (Basic Price & Meta)...`);
        const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;

        const priceRes = await fetch(yahooUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            }
        });

        if (!priceRes.ok) throw new Error(`Yahoo v8 returned ${priceRes.status}`);
        const priceData = await priceRes.json();

        const baseResult = priceData?.chart?.result?.[0]?.meta;
        console.log(`   Market Price: ${baseResult.regularMarketPrice}`);

        console.log(`2. v10 QuoteSummary (Fundamentals)...`);
        const summaryUrl = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=defaultKeyStatistics,summaryDetail,financialData`;

        const sumRes = await fetch(summaryUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            }
        });

        if (sumRes.ok) {
            const sumData = await sumRes.json();
            const resData = sumData?.quoteSummary?.result?.[0];
            const stats = resData.defaultKeyStatistics || {};
            const summary = resData.summaryDetail || {};
            const financial = resData.financialData || {};

            console.log(`   Market Cap: ${summary.marketCap?.raw}`);
            console.log(`   EPS: ${stats.trailingEps?.raw}`);
            console.log(`   Revenue: ${financial.totalRevenue?.raw}`);
        } else {
            console.log(`   v10 Failed with status ${sumRes.status}`);
        }

    } catch (e) {
        console.error("Test failed:", e);
    }
}

testRawYahoo();
