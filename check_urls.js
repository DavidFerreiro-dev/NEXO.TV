const fs = require('fs');
const https = require('https');
const http = require('http');

let movies = JSON.parse(fs.readFileSync('./movies.json', 'utf8'));

async function checkUrl(urlStr) {
  if (!urlStr || urlStr.trim() === '') return false;
  return new Promise((resolve) => {
    const parsedUrl = new URL(urlStr);
    const lib = urlStr.startsWith('https') ? https : http;
    const req = lib.request(parsedUrl, { method: 'HEAD', timeout: 8000 }, (res) => {
      // 3xx redirects are also OK usually, but we'll accept 200 and 302, 301, etc.
      if (res.statusCode >= 200 && res.statusCode < 400) {
          resolve(true);
      } else {
          resolve(false);
      }
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

(async () => {
    console.log("Checking URLs concurrently...");
    const promises = movies.map(async (m) => {
        if (!m.videoUrl || m.videoUrl.trim() === '') {
            m.brokenVideo = true;
            return;
        }
        const ok = await checkUrl(m.videoUrl);
        if (!ok) {
            console.log(`Failed: ${m.id} ${m.videoUrl}`);
            m.brokenVideo = true;
        } else {
            console.log(`OK: ${m.id}`);
            m.brokenVideo = false;
        }
    });
    
    await Promise.all(promises);
    
    fs.writeFileSync('./movies.json', JSON.stringify(movies, null, 2));
    console.log("Done");
})();
