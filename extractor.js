const axios = require('axios');

const DEFAULT_COOKIE = "ndus=Y2YqaCTteHuiU3Ud_MYU7vHoVW4DNBi0MPmg_1tQ";

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
async function extractTeraboxInfo(link) {
  // Try to determine the best domain to use based on the input link
  const domain = link.includes('terabox.app') ? 'www.terabox.app' : 'www.1024terabox.com';
  const cookie = process.env.COOKIE || DEFAULT_COOKIE;

  const axiosInstance = axios.create({
    headers: {
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "Accept-Encoding": "gzip, deflate, br",
      "Accept-Language": "en-US,en;q=0.9,hi;q=0.8",
      "Connection": "keep-alive",
      "DNT": "1",
      "Host": domain,
      "Upgrade-Insecure-Requests": "1",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      "Cookie": cookie,
    },
    maxRedirects: 5
  });

  try {
    // 1. Initial request to resolve the link and get tokens
    const tempReq = await axiosInstance.get(link);
    if (!tempReq) throw new Error("Could not fetch the initial page");
    
    const responseUrl = tempReq.request.res.responseUrl || link;
    const urlObj = new URL(responseUrl);
    const surl = urlObj.searchParams.get("surl");

    if (!surl) {
        // Fallback for links like /s/1xyz...
        const pathMatch = urlObj.pathname.match(/\/s\/([a-zA-Z0-9\-_]+)/);
        if (!pathMatch) throw new Error("Invalid link format. No surl found.");
        var actualSurl = pathMatch[1];
    } else {
        var actualSurl = surl;
    }

    const respo = tempReq.data;
    
    // Robust token extraction using Regex
    // jsToken can be encoded (fn%28%22...) or plain (fn("..."))
    const jsTokenMatch = respo.match(/fn(?:%28%22|\(")([^%"]+)(?:%22%29|"\))/);
    const bdstokenMatch = respo.match(/["']bdstoken["']\s*:\s*["']([^"']+)["']/);
    const logidMatch = respo.match(/dp-logid=([^&"'\s]+)/);

    const jsToken = jsTokenMatch ? jsTokenMatch[1] : null;
    const bdstoken = bdstokenMatch ? bdstokenMatch[1] : null;
    const logid = logidMatch ? logidMatch[1] : null;

    if (!jsToken || !logid || !bdstoken) {
      console.error("Missing Tokens - Debug Info:", { 
          hasJsToken: !!jsToken, 
          hasBdstoken: !!bdstoken, 
          hasLogid: !!logid,
          dataSnippet: respo.substring(0, 500) // Log first 500 chars for debugging if needed
      });
      throw new Error("Authentication failed. Tokens not found. Your cookie might be expired or invalid.");
    }

    // 2. Fetch the file list
    const params = {
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
      site_referer: responseUrl,
      shorturl: actualSurl,
      root: "1,",
    };

    const listRes = await axiosInstance.get(`https://${domain}/share/list`, {
      params: params,
    });

    const data = listRes.data;
    if (!data || !data.list || !data.list.length || data.errno) {
      throw new Error(`Terabox API error: ${data?.errno || "No files found"}`);
    }

    const file = data.list[0];
    
    // 3. Resolve direct link
    let direct_link = file.dlink;
    try {
        const headRes = await axiosInstance.head(file.dlink, { withCredentials: false });
        direct_link = headRes.request.res.responseUrl || file.dlink;
    } catch (e) {
        console.warn("Direct link resolution failed.");
    }

    // 4. Generate Proxy URL (Bypass browser restrictions using our own proxy)
    const proxy_url = `/api/proxy?url=${encodeURIComponent(file.dlink)}&filename=${encodeURIComponent(file.server_filename || 'download')}&cookie=${encodeURIComponent(cookie)}`;

    return {
      title: file.server_filename,
      size: getFormattedSize(parseInt(file.size)),
      thumbnail: file.thumbs?.url3 || file.thumbs?.url2 || file.thumbs?.url1 || "",
      download_url: proxy_url,
      original_dlink: file.dlink,
      direct_link: direct_link,
      sizebytes: parseInt(file.size)
    };
  } catch (error) {
    console.error("Extraction failed:", error.message);
    throw error;
  }
}


module.exports = { extractTeraboxInfo };


