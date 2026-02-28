import yahooFinance from 'yahoo-finance2';

async function main() {
    try {
        console.log("Fetching DOFG.OL...");
        const result = await yahooFinance.quoteSummary('DOFG.OL', {
            modules: ['defaultKeyStatistics', 'summaryDetail', 'financialData', 'price']
        });
        console.log(JSON.stringify(result, null, 2).substring(0, 500));
    } catch (e) {
        console.error("Error:", e);
    }
}

main();
