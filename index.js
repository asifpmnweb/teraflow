require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const { extractTeraboxInfo } = require('./extractor');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet({
    contentSecurityPolicy: false
})); 
app.use(cors());   
app.use(morgan('dev')); 
app.use(express.json());

// 1. Serve static files (CSS, JS, Images) from the root directory
// This MUST come before the wildcard routes
app.use(express.static(path.join(__dirname, '.')));

// 2. API Endpoints
app.get('/api/download', async (req, res) => {
    const url = req.query.url || req.query.data;
    if (!url) return res.status(400).json({ error: 'URL or Data parameter is required' });

    try {
        console.log(`Processing URL: ${url}`);
        const info = await extractTeraboxInfo(url);
        res.json(info);
    } catch (error) {
        console.error(`Error processing ${url}:`, error.message);
        res.status(500).json({ 
            error: error.message || 'Internal Server Error',
            details: 'Make sure the link is public and valid.'
        });
    }
});

// 3. Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date(), environment: 'vercel-unified' });
});

// 4. SPA Fallback: Serve index.html for any other route
// This ensures that the frontend loads correctly on the root URL
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Export for Vercel
module.exports = app;

// Local startup
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}
