const axios = require('axios');

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

function getFormattedSize(sizeBytes) {
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
  if (startIndex < start.length) return "";
  const endIndex = str.indexOf(end, startIndex);
  if (endIndex === -1) return "";
  return str.substring(startIndex, endIndex);
}

/**
 * Extracts Terabox file information using improved logic.
 */
/**
 * Extracts Terabox file information using a robust dual-method approach.
 */
async function extractTeraboxInfo(link) {
  const cookie = process.env.COOKIE || DEFAULT_COOKIE;
  
  // Normalize the link and extract surl
  let urlObj;
  try {
    urlObj = new URL(link);
  } catch (e) {
    throw new Error("Invalid URL provided.");
  }

  let surl = urlObj.searchParams.get("surl");
  if (!surl) {
    const pathMatch = urlObj.pathname.match(/\/s\/([a-zA-Z0-9\-_]+)/);
    if (pathMatch) surl = pathMatch[1];
  }

  // Support multiple Terabox domains
  let domain = 'www.terabox.app';
  if (link.includes('1024terabox.com')) domain = 'www.1024terabox.com';
  else if (link.includes('terabox.com')) domain = 'www.terabox.com';
  else if (link.includes('nephobox.com')) domain = 'www.nephobox.com';

  const axiosHeaders = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Cookie": cookie,
      "Referer": `https://${domain}/`
  };
  
  if (process.env.csrfToken) {
    axiosHeaders['x-csrf-token'] = process.env.csrfToken;
  }

  const axiosInstance = axios.create({
    headers: axiosHeaders,
    timeout: 15000,
    maxRedirects: 5
  });

  try {
    // METHOD 1: Try the shorturlinfo API (Very stable for public links)
    if (surl) {
      try {
        const infoRes = await axiosInstance.get(`https://${domain}/api/shorturlinfo`, {
            params: { surl, root: 1, app_id: 250528, web: 1, channel: 'dubox' }
        });
        
        if (infoRes.data && infoRes.data.errno === 0 && infoRes.data.list && infoRes.data.list.length > 0) {
          return formatResponse(infoRes.data.list[0], cookie);
        }
      } catch (err) {
        console.warn("Method 1 (API) failed, trying fallback.");
      }
    }

    // METHOD 2: Fallback to the Token-based approach (Required for some links)
    const tempReq = await axiosInstance.get(link);
    const respo = tempReq.data;

    // Check if we are redirected to a login page
    if (respo.includes("login") || respo.includes("Verify") || respo.includes("passport")) {
       throw new Error("Authentication failed. Terabox is requesting a login. Please update your 'ndus' cookie.");
    }
    
    // Improved regex for tokens
    const jsTokenMatch = respo.match(/fn(?:%28%22|\(")([^%"]+)(?:%22%29|"\))/);
    const bdstokenMatch = respo.match(/["']bdstoken["']\s*:\s*["']([^"']*)["']/);
    const logidMatch = respo.match(/dp-logid=([^&"'\s]+)/) || respo.match(/["']dp-logid["']\s*:\s*["']([^"']+)["']/);

    const jsToken = jsTokenMatch ? jsTokenMatch[1] : null;
    const bdstoken = bdstokenMatch ? bdstokenMatch[1] : ""; // Allow empty bdstoken
    const logid = logidMatch ? logidMatch[1] : null;

    if (!jsToken || !logid) {
      console.error("Token Extraction Failed:", { hasJsToken: !!jsToken, hasLogid: !!logid, hasBdstoken: !!bdstoken });
      throw new Error("Authentication failed. Tokens not found. Your cookie might be expired. Please update the 'ndus' cookie in the system.");
    }

    const listRes = await axiosInstance.get(`https://${domain}/share/list`, {
      params: {
        app_id: "250528",
        web: "1",
        channel: "dubox",
        clienttype: "0",
        jsToken: jsToken,
        "dp-logid": logid,
        page: "1",
        num: "20",
        shorturl: surl || extractSurlFromHtml(respo),
        root: "1,",
      },
    });

    if (listRes.data && listRes.data.list && listRes.data.list.length > 0) {
        return formatResponse(listRes.data.list[0], cookie);
    }

    if (listRes.data && listRes.data.errno) {
       throw new Error(`Terabox API Error (errno ${listRes.data.errno}): ${listRes.data.errmsg || 'Unknown error'}. Your cookie might be invalid.`);
    }

    throw new Error("Could not find any files. The link might be private, deleted, or requires a fresh cookie.");

  } catch (error) {
    console.error("Master Extraction Error:", error.message);
    throw error;
  }
}

function extractSurlFromHtml(html) {
    const match = html.match(/surl=([a-zA-Z0-9\-_]+)/);
    return match ? match[1] : "";
}

function formatResponse(file, cookie) {
    const proxy_url = `/api/proxy?url=${encodeURIComponent(file.dlink)}&filename=${encodeURIComponent(file.server_filename || 'download')}&cookie=${encodeURIComponent(cookie)}`;
    
    return {
      title: file.server_filename,
      size: getFormattedSize(parseInt(file.size)),
      thumbnail: file.thumbs?.url3 || file.thumbs?.url2 || file.thumbs?.url1 || "",
      download_url: proxy_url,
      original_dlink: file.dlink,
      sizebytes: parseInt(file.size)
    };
}



module.exports = { extractTeraboxInfo };


