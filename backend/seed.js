require('dotenv').config();
const fs = require('fs');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Pinecone } = require('@pinecone-database/pinecone');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

async function seedDatabase() {
    try {
        console.log("Reading FinTech rules...");
        const rawData = fs.readFileSync('./data/rules.json');
        const rules = JSON.parse(rawData);

        console.log("Locating Pinecone database host...");
        // 1. Get the exact URL of your cloud database
        const indexDescription = await pc.describeIndex('vaultguard-rules-gemini');
        const host = indexDescription.host;

        const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
        const batchRecords = [];

for (const rule of rules) {
            console.log(`Translating rule: [${rule.topic}]`);
            
            // Correctly format the content object into the parts array Google expects
            const result = await model.embedContent({
                content: { parts: [{ text: rule.text }] },
                outputDimensionality: 768
            });
            
            // Force strict floats for the REST payload
            const vectorMath = Array.from(result.embedding.values).map(v => parseFloat(v));

            batchRecords.push({
                id: String(rule.id), 
                values: vectorMath,
                metadata: { 
                    topic: String(rule.topic), 
                    text: String(rule.text) 
                }
            });
        }

        console.log(`Bypassing SDK: Force-uploading ${batchRecords.length} records via REST API...`);
        
        // 2. The Bypass: Raw HTTP POST directly to Pinecone's servers
        const response = await fetch(`https://${host}/vectors/upsert`, {
            method: 'POST',
            headers: {
                'Api-Key': process.env.PINECONE_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ vectors: batchRecords })
        });

        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`REST API Failed: ${errorData}`);
        }

        console.log("🎯 Brain is loaded for ₹0! Baseline secured.");
        
    } catch (error) {
        console.error("Pipeline Failed:", error);
    }
}

seedDatabase();