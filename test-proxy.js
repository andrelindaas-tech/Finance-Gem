async function test() {
    try {
        const res = await fetch('http://localhost:5174/api/yahoo/v7/finance/quote?symbols=AAPL,MSFT,EQNR.OL,DNB-TEK.OL');
        const text = await res.text();
        console.log("Status:", res.status);
        console.log("Data:", text.substring(0, 500));
    } catch (e) {
        console.error("Fetch failed", e);
    }
}
test();
