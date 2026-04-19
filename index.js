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
    contentSecurityPolicy: false // Disable CSP for video playback compatibility
})); 
app.use(cors());   
app.use(morgan('dev')); 
app.use(express.json());

// Serve static files from the root
app.use(express.static(path.join(__dirname, '.')));

// API Endpoint
app.get('/api/download', async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

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

// Root route - serve the frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date(), environment: 'unified' });
});

// Export for Vercel
module.exports = app;

// Still allow local running
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Development server running on port ${PORT}`);
    });
}
