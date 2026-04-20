function getEnvCookie() {
  const cookies = [];
  if (process.env.TERABOX_NDUS) cookies.push(process.env.TERABOX_NDUS.startsWith('ndus=') ? process.env.TERABOX_NDUS : `ndus=${process.env.TERABOX_NDUS}`);
  if (process.env.browserid) cookies.push(`browserid=${process.env.browserid}`);
  if (process.env.ndut_fmt) cookies.push(`ndut_fmt=${process.env.ndut_fmt}`);
  if (process.env.ndut_fmv) cookies.push(`ndut_fmv=${process.env.ndut_fmv}`);
  if (process.env.csrfToken) cookies.push(`csrfToken=${process.env.csrfToken}`);
  if (process.env.lang) cookies.push(`lang=${process.env.lang}`);
  return cookies.join('; ');
}

const DEFAULT_COOKIE = getEnvCookie();

function getDLHeaders(cookie) {
  return {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Referer": "https://1024terabox.com/",
    "DNT": "1",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Cookie": cookie || DEFAULT_COOKIE,
    ...(process.env.csrfToken ? { "x-csrf-token": process.env.csrfToken } : {})
  };
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Range",
  "Access-Control-Expose-Headers": "Content-Length,Content-Range,Content-Disposition"
};

exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: ''
    };
  }

  // Only handle GET requests
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      body: JSON.stringify({ error: "Method not allowed. Use GET request." })
    };
  }

  const { url: downloadUrl, filename: fileName, cookie } = event.queryStringParameters || {};
  
  if (!downloadUrl) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      body: JSON.stringify({ error: "Missing required parameter: url" })
    };
  }

  try {
    const headers = getDLHeaders(cookie);
    
    // Handle range requests for video streaming/partial downloads
    const rangeHeader = event.headers.range || event.headers.Range;
    if (rangeHeader) {
      headers.Range = rangeHeader;
    }

    const response = await fetch(downloadUrl, {
      headers,
      redirect: 'follow',
    });

    if (!response.ok && response.status !== 206) {
      console.error(`Failed to fetch download: ${response.status}`);
      return {
        statusCode: 502,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        body: JSON.stringify({ error: "Download service temporarily unavailable." })
      };
    }

    // Prepare response headers
    const responseHeaders = {
      ...CORS_HEADERS,
      'Cache-Control': 'public, max-age=3600',
      'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
    };

    // Set filename for download
    if (fileName) {
      responseHeaders['Content-Disposition'] = `inline; filename="${encodeURIComponent(fileName)}"`;
    }

    // Handle range responses
    if (response.headers.get('Content-Range')) {
      responseHeaders['Content-Range'] = response.headers.get('Content-Range');
      responseHeaders['Accept-Ranges'] = 'bytes';
    }
    
    if (response.headers.get('Content-Length')) {
      responseHeaders['Content-Length'] = response.headers.get('Content-Length');
    }

    // Get response body
    const buffer = await response.arrayBuffer();

    return {
      statusCode: response.status,
      headers: responseHeaders,
      body: Buffer.from(buffer).toString('base64'),
      isBase64Encoded: true
    };

  } catch (error) {
    console.error("Proxy error:", error.message);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      body: JSON.stringify({ error: "Download service error occurred." })
    };
  }
};
