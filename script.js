const urlInput = document.getElementById('urlInput');
const downloadBtn = document.getElementById('downloadBtn');
const btnSpinner = document.getElementById('btnSpinner');
const btnText = document.getElementById('btnText');
const errorMessage = document.getElementById('errorMessage');
const resultSection = document.getElementById('result');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const directDownloadLink = document.getElementById('directDownloadLink');
const copyBtn = document.getElementById('copyBtn');
const toast = document.getElementById('toast');

// Simple relative path since everything is on the same Vercel deployment
const API_BASE_URL = ''; 

const backBtn = document.getElementById('backBtn');
const videoPlayer = document.getElementById('videoPlayer');
const urlGroup = document.querySelector('.input-group');
const header = document.querySelector('header');

downloadBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    
    if (!url) {
        showError('Please paste a valid Terabox URL');
        return;
    }

    if (!isValidTeraboxUrl(url)) {
        showError('That doesn\'t look like a valid Terabox link');
        return;
    }

    // Reset UI
    setLoading(true);
    hideError();
    resultSection.style.display = 'none';

    try {
        // 1. Start fetching data
        const responsePromise = fetch(`${API_BASE_URL}/api/download?url=${encodeURIComponent(url)}`);
        
        // 2. Wait at least 5 seconds for "Processing" feel as requested
        const timerPromise = new Promise(resolve => setTimeout(resolve, 5000));
        
        const [response] = await Promise.all([responsePromise, timerPromise]);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to process link');
        }

        // Populate Result
        fileName.textContent = data.title;
        fileSize.textContent = data.size;
        videoPlayer.src = data.download_url;
        videoPlayer.poster = data.thumbnail;
        directDownloadLink.href = data.download_url;
        
        // Switch Views
        showPlayerView(true);

    } catch (error) {
        console.error('Download Error:', error);
        if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
            showError('Could not connect to the server. Please ensure the backend is running at ' + API_BASE_URL);
        } else {
            showError(error.message || 'Something went wrong. Please try again later.');
        }
    } finally {
        setLoading(false);
    }
});

backBtn.addEventListener('click', () => {
    showPlayerView(false);
    videoPlayer.pause();
    videoPlayer.src = "";
});

function showPlayerView(show) {
    if (show) {
        header.style.display = 'none';
        urlGroup.style.display = 'none';
        downloadBtn.style.display = 'none';
        resultSection.style.display = 'block';
    } else {
        header.style.display = 'block';
        urlGroup.style.display = 'block';
        downloadBtn.style.display = 'flex';
        resultSection.style.display = 'none';
    }
}

copyBtn.addEventListener('click', () => {
    const link = directDownloadLink.href;
    navigator.clipboard.writeText(link).then(() => {
        showToast();
    });
});

function isValidTeraboxUrl(url) {
    const supportedDomains = [
        'terabox', 'nephobox', '4funbox', 'mirrobox', 
        'momerybox', 'tibibox', '1024tera', 'freeterabox', 'dubox'
    ];
    return supportedDomains.some(domain => url.toLowerCase().includes(domain));
}

function setLoading(isLoading) {
    if (isLoading) {
        downloadBtn.disabled = true;
        btnSpinner.style.display = 'inline-block';
        btnText.textContent = 'Processing...';
        urlInput.disabled = true;
    } else {
        downloadBtn.disabled = false;
        btnSpinner.style.display = 'none';
        btnText.textContent = 'Download Video';
        urlInput.disabled = false;
    }
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
}

function hideError() {
    errorMessage.style.display = 'none';
}

function showToast() {
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Allow pressing Enter to trigger download
urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        downloadBtn.click();
    }
});
