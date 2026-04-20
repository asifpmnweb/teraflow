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
  const cookie = process.env.COOKIE || DEFAULT_COOKIE;

  const axiosInstance = axios.create({
    headers: {
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
      "Cookie": cookie,
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
    },
  });

  try {
    // 1. Initial request to resolve the link and get tokens
    const tempReq = await axiosInstance.get(link);
    if (!tempReq) throw new Error("Could not fetch the initial page");
    
    const responseUrl = tempReq.request.res.responseUrl;
    const urlObj = new URL(responseUrl);
    const surl = urlObj.searchParams.get("surl");

    if (!surl) {
      throw new Error("Invalid link format. No surl found.");
    }

    const respo = tempReq.data;
    const jsToken = findBetween(respo, "fn%28%22", "%22%29");
    const logid = findBetween(respo, "dp-logid=", "&");
    const bdstoken = findBetween(respo, 'bdstoken":"', '"');

    if (!jsToken || !logid || !bdstoken) {
      throw new Error("Authentication failed. Tokens not found. Your cookie might be invalid.");
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
      shorturl: surl,
      root: "1,",
    };

    const listRes = await axiosInstance.get("https://www.1024terabox.com/share/list", {
      params: params,
    });

    const data = listRes.data;
    if (!data || !data.list || !data.list.length || data.errno) {
      throw new Error(`API error: ${data?.errno || "No files found"}`);
    }

    const file = data.list[0];
    
    // 3. Resolve direct link (optional but good for validation)
    let direct_link = file.dlink;
    try {
        const headRes = await axiosInstance.head(file.dlink, { withCredentials: false });
        direct_link = headRes.request.res.responseUrl || file.dlink;
    } catch (e) {
        console.warn("Direct link resolution failed, using dlink as is.");
    }

    // 4. Generate Proxy URL (Bypass browser restrictions)
    const proxy_url = `https://terabox.ashlynn.workers.dev/proxy?url=${encodeURIComponent(file.dlink)}&file_name=${encodeURIComponent(file.server_filename || 'download')}&cookie=${encodeURIComponent(cookie)}`;

    return {
      title: file.server_filename,
      size: getFormattedSize(parseInt(file.size)),
      thumbnail: file.thumbs?.url3 || file.thumbs?.url2 || file.thumbs?.url1 || "",
      download_url: proxy_url, // Use proxy URL by default as it's more reliable
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


