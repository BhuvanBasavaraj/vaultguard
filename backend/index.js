const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { OpenAI } = require('openai');

const app = express();

// Middleware: Lets our React frontend talk to this Node backend without security blocks
app.use(cors()); 
// Middleware: Lets our server understand JSON data sent from the frontend
app.use(express.json()); 

// Initialize the AI client using the secret key from your .env file
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// The main endpoint: React will send text here to be reviewed
app.post('/api/review', async (req, res) => {
    try {
        const { draftText } = req.body;

        if (!draftText) {
            return res.status(400).json({ error: "Draft text is required" });
        }

        console.log("Analyzing draft for compliance...");

        // The AI Call
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini", // Fast, cheap, perfect for hackathon MVPs
            messages: [
                {
                    // The 'system' prompt programs the AI's persona and rules
                    role: "system", 
                    content: `You are a strict FinTech compliance reviewer. 
                    Review the user's drafted marketing text. 
                    Identify any unsupported financial claims, guarantees of returns, or off-brand terminology.
                    Return a JSON object with two arrays: 'violations' (what they did wrong and why) and 'suggestions' (how to rewrite it compliantly).`
                },
                {
                    // The 'user' prompt is the actual draft text from the frontend
                    role: "user", 
                    content: draftText 
                }
            ],
            // Forces the AI to reply in strict JSON so React can easily display it
            response_format: { type: "json_object" } 
        });

        const result = JSON.parse(response.choices[0].message.content);
        res.json(result); // Send the violations and suggestions back to React

    } catch (error) {
        console.error("AI Pipeline Error:", error);
        res.status(500).json({ error: "Failed to process the review." });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`VaultGuard AI Backend running on http://localhost:${PORT}`);
});