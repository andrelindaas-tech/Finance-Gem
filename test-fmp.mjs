async function testFMP() {
    const API_KEY = process.env.VITE_FMP_API_KEY;

    if (!API_KEY) {
        console.error("No FMP API key found in .env.local");
        return;
    }

    try {
        console.log(`\n--- Searching FMP for DOF Group ---`);
        const searchRes = await fetch(`https://financialmodelingprep.com/api/v3/search?query=DOF&exchange=OSL&apikey=${API_KEY}`);
        const searchData = await searchRes.json();

        console.log(JSON.stringify(searchData, null, 2));

    } catch (e) {
        console.error("Test failed:", e);
    }
}

testFMP();
