require('dotenv').config();
const { Pinecone } = require('@pinecone-database/pinecone');

async function createVectorDatabase() {
    console.log("Connecting to Pinecone...");
    
    // Initialize the Pinecone client with your hidden API key
    const pc = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY
    });

    const indexName = 'vaultguard-rules';

    try {
        console.log(`Commanding Pinecone to build index: ${indexName}`);
        
        // This command provisions a serverless vector database
        await pc.createIndex({
            name: indexName,
            dimension: 1536, // This MUST be 1536 to match OpenAI's mathematical output
            metric: 'cosine', // Used to calculate the angle/distance between vectors
            spec: {
                serverless: {
                    cloud: 'aws',
                    region: 'us-east-1'
                }
            }
        });

        console.log("✅ Index created successfully! It might take 60 seconds to fully boot up on Pinecone's servers.");
    } catch (error) {
        if (error.name === 'PineconeConflictError') {
            console.log("⚠️ Index already exists. You are good to go!");
        } else {
            console.error("Failed to create index:", error);
        }
    }
}

createVectorDatabase();