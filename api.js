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

function getHeaders(cookie) {
  return {
    "Accept": "application/json, text/plain, */*",
    "Accept-Encoding": "gzip, deflate, br", 
    "Accept-Language": "en-US,en;q=0.9,hi;q=0.8",
    "Connection": "keep-alive",
    "DNT": "1",
    "Host": "www.1024terabox.com",
    "Upgrade-Insecure-Requests": "1",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0",
    "sec-ch-ua": '"Microsoft Edge";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Cookie": cookie || DEFAULT_COOKIE,
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    ...(process.env.csrfToken ? { "x-csrf-token": process.env.csrfToken } : {})
  };
}

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
  };
}

function getSize(sizeBytes) {
  if (sizeBytes >= 1024 * 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  } else if (sizeBytes >= 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`;
  } else if (sizeBytes >= 1024) {
    return `${(sizeBytes / 1024).toFixed(2)} KB`;
  }
  return `${sizeBytes} bytes`;
}

function findBetween(str, start, end) {
  const startIndex = str.indexOf(start) + start.length;
  const endIndex = str.indexOf(end, startIndex);
  if (startIndex === -1 || endIndex === -1) return "";
  return str.slice(startIndex, endIndex);
}

async function getFileInfo(link, event, cookie) {
  try {
    if (!link) {
      return { error: "Invalid request parameters." };
    }

    const headers = getHeaders(cookie);
    let response = await fetch(link, { headers });
    if (!response.ok) {
      console.error(`Failed to fetch initial link: ${response.status}`);
      return { error: "Unable to process the request. Please check your cookies and try again." };
    }

    const finalUrl = response.url;
    const url = new URL(finalUrl);
    const surl = url.searchParams.get("surl");
    if (!surl) {
      console.error("No surl found in URL");
      return { error: "Invalid link format. Please provide a valid TeraBox link." };
    }

    const text = await response.text();

    // Check if we are redirected to a login page
    if (text.includes("login") || text.includes("Verify") || text.includes("passport")) {
       return { error: "Authentication failed. Terabox is requesting a login. Please update your 'ndus' cookie." };
    }

    // Robust token extraction using Regex
    const jsTokenMatch = text.match(/fn(?:%28%22|\(")([^%"]+)(?:%22%29|"\))/);
    const bdstokenMatch = text.match(/["']bdstoken["']\s*:\s*["']([^"']*)["']/);
    const logidMatch = text.match(/dp-logid=([^&"'\s]+)/) || text.match(/["']dp-logid["']\s* : \s*["']([^"']+)["']/);

    const jsToken = jsTokenMatch ? jsTokenMatch[1] : null;
    const bdstoken = bdstokenMatch ? bdstokenMatch[1] : ""; 
    const logid = logidMatch ? logidMatch[1] : null;

    if (!jsToken || !logid) {
      console.error("Failed to extract tokens:", { hasJsToken: !!jsToken, hasLogid: !!logid, hasBdstoken: !!bdstoken });
      return { error: "Authentication failed. Tokens not found. Your cookie might be invalid or expired. Please update your 'ndus' cookie." };
    }

    const params = new URLSearchParams({
      app_id: "250528",
      web: "1",
      channel: "dubox",
      clienttype: "0",
      jsToken: jsToken,
      "dp-logid": logid,
      page: "1",
      num: "20",
      by: "name",
      order: "asc",
      site_referer: finalUrl,
      shorturl: surl,
      root: "1,",
    });

    response = await fetch(`https://www.1024terabox.com/share/list?${params}`, { headers });
    const data = await response.json();

    if (!data || !data.list || !data.list.length) {
      if (data && data.errno) {
         return { error: `Terabox API Error: ${data.errmsg || 'Access denied'}. Your cookie might be expired.` };
      }
      return { error: "Unable to retrieve file information. The link might be private or deleted." };
    }

    const fileInfo = data.list[0];
    const baseUrl = `https://${event.headers.host}`;
    
    return {
      file_name: fileInfo.server_filename || "",
      download_link: fileInfo.dlink || "",
      thumbnail: fileInfo.thumbs?.url3 || "",
      file_size: getSize(parseInt(fileInfo.size || 0)),
      size_bytes: parseInt(fileInfo.size || 0),
      proxy_url: `/api/proxy?url=${encodeURIComponent(fileInfo.dlink)}&filename=${encodeURIComponent(fileInfo.server_filename || 'download')}&cookie=${encodeURIComponent(cookie)}`,
    };
  } catch (error) {
    console.error("Error in getFileInfo:", error.message);
    return { error: "A generic error occurred. Please try again." };
  }
}

function extractCookie(event, body = null) {
  if (event.httpMethod === 'POST' && body && body.cookies) {
    return body.cookies;
  }
  
  if (event.httpMethod === 'GET') {
    const url = new URL(event.rawUrl);
    const cookieParam = url.searchParams.get('cookies');
    if (cookieParam) {
      return cookieParam;
    }
  }
  
  return null;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Range",
  "Access-Control-Expose-Headers": "Content-Length,Content-Range"
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

  // Check for download endpoint
  if (event.path === '/download' || event.queryStringParameters?.download !== undefined) {
    // Only allow POST method for download endpoint
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        body: JSON.stringify({ error: "Method not allowed. Use POST request only." })
      };
    }
  }

  // Handle POST request
  if (event.httpMethod === "POST") {
    try {
      const body = JSON.parse(event.body || '{}');
      const { link } = body;
      
      if (!link) {
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json", ...CORS_HEADERS },
          body: JSON.stringify({ error: "Invalid request parameters." })
        };
      }

      const cookie = extractCookie(event, body);
      if (!cookie) {
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json", ...CORS_HEADERS },
          body: JSON.stringify({ error: "Cookie parameter is required for authentication." })
        };
      }

      const fileInfo = await getFileInfo(link, event, cookie);
      return {
        statusCode: fileInfo.error ? 400 : 200,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        body: JSON.stringify(fileInfo)
      };
    } catch (error) {
      console.error("POST API error:", error.message);
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        body: JSON.stringify({ error: "A generic error occurred. Please try again." })
      };
    }
  }

  return {
    statusCode: 404,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    body: JSON.stringify({ error: "Endpoint not found." })
  };
};
