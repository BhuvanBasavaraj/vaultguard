const express = require('express');
const cors = require('cors');
require('dotenv').config();
const mongoose = require('mongoose');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Pinecone } = require('@pinecone-database/pinecone');
const Review = require('./models/Review');

const app = express();
app.use(cors());

// ⚠️ CRITICAL FIX: Increase Express JSON limit to 50mb so image uploads don't crash the server
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("📦 MongoDB Atlas connected"))
    .catch(err => console.error("❌ MongoDB connection error:", err));

// AI & Vector DB Init
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pc.index('vaultguard-rules-gemini');

app.post('/api/review', async (req, res) => {
    try {
        const { draftText, imageBase64 } = req.body;
        
        if (!draftText && !imageBase64) {
            return res.status(400).json({ error: "Provide text or an image to scan." });
        }

        // If the user only uploaded an image, provide a fallback string so Pinecone doesn't crash
        const contextText = draftText || "Marketing visual asset review";

        console.log("1. Embedding context...");
        const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
        const embedResult = await embeddingModel.embedContent({
            content: { parts: [{ text: contextText }] },
            outputDimensionality: 768
        });
        const userVector = Array.from(embedResult.embedding.values).map(v => Number(v));

        console.log("2. Querying Pinecone rules...");
        const queryResponse = await index.query({
            vector: userVector,
            topK: 2,
            includeMetadata: true
        });

        const relevantRules = queryResponse.matches.map(m => m.metadata.text).join('\n');

        console.log("3. Generating multimodal compliance analysis...");
        const chatModel = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: { responseMimeType: "application/json" }
        });

        // The Multimodal Prompt
        const promptText = `You are a strict FinTech compliance auditor.
Evaluate this marketing draft and any attached image against these internal company rules:
---
${relevantRules}
---
Draft Text Provided: "${draftText || "[See attached image]"}"

If an image is attached, VISUALLY SCAN IT. Check for hidden text, missing disclaimers, or prohibited phrases like 'guaranteed'. 
Return a JSON object with:
- "violations": array of string descriptions of rules broken (include visual issues if applicable)
- "suggestions": array of compliant rewritten alternatives`;

        // Create the array Google requires for vision processing
        const promptParts = [promptText];

        // If an image was passed from React, decode it and attach it to the AI's brain
        if (imageBase64) {
            console.log("📷 Image detected! Adding to AI payload...");
            // Extract the mime type (e.g., image/jpeg) and the raw data from the React payload
            const mimeType = imageBase64.match(/[^:]\w+\/[\w-+\d.]+(?=;|,)/)[0];
            const baseData = imageBase64.split(',')[1];
            
            promptParts.push({
                inlineData: {
                    data: baseData,
                    mimeType: mimeType
                }
            });
        }

        const response = await chatModel.generateContent(promptParts);
        const result = JSON.parse(response.response.text());

        const healthScore = Math.max(0, 100 - (result.violations.length * 25));

        console.log("4. Persisting audit log to MongoDB...");
        const savedRecord = await Review.create({
            draftText: contextText,
            violations: result.violations,
            suggestions: result.suggestions,
            healthScore
        });

        console.log("✅ Scan complete and logged.");
        res.json({
            ...result,
            healthScore,
            id: savedRecord._id,
            scannedAt: savedRecord.scannedAt
        });

    } catch (error) {
        console.error("Pipeline failure:", error);
        res.status(500).json({ error: "Compliance pipeline failed" });
    }
});

app.get('/api/history', async (req, res) => {
    try {
        const history = await Review.find().sort({ scannedAt: -1 }).limit(10);
        res.json(history);
    } catch (error) {
        console.error("History fetch error:", error);
        res.status(500).json({ error: "Failed to load audit history" });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`VaultGuard Server running on http://localhost:${PORT}`);
});