require('dotenv').config();
const { Pinecone } = require('@pinecone-database/pinecone');

async function createGeminiIndex() {
    const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const indexName = 'vaultguard-rules-gemini';

    try {
        console.log(`Building Gemini-compatible index: ${indexName}...`);
        await pc.createIndex({
            name: indexName,
            dimension: 768, // Gemini's exact mathematical dimension
            metric: 'cosine',
            spec: { serverless: { cloud: 'aws', region: 'us-east-1' } }
        });
        console.log("✅ New index created! Wait about 60 seconds before embedding.");
    } catch (error) {
        if (error.name === 'PineconeConflictError') console.log("⚠️ Index exists!");
        else console.error("Error:", error);
    }
}
createGeminiIndex();