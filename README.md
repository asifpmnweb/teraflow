# TeraFlow - Premium Terabox Downloader

A full-stack web application to extract and download videos from Terabox links with a modern, high-performance UI.

## Features
- **Modern UI**: Dark theme with glassmorphism and smooth animations.
- **Fast Extraction**: Direct metadata and link retrieval.
- **Mobile Responsive**: Fully optimized for all devices.
- **Security**: No files stored on the server; links generated on-the-fly.
- **Copy Link**: One-click download link copying.

## Tech Stack
- **Frontend**: HTML5, Vanilla CSS3, JavaScript (ES6+).
- **Backend**: Node.js, Express, Axios.
- **Security**: Helmet, CORS.

## Local Setup

### 1. Backend
```bash
cd backend
npm install
npm start
```
The server will run on `http://localhost:5000`.

### 2. Frontend
Open `frontend/index.html` in your browser. (Note: For local testing, ensure the `API_BASE_URL` in `frontend/script.js` points to `http://localhost:5000`).

## Deployment Steps

### Frontend (Vercel)
1. Push your code to a GitHub repository.
2. Go to [Vercel](https://vercel.com) and click "Add New Project".
3. Import your repository.
4. Set the **Root Directory** to `frontend`.
5. Click **Deploy**.

### Backend (Railway / Render)
1. Push your code to a GitHub repository.
2. Go to [Railway](https://railway.app) or [Render](https://render.com).
3. Create a new Web Service and link your repository.
4. Set the **Root Directory** to `backend`.
5. Add any necessary Environment Variables (like `PORT`).
6. After deployment, update the `https://your-backend-api.railway.app` URL in `frontend/script.js` with your actual backend URL and redeploy the frontend.

## Disclaimer
“Download only content you own or have permission to use”
