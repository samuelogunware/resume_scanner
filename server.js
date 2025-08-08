// A simple backend proxy server to securely handle the Gemini API key.
// To run this:
// 1. Make sure you have Node.js installed.
// 2. In your terminal, in the folder with this file, run: npm install express node-fetch dotenv
// 3. Create a file named ".env" in the same folder.
// 4. In the ".env" file, add your API key like this: GEMINI_API_KEY=AIzaSy...
// 5. Run the server with: node server.js

const express = require('express');
const fetch = require('node-fetch');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

const app = express();
// Middleware to parse JSON bodies
app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${GEMINI_API_KEY}`;

// Define the proxy endpoint
app.post('/api/gemini', async (req, res) => {
    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: "API key not configured on the server." });
    }

    try {
        const { prompt, isJson } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: "Prompt is missing from the request." });
        }

        const payload = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: isJson ? { responseMimeType: "application/json" } : {},
        };

        const apiResponse = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await apiResponse.json();

        if (!apiResponse.ok) {
            // Forward the error from the Gemini API
            console.error("Error from Gemini API:", data);
            return res.status(apiResponse.status).json(data);
        }

        res.json(data);

    } catch (error) {
        console.error("Error in backend proxy:", error);
        res.status(500).json({ error: "An internal server error occurred." });
    }
});

// Serve the React app (assuming it's built in a 'build' folder)
// In development, you'll run the React dev server and this server separately.
// Your React app will proxy API requests to this server.
// For production, you would build your React app and have this server serve the static files.
app.use(express.static('build'));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log('This server acts as a secure proxy for your Gemini API calls.');
});
