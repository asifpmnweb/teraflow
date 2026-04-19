const axios = require('axios');

/**
 * Extracts Terabox file information and download links.
 * Note: Some links may require authentication cookies for high-speed or private access.
 */
async function extractTeraboxInfo(teraboxUrl) {
    try {
        // Support all Terabox alternative domains
        const supportedKeywords = ['terabox', 'nephobox', '4funbox', 'mirrobox', 'momerybox', 'tibibox', '1024tera', 'freeterabox', 'dubox'];
        if (!supportedKeywords.some(k => teraboxUrl.toLowerCase().includes(k))) {
            throw new Error('Please provide a valid Terabox link.');
        }

        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Referer': 'https://www.terabox.com/'
        };

        // 1. Resolve the short URL to get surl and initial cookies
        const initialResponse = await axios.get(teraboxUrl, { 
            headers,
            maxRedirects: 5,
            validateStatus: (status) => status >= 200 && status < 400
        });

        const finalUrl = initialResponse.request.res.responseUrl || teraboxUrl;
        const surlMatch = finalUrl.match(/surl=([a-zA-Z0-9\-_]+)/) || teraboxUrl.match(/\/s\/([a-zA-Z0-9\-_]+)/);
        
        if (!surlMatch) {
            throw new Error('Could not resolve the Terabox link. Make sure it is a valid share link.');
        }
        const surl = surlMatch[1];

        // 2. Fetch file list using shorturlinfo API (often bypasses login requirements)
        const infoUrl = `https://www.terabox.com/api/shorturlinfo?surl=${surl}`;
        
        const infoResponse = await axios.get(infoUrl, { 
            headers: {
                ...headers,
                'User-Agent': 'Logitech/1.7.1 (Logitech G HUB; Windows 10; 10.0.19045)', // Specific high-trust User-Agent
            }
        });
        
        if (infoResponse.data.errno !== 0) {
            console.warn(`shorturlinfo failed (Error ${infoResponse.data.errno}). Trying secondary API.`);
            
            // Secondary approach: share/list
            const listUrl = `https://www.terabox.com/share/list?surl=${surl}&root=1&desc=1&order=name&num=20&page=1`;
            const listResponse = await axios.get(listUrl, { headers });
            
            if (listResponse.data.errno !== 0) {
                throw new Error('This link is private or restricted by Terabox. Please try a public share link.');
            }
            
            var fileList = listResponse.data.list;
        } else {
            var fileList = infoResponse.data.list;
        }

        if (!fileList || fileList.length === 0) {
            throw new Error('No files found in this link.');
        }

        const file = fileList[0];
        const thumbnail = file.thumbs ? (file.thumbs.url3 || file.thumbs.url2 || file.thumbs.url1) : 'https://raw.githubusercontent.com/Antigravity/assets/main/video-placeholder.png';

        // Direct Link Generation with specific download API
        const downloadUrl = `https://www.terabox.com/share/download?surl=${surl}&fs_id=${file.fs_id}`;

        return {
            title: file.server_filename,
            size: formatBytes(file.size),
            thumbnail: thumbnail,
            download_url: downloadUrl,
            fs_id: file.fs_id,
            path: file.path
        };

    } catch (error) {
        console.error('Extraction Error Details:', error.response ? error.response.data : error.message);
        if (error.message.includes('ECONNREFUSED')) throw new Error('Could not connect to Terabox. Try again later.');
        throw error;
    }
}

function generateDownloadLink(file, surl) {
    // Reconstructing a download link that often works for public files
    // This uses the d.terabox.com pattern or the direct api call pattern
    return `https://www.terabox.com/share/download?surl=${surl}&fs_id=${file.fs_id}`;
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

module.exports = { extractTeraboxInfo };
