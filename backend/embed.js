require('dotenv').config();
const fs = require('fs');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Pinecone } = require('@pinecone-database/pinecone');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

async function embedAndUpload() {
    try {
        console.log("Reading FinTech rules...");
        const rawData = fs.readFileSync('./data/rules.json');
        const rules = JSON.parse(rawData);

        const index = pc.index('vaultguard-rules-gemini');
        
        // Load Gemini's embedding model
        const model = genAI.getGenerativeModel({ model: "gemini-embedding-2" });

for (const rule of rules) {
            console.log(`Translating rule: [${rule.topic}]`);
            
            const result = await model.embedContent(rule.text);
            
            // THE FIX: Explicitly convert Gemini's output to a standard JS Array
            const vectorMath = Array.from(result.embedding.values);

            const pineconeRecord = {
                id: rule.id,
                values: vectorMath,
                metadata: { topic: rule.topic, text: rule.text }
            };

            await index.upsert([pineconeRecord]);
            console.log(`✅ Uploaded [${rule.id}]`);
        }
        console.log("🎯 Brain is loaded for ₹0!");

    } catch (error) {
        console.error("Failed to embed and upload rules:", error);
    }
}

embedAndUpload();