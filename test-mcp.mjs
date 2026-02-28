import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

async function main() {
    const transport = new SSEClientTransport(new URL("https://financialmodelingprep.com/mcp?apikey=rZsZRoM6woTgDQzbBCsXv1t3cstzWFPs"));
    const client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });

    await client.connect(transport);

    console.log("Connected to MCP server!");

    try {
        const tools = await client.listTools();
        console.log("Tools available:", tools.tools.map(t => t.name));

        console.log("\nCalling key-metrics for DOFG.OL...");
        const result = await client.callTool({
            name: "key-metrics",
            arguments: { symbol: "DOFG.OL" }
        });

        console.log(JSON.stringify(result, null, 2));
    } catch (e) {
        console.error("Error:", e);
    } finally {
        // Just let it exit
        process.exit(0);
    }
}

main().catch(console.error);
