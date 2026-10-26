/* jshint node: true, undef: true, unused: true, strict: true, esversion: 5 */
/* global Buffer */
'use strict';

var http = require('http');
var https = require('https');
var url = require('url');
var fs = require('fs');
var zlib = require('zlib');
var os = require('os');

var server = null;
var PROXY_PORT = 3001;
var FALLBACK_PORT = 3000;
var activeListenPort = PROXY_PORT;
var BACKUP_FILE_PATH = '/tmp/smartstb_backup.json';
var endpointCache = {};
var cookieJar = {};
var lastPortalReferer = '';
var lastActiveMac = '';
var memoryBackupJson = '';
var activeVideoUpReq = null;
var pendingRemoteSetup = null;
var MAG_UA = 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3';
var streamTelemetryMap = {};
var streamTelemetryKeys = [];
var latestStreamTelemetryKey = '';

function getLocalLanIp() {
    try {
        var nets = os.networkInterfaces ? os.networkInterfaces() : {};
        var names = Object.keys(nets);
        for (var i = 0; i < names.length; i++) {
            var list = nets[names[i]] || [];
            for (var j = 0; j < list.length; j++) {
                var net = list[j];
                var fam = net && net.family;
                if ((fam === 'IPv4' || fam === 4) && !net.internal && net.address && net.address !== '127.0.0.1') {
                    return net.address;
                }
            }
        }
    } catch (eIp) {}
    return '127.0.0.1';
}

function buildRemoteSetupHtml(endpointUrl) {
    return [
        '<!DOCTYPE html><html><head><meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width,initial-scale=1">',
        '<title>SmartSTB Remote Setup</title>',
        '<style>',
        'body{font-family:system-ui,-apple-system,sans-serif;background:#0b1120;color:#f8fafc;margin:0;padding:20px;}',
        '.card{max-width:480px;margin:0 auto;background:#1e293b;border:1px solid #334155;border-radius:12px;padding:20px;box-shadow:0 10px 25px rgba(0,0,0,0.5);}',
        'h2{margin-top:0;color:#38bdf8;font-size:20px;}',
        'label{display:block;font-size:13px;color:#94a3b8;margin-top:12px;margin-bottom:4px;font-weight:600;}',
        'input,select{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:8px;border:1px solid #475569;background:#0f172a;color:#fff;font-size:15px;}',
        'button{width:100%;margin-top:18px;padding:12px;border:none;border-radius:8px;background:#2563eb;color:#fff;font-size:16px;font-weight:700;cursor:pointer;}',
        '.msg{margin-top:12px;font-size:14px;text-align:center;}',
        '</style></head><body><div class="card">',
        '<h2>SmartSTB TV Remote Setup</h2>',
        '<p style="font-size:13px;color:#cbd5e1;margin-top:0;">Push Portal, Xtream, or M3U credentials directly to your TV (' + String(endpointUrl || '') + ').</p>',
        '<label>Profile Name</label><input id="name" placeholder="Living Room TV" value="Remote Profile">',
        '<label>Provider Type</label><select id="type"><option value="stalker">Stalker MAC Portal</option><option value="xtream">Xtream Codes API</option><option value="m3u">M3U / M3U8 Playlist</option></select>',
        '<label>Stalker Portal URL</label><input id="portal" placeholder="http://example.com/stalker_portal/c/">',
        '<label>Stalker MAC Address</label><input id="mac" placeholder="00:1A:79:XX:XX:XX">',
        '<label>Xtream Server URL</label><input id="xtreamUrl" placeholder="http://server.example.com:8080">',
        '<label>Xtream Username</label><input id="xtreamUser" placeholder="username">',
        '<label>Xtream Password</label><input id="xtreamPass" type="password" placeholder="password">',
        '<label>M3U Playlist URL</label><input id="m3uUrl" placeholder="https://example.com/playlist.m3u8">',
        '<label>Custom XMLTV EPG URL (Optional)</label><input id="epgUrl" placeholder="http://example.com/epg.xml.gz">',
        '<button id="sendBtn" onclick="pushCfg()">Push to TV Now</button>',
        '<div id="status" class="msg"></div>',
        '</div><script>',
        'function pushCfg(){',
        'var payload={name:document.getElementById("name").value,type:document.getElementById("type").value,portal:document.getElementById("portal").value,mac:document.getElementById("mac").value,xtreamUrl:document.getElementById("xtreamUrl").value,xtreamUser:document.getElementById("xtreamUser").value,xtreamPass:document.getElementById("xtreamPass").value,m3uUrl:document.getElementById("m3uUrl").value,epgUrl:document.getElementById("epgUrl").value};',
        'fetch("/remote-setup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)}).then(function(r){return r.json();}).then(function(d){document.getElementById("status").textContent=d.ok?"✅ Sent! Keep Settings open on your TV to auto-apply.":"❌ Error: "+(d.error||"Failed");});',
        '}',
        '</script></body></html>'
    ].join('');
}

function getStreamKey(u) {
    return String(u || '').split('?')[0];
}

function recordStreamTelemetry(key, u, data) {
    var now = Date.now();
    if (latestStreamTelemetryKey && latestStreamTelemetryKey !== key && streamTelemetryMap[latestStreamTelemetryKey]) {
        streamTelemetryMap[latestStreamTelemetryKey].active = false;
    }
    var entry = streamTelemetryMap[key];
    if (!entry) {
        if (streamTelemetryKeys.length >= 50) {
            var oldestKey = streamTelemetryKeys.shift();
            if (oldestKey) {
                delete streamTelemetryMap[oldestKey];
            }
        }
        streamTelemetryKeys.push(key);
        entry = {
            url: u,
            startTs: now,
            httpStatus: 0,
            ttfbMs: null,
            totalBytes: 0,
            kbps: 0,
            samples: [],
            errorText: '',
            videoCodec: '',
            audioCodec: '',
            active: true
        };
        streamTelemetryMap[key] = entry;
    } else {
        entry.active = true;
    }
    latestStreamTelemetryKey = key;
    if (data) {
        if (data.code) {
            entry.httpStatus = data.code;
        }
        if (data.ttfb && !entry.ttfbMs) {
            entry.ttfbMs = data.ttfb;
        }
        if (data.err) {
            entry.errorText = data.err.message || String(data.err);
        }
        if (data.chunkLen) {
            entry.totalBytes += data.chunkLen;
            entry.samples.push({ ts: now, bytes: data.chunkLen });
            var cutoff = now - 2500;
            while (entry.samples.length > 0 && entry.samples[0].ts < cutoff) {
                entry.samples.shift();
            }
            var sumBytes = 0;
            for (var s = 0; s < entry.samples.length; s++) {
                sumBytes += entry.samples[s].bytes;
            }
            entry.kbps = Math.round((sumBytes * 8) / 2.5);
        }
    }
}

function computeStreamDiagnosticVerdict(entry) {
    if (!entry) {
        return {
            status: 'unknown',
            source: 'unknown',
            label: 'NO ACTIVE STREAM',
            summary: 'No stream has been opened yet.',
            reason: 'No stream has been opened yet.',
            recommendation: 'Select a Live TV channel, movie, or episode to start diagnostics.'
        };
    }
    var now = Date.now();
    var elapsedMs = Math.max(0, now - entry.startTs);
    var cutoff = now - 2500;
    while (entry.samples.length > 0 && entry.samples[0].ts < cutoff) {
        entry.samples.shift();
    }
    if (entry.samples.length === 0) {
        entry.kbps = 0;
    }

    var code = Number(entry.httpStatus || 0);
    if (code >= 400 || entry.errorText) {
        var codeReason = 'Upstream server returned HTTP ' + code;
        if (code === 401 || code === 403) {
            codeReason += ' (Unauthorized / Token Expired / IP Locked)';
        } else if (code === 404) {
            codeReason += ' (Channel Offline / Stream Not Found on Provider)';
        } else if (code === 458 || code === 429) {
            codeReason += ' (Provider Connection Limit Reached — max_connections)';
        } else if (code >= 500) {
            codeReason += ' (Provider Upstream Server Error / Offline Event Feed)';
        } else if (entry.errorText) {
            codeReason = 'Upstream connection error: ' + entry.errorText;
        }
        return {
            status: 'provider_error',
            source: 'provider',
            label: 'PROVIDER OFFLINE / ERROR',
            summary: codeReason,
            reason: codeReason,
            recommendation: 'This error comes directly from your IPTV provider server, not the player.'
        };
    }

    if (entry.totalBytes === 0 && elapsedMs >= 3000) {
        var idleReason = 'Connected to provider (' + (code ? 'HTTP ' + code : 'waiting') + '), but 0 bytes received after ' + (elapsedMs / 1000).toFixed(1) + 's. Event/VIP channel is likely off-air.';
        return {
            status: 'provider_error',
            source: 'provider',
            label: 'PROVIDER IDLE (0 KB/s)',
            summary: idleReason,
            reason: idleReason,
            recommendation: 'Channel has no active broadcast feed on the provider right now.'
        };
    }

    if (elapsedMs >= 3500 && entry.kbps > 0 && entry.kbps < 350) {
        var slowReason = 'Upstream provider is sending data at only ' + Math.round(entry.kbps / 8) + ' KB/s (' + entry.kbps + ' kbps), which is too slow for smooth HD/4K playback.';
        return {
            status: 'provider_slow',
            source: 'provider',
            label: 'PROVIDER CONGESTION (' + Math.round(entry.kbps / 8) + ' KB/s)',
            summary: slowReason,
            reason: slowReason,
            recommendation: 'Buffering is caused by slow upstream throughput from the IPTV provider server.'
        };
    }

    var healthyReason = 'Receiving ' + Math.round(entry.kbps / 8) + ' KB/s (' + (entry.kbps / 1000).toFixed(1) + ' Mbps)' + (entry.ttfbMs ? ' • TTFB ' + entry.ttfbMs + 'ms' : '') + '.';
    return {
        status: 'healthy',
        source: 'healthy',
        label: 'STREAM HEALTHY',
        summary: healthyReason,
        reason: healthyReason,
        recommendation: 'Upstream provider connection and player pipeline are operating normally.'
    };
}

if (http.globalAgent) {
    http.globalAgent.maxSockets = 64;
}
if (https.globalAgent) {
    https.globalAgent.maxSockets = 64;
}

// Persistent Keep-Alive agents with high socket concurrency so 4K streams never block API requests
var httpAgent = new http.Agent({ keepAlive: true, keepAliveMsecs: 3000, maxSockets: 64, maxFreeSockets: 8 });
var httpsAgent = new https.Agent({ keepAlive: true, keepAliveMsecs: 3000, maxSockets: 64, maxFreeSockets: 8, rejectUnauthorized: false });

function allocBufferUtf8(str) {
    var text = String(str || '');
    if (typeof Buffer.from === 'function') {
        return Buffer.from(text, 'utf8');
    }
    return new Buffer(text, 'utf8');
}

function safeDecodeURIComponent(str) {
    if (!str) {
        return '';
    }
    try {
        return decodeURIComponent(String(str));
    } catch (e) {
        return String(str);
    }
}

function extendHeaders(baseObj, extraObj) {
    var out = {};
    var k;
    if (baseObj) {
        for (k in baseObj) {
            if (Object.prototype.hasOwnProperty.call(baseObj, k)) {
                out[k] = baseObj[k];
            }
        }
    }
    if (extraObj) {
        for (k in extraObj) {
            if (Object.prototype.hasOwnProperty.call(extraObj, k)) {
                out[k] = extraObj[k];
            }
        }
    }
    return out;
}

function getCookieScopeKey(hostname, mac) {
    var cleanMac = String(mac || lastActiveMac || '').trim().toUpperCase();
    return cleanMac ? (hostname + '|' + cleanMac) : hostname;
}

function storeSetCookies(hostname, setCookieHeaders, mac) {
    if (!hostname || !setCookieHeaders) {
        return;
    }
    var scopeKey = getCookieScopeKey(hostname, mac);
    if (!cookieJar[scopeKey]) {
        cookieJar[scopeKey] = {};
    }
    var list = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
    for (var i = 0; i < list.length; i++) {
        var raw = String(list[i] || '');
        var firstPart = raw.split(';')[0] || '';
        var eqIdx = firstPart.indexOf('=');
        if (eqIdx > 0) {
            var name = firstPart.substring(0, eqIdx).trim();
            var val = firstPart.substring(eqIdx + 1).trim();
            if (name) {
                cookieJar[scopeKey][name] = val;
            }
        }
    }
}

function getHostCookieHeader(hostname, baseCookie, mac) {
    var scopeKey = getCookieScopeKey(hostname, mac);
    var jarCookies = cookieJar[scopeKey] || {};
    var pairs = [];
    if (baseCookie) {
        pairs.push(baseCookie);
    }
    var keys = Object.keys(jarCookies);
    for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (!baseCookie || baseCookie.indexOf(k + '=') === -1) {
            pairs.push(k + '=' + jarCookies[k]);
        }
    }
    return pairs.join('; ');
}

function decodeBufferByEncoding(rawBuf, encoding, callback) {
    var enc = String(encoding || '').toLowerCase();
    if (enc.indexOf('gzip') !== -1) {
        zlib.gunzip(rawBuf, function(err, decoded) {
            callback(err ? rawBuf : decoded);
        });
    } else if (enc.indexOf('deflate') !== -1) {
        zlib.inflate(rawBuf, function(err, decoded) {
            if (!err && decoded) {
                callback(decoded);
            } else {
                zlib.inflateRaw(rawBuf, function(err2, decoded2) {
                    callback(err2 ? rawBuf : decoded2);
                });
            }
        });
    } else {
        callback(rawBuf);
    }
}

function normalizePortalKey(rawPortal, mac) {
    var baseKey = (rawPortal || '').trim().replace(/\/+$/, '').toLowerCase();
    var cleanMac = String(mac || '').trim().toUpperCase();
    return cleanMac ? (baseKey + '|' + cleanMac) : baseKey;
}

function getCandidateUrls(rawPortal, search, mac) {
    var clean = (rawPortal || '').trim().replace(/\/+$/, '');
    if (clean.indexOf('http://') !== 0 && clean.indexOf('https://') !== 0) {
        clean = 'http://' + clean;
    }
    var qs = search || '';
    if (qs && qs.charAt(0) !== '?') {
        qs = '?' + qs.replace(/^\/+/, '');
    }
    var portalKey = normalizePortalKey(rawPortal, mac);
    var list = [];
    if (clean.indexOf('.php') !== -1) {
        list.push(clean + qs);
        return list;
    }
    var base = clean
        .replace(/\/stalker_portal\/c$/i, '')
        .replace(/\/stalker_portal$/i, '')
        .replace(/\/c$/i, '');
    var defaults = [
        base + '/portal.php',
        base + '/stalker_portal/server/load.php',
        base + '/server/load.php'
    ];
    var cachedBaseEndpoint = endpointCache[portalKey];
    if (cachedBaseEndpoint) {
        list.push(cachedBaseEndpoint + qs);
        if (qs.indexOf('action=handshake') === -1) {
            return list;
        }
    }
    for (var i = 0; i < defaults.length; i++) {
        if (defaults[i] !== cachedBaseEndpoint) {
            list.push(defaults[i] + qs);
        }
    }
    return list;
}

function extractBaseEndpoint(candidateUrl) {
    var qIdx = candidateUrl.indexOf('?');
    if (qIdx !== -1) {
        return candidateUrl.slice(0, qIdx);
    }
    return candidateUrl;
}

function getReferer(rawPortal) {
    var clean = (rawPortal || '').trim().replace(/\/+$/, '');
    if (clean.indexOf('http://') !== 0 && clean.indexOf('https://') !== 0) {
        clean = 'http://' + clean;
    }
    var base = clean.replace(/\/(portal|load)\.php.*$/i, '').replace(/\/server$/i, '');
    if (base.slice(-2) !== '/c') {
        base += '/c/';
    } else {
        base += '/';
    }
    return base;
}

function requestWithFallback(reqState, callback) {
    var portalKey = reqState.portalKey;
    var mac = reqState.mac || '';
    var candidates = reqState.candidates;
    var idx = reqState.idx || 0;
    var headers = reqState.headers;
    var redirectsLeft = typeof reqState.redirectsLeft === 'number' ? reqState.redirectsLeft : 3;
    var useFreshSocket = Boolean(reqState.useFreshSocket);

    if (idx >= candidates.length) {
        callback(new Error('All portal endpoints returned empty/invalid JSON'));
        return;
    }
    var currentUrl = candidates[idx];
    var target = url.parse(currentUrl);
    var isHttps = target.protocol === 'https:';
    var client = isHttps ? https : http;
    var mergedCookie = getHostCookieHeader(target.hostname, headers.Cookie || '', mac);
    var reqHeaders = extendHeaders(headers, {
        Host: target.host,
        Cookie: mergedCookie,
        Connection: useFreshSocket ? 'close' : 'keep-alive'
    });
    var isCatalogQuery = currentUrl.indexOf('get_all_channels') !== -1 ||
                         currentUrl.indexOf('get_genres') !== -1 ||
                         currentUrl.indexOf('get_categories') !== -1;
    var options = {
        hostname: target.hostname,
        port: target.port || (isHttps ? 443 : 80),
        path: target.path,
        method: 'GET',
        headers: reqHeaders,
        agent: useFreshSocket ? false : (isHttps ? httpsAgent : httpAgent),
        rejectUnauthorized: false,
        timeout: isCatalogQuery ? 35000 : 12000
    };
    var settled = false;
    function retryOrNextCandidate() {
        if (settled || reqState.aborted) {
            return;
        }
        settled = true;
        if (!useFreshSocket) {
            requestWithFallback({
                portalKey: portalKey,
                mac: mac,
                candidates: candidates,
                idx: idx,
                headers: headers,
                redirectsLeft: redirectsLeft,
                useFreshSocket: true,
                aborted: reqState.aborted,
                onAbort: reqState.onAbort
            }, callback);
            return;
        }
        requestWithFallback({
            portalKey: portalKey,
            mac: mac,
            candidates: candidates,
            idx: idx + 1,
            headers: headers,
            redirectsLeft: 3,
            useFreshSocket: false,
            aborted: reqState.aborted,
            onAbort: reqState.onAbort
        }, callback);
    }
    var proxyReq = client.request(options, function(proxyRes) {
        storeSetCookies(target.hostname, proxyRes.headers['set-cookie'], mac);
        var status = proxyRes.statusCode;
        if ((status === 301 || status === 302 || status === 303 || status === 307 || status === 308) &&
            proxyRes.headers.location && redirectsLeft > 0) {
            if (settled) {
                return;
            }
            settled = true;
            proxyRes.resume();
            var nextUrl = url.resolve(currentUrl, proxyRes.headers.location);
            var redirectedList = candidates.slice();
            redirectedList[idx] = nextUrl;
            requestWithFallback({
                portalKey: portalKey,
                mac: mac,
                candidates: redirectedList,
                idx: idx,
                headers: headers,
                redirectsLeft: redirectsLeft - 1,
                useFreshSocket: useFreshSocket,
                aborted: reqState.aborted,
                onAbort: reqState.onAbort
            }, callback);
            return;
        }
        var chunks = [];
        var totalLen = 0;
        proxyRes.on('data', function(chunk) {
            var bufChunk = Buffer.isBuffer(chunk) ? chunk : allocBufferUtf8(chunk);
            totalLen += bufChunk.length;
            if (totalLen <= 67108864) {
                chunks.push(bufChunk);
            }
        });
        proxyRes.on('end', function() {
            if (settled || reqState.aborted) {
                chunks = [];
                return;
            }
            var rawBuf = Buffer.concat(chunks);
            chunks = [];
            decodeBufferByEncoding(rawBuf, proxyRes.headers['content-encoding'], function(decodedBuf) {
                rawBuf = null;
                if (settled || reqState.aborted) {
                    return;
                }
                var finalBuf = decodedBuf || allocBufferUtf8('');
                var isEpgOrWatchdog = currentUrl.indexOf('get_short_epg') !== -1 ||
                                      currentUrl.indexOf('get_epg_info') !== -1 ||
                                      currentUrl.indexOf('type=watchdog') !== -1;
                if (status >= 200 && status < 300 && finalBuf.length > 0) {
                    if (finalBuf.length > 65536) {
                        var headStr = finalBuf.slice(0, 512).toString('utf8').trim();
                        if (/authorization\s+failed/i.test(headStr)) {
                            settled = true;
                            callback(null, JSON.stringify({ error: 'AUTH_FAILED', message: 'Authorization failed' }));
                            return;
                        }
                        var firstCh = headStr.charAt(0);
                        if (firstCh === '{' || firstCh === '[') {
                            settled = true;
                            if (portalKey) {
                                endpointCache[portalKey] = extractBaseEndpoint(currentUrl);
                            }
                            callback(null, finalBuf);
                            return;
                        }
                    } else {
                        var trimmed = finalBuf.toString('utf8').trim();
                        if (trimmed.length > 0) {
                            if (/authorization\s+failed/i.test(trimmed)) {
                                settled = true;
                                callback(null, JSON.stringify({ error: 'AUTH_FAILED', message: 'Authorization failed' }));
                                return;
                            }
                            try {
                                JSON.parse(trimmed);
                                settled = true;
                                if (portalKey) {
                                    endpointCache[portalKey] = extractBaseEndpoint(currentUrl);
                                }
                                callback(null, finalBuf);
                                return;
                            } catch (ex) {}
                        }
                    }
                }
                if (isEpgOrWatchdog) {
                    settled = true;
                    callback(null, JSON.stringify({ js: [] }));
                    return;
                }
                retryOrNextCandidate();
            });
        });
    });
    if (typeof reqState.onAbort === 'function') {
        reqState.onAbort(function() {
            reqState.aborted = true;
            settled = true;
            try {
                proxyReq.abort();
            } catch (eAb) {}
        });
    }
    proxyReq.on('error', function() {
        retryOrNextCandidate();
    });
    proxyReq.on('timeout', function() {
        proxyReq.abort();
        retryOrNextCandidate();
    });
    proxyReq.end();
}

function rewriteManifestTagUri(line, baseStreamUrl) {
    var proxyBase = 'http://127.0.0.1:' + activeListenPort + '/stream?url=';
    return line.replace(/URI="([^"]+)"/gi, function(match, uriVal) {
        var absUri = url.resolve(baseStreamUrl, uriVal);
        return 'URI="' + proxyBase + encodeURIComponent(absUri) + '"';
    });
}

function rewriteM3u8Manifest(manifestText, baseStreamUrl) {
    var proxyBase = 'http://127.0.0.1:' + activeListenPort + '/stream?url=';
    var lines = String(manifestText || '').split(/\r?\n/);
    var out = [];
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        var trimmed = line.trim();
        if (!trimmed) {
            out.push(line);
            continue;
        }
        if (trimmed.charAt(0) === '#') {
            out.push(rewriteManifestTagUri(line, baseStreamUrl));
            continue;
        }
        var absSegmentUrl = url.resolve(baseStreamUrl, trimmed);
        out.push(proxyBase + encodeURIComponent(absSegmentUrl));
    }
    return out.join('\n');
}

function proxyVideoStream(streamUrl, clientReq, clientRes, redirectsLeft) {
    if (redirectsLeft <= 0) {
        clientRes.writeHead(502);
        clientRes.end();
        return;
    }
    var streamKey = getStreamKey(streamUrl);
    var reqStartTs = Date.now();
    recordStreamTelemetry(streamKey, streamUrl, { code: 0 });
    var target = url.parse(streamUrl);
    if (!target.hostname) {
        clientRes.writeHead(400);
        clientRes.end('Invalid stream URL');
        return;
    }
    var isHttps = target.protocol === 'https:';
    var client = isHttps ? https : http;
    var mergedCookie = getHostCookieHeader(target.hostname, '');
    var headers = {
        'User-Agent': MAG_UA,
        'Accept': '*/*',
        'Connection': 'keep-alive',
        'Host': target.host
    };
    if (mergedCookie) {
        headers.Cookie = mergedCookie;
    }
    if (lastPortalReferer) {
        headers.Referer = lastPortalReferer;
    }
    if (clientReq.headers.range) {
        headers.Range = clientReq.headers.range;
    }
    var isSegmentOrSubRequest = /\.ts(\?|$)|\.m4s(\?|$)|\.aac(\?|$)|\.vtt(\?|$)/i.test(target.path || '');
    if (!isSegmentOrSubRequest && activeVideoUpReq) {
        try {
            activeVideoUpReq.abort();
        } catch (eAbort) {}
        activeVideoUpReq = null;
    }
    var upReq = client.request({
        hostname: target.hostname,
        port: target.port || (isHttps ? 443 : 80),
        path: target.path,
        method: 'GET',
        headers: headers,
        rejectUnauthorized: false
    }, function(upRes) {
        var ttfb = Date.now() - reqStartTs;
        recordStreamTelemetry(streamKey, streamUrl, { code: upRes.statusCode, ttfb: ttfb });
        if (!isSegmentOrSubRequest) {
            activeVideoUpReq = upReq;
        }
        storeSetCookies(target.hostname, upRes.headers['set-cookie']);
        if ([301, 302, 303, 307, 308].indexOf(upRes.statusCode) !== -1 && upRes.headers.location) {
            upRes.resume();
            proxyVideoStream(url.resolve(streamUrl, upRes.headers.location), clientReq, clientRes, redirectsLeft - 1);
            return;
        }
        var contentType = String(upRes.headers['content-type'] || '').toLowerCase();
        var isM3u8 = contentType.indexOf('mpegurl') !== -1 ||
                     contentType.indexOf('m3u') !== -1 ||
                     /\.m3u8(\?|$)/i.test(target.path || '');

        if (isM3u8 && (upRes.statusCode === 200 || upRes.statusCode === 206)) {
            var m3u8Chunks = [];
            upRes.on('data', function(chunk) {
                var cBuf = Buffer.isBuffer(chunk) ? chunk : allocBufferUtf8(chunk);
                recordStreamTelemetry(streamKey, streamUrl, { chunkLen: cBuf.length });
                m3u8Chunks.push(cBuf);
            });
            upRes.on('end', function() {
                var rawBuf = Buffer.concat(m3u8Chunks);
                decodeBufferByEncoding(rawBuf, upRes.headers['content-encoding'], function(decodedBuf) {
                    var rawText = (decodedBuf || rawBuf).toString('utf8');
                    if (rawText.indexOf('#EXTM3U') !== -1) {
                        var rewritten = rewriteM3u8Manifest(rawText, streamUrl);
                        var outBuf = allocBufferUtf8(rewritten);
                        clientRes.writeHead(200, {
                            'Access-Control-Allow-Origin': '*',
                            'Content-Type': 'application/vnd.apple.mpegurl',
                            'Content-Length': outBuf.length,
                            'Cache-Control': 'no-cache'
                        });
                        clientRes.end(outBuf);
                    } else {
                        clientRes.writeHead(upRes.statusCode || 200, {
                            'Access-Control-Allow-Origin': '*',
                            'Content-Type': upRes.headers['content-type'] || 'video/mp2t'
                        });
                        clientRes.end(decodedBuf || rawBuf);
                    }
                });
            });
            return;
        }

        var resHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': upRes.headers['content-type'] || 'video/mp2t'
        };
        if (upRes.headers['content-length']) {
            resHeaders['Content-Length'] = upRes.headers['content-length'];
        }
        if (upRes.headers['content-range']) {
            resHeaders['Content-Range'] = upRes.headers['content-range'];
        }
        if (upRes.headers['accept-ranges']) {
            resHeaders['Accept-Ranges'] = upRes.headers['accept-ranges'];
        }

        clientRes.writeHead(upRes.statusCode || 200, resHeaders);
        upRes.on('data', function(chunk) {
            recordStreamTelemetry(streamKey, streamUrl, { chunkLen: chunk.length });
        });
        upRes.pipe(clientRes);
    });
    upReq.on('error', function(e) {
        recordStreamTelemetry(streamKey, streamUrl, { err: e });
        if (!clientRes.headersSent) {
            clientRes.writeHead(502);
        }
        clientRes.end();
    });
    clientReq.on('close', function() {
        upReq.abort();
    });
    upReq.end();
}

function startProxyServer(port) {
    if (server) {
        return server;
    }
    var listenPort = (typeof port === 'number') ? port : PROXY_PORT;
    server = http.createServer(function(req, res) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }
        if (req.url === '/health' || req.url === '/ping' || req.headers['x-stalker-ping'] === '1') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', port: activeListenPort, cachedPortals: Object.keys(endpointCache).length }));
            return;
        }
        var parsedUrl = url.parse(req.url, true);
        if (parsedUrl.pathname === '/backup') {
            if (req.method === 'POST') {
                var bodyParts = [];
                req.on('data', function(c) {
                    bodyParts.push(Buffer.isBuffer(c) ? c : allocBufferUtf8(c));
                });
                req.on('end', function() {
                    memoryBackupJson = Buffer.concat(bodyParts).toString('utf8');
                    try {
                        fs.writeFile(BACKUP_FILE_PATH, memoryBackupJson, 'utf8', function() {});
                    } catch (exWrite) {}
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'saved' }));
                });
                return;
            }
            if (req.method === 'GET') {
                if (memoryBackupJson) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(memoryBackupJson);
                    return;
                }
                fs.readFile(BACKUP_FILE_PATH, 'utf8', function(readErr, diskData) {
                    if (!readErr && diskData) {
                        memoryBackupJson = diskData;
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(diskData);
                    } else {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'No backup stored' }));
                    }
                });
                return;
            }
        }
        if (parsedUrl.pathname === '/catalog-cache') {
            var profKey = String((parsedUrl.query && parsedUrl.query.profile) || 'default').replace(/[^a-zA-Z0-9_-]/g, '');
            var cacheFilePath = '/tmp/smartstb_catalog_' + profKey + '.json';
            if (parsedUrl.query && parsedUrl.query.action === 'delete') {
                var delMac = String(parsedUrl.query.mac || '').trim().toUpperCase();
                if (delMac) {
                    var ckKeys = Object.keys(cookieJar);
                    for (var cki = 0; cki < ckKeys.length; cki++) {
                        if (ckKeys[cki].indexOf('|' + delMac) !== -1) {
                            delete cookieJar[ckKeys[cki]];
                        }
                    }
                    var epKeys = Object.keys(endpointCache);
                    for (var epi = 0; epi < epKeys.length; epi++) {
                        if (epKeys[epi].indexOf('|' + delMac) !== -1) {
                            delete endpointCache[epKeys[epi]];
                        }
                    }
                }
                fs.unlink(cacheFilePath, function() {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'deleted', profile: profKey }));
                });
                return;
            }
            if (req.method === 'POST') {
                var catParts = [];
                var totalBytes = 0;
                var tooLarge = false;
                req.on('data', function(c) {
                    var buf = Buffer.isBuffer(c) ? c : allocBufferUtf8(c);
                    totalBytes += buf.length;
                    if (totalBytes > 12582912) {
                        tooLarge = true;
                        catParts = [];
                        return;
                    }
                    catParts.push(buf);
                });
                req.on('end', function() {
                    if (tooLarge) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ status: 'skipped_large_catalog', bytes: totalBytes }));
                        return;
                    }
                    var rawBuffer = Buffer.concat(catParts);
                    catParts = [];
                    try {
                        fs.writeFile(cacheFilePath, rawBuffer, function() {});
                    } catch (eDisk) {}
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'cached', bytes: rawBuffer.length }));
                });
                return;
            }
            if (req.method === 'GET') {
                fs.readFile(cacheFilePath, function(readErr, rawBuf) {
                    if (readErr || !rawBuf || rawBuf.length === 0) {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'No catalog cache' }));
                        return;
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(rawBuf);
                });
                return;
            }
        }
        if (parsedUrl.pathname === '/stream' && parsedUrl.query && parsedUrl.query.url) {
            proxyVideoStream(parsedUrl.query.url, req, res, 5);
            return;
        }

        if (parsedUrl.pathname === '/stream-diag') {
            var hasQueryUrl = Boolean(parsedUrl.query && parsedUrl.query.url);
            var diagKey = hasQueryUrl ? getStreamKey(parsedUrl.query.url) : latestStreamTelemetryKey;
            var tEntry = diagKey ? (streamTelemetryMap[diagKey] || null) : null;
            var diagVerdict = computeStreamDiagnosticVerdict(tEntry);
            var payload = {
                url: tEntry ? tEntry.url : ((parsedUrl.query && parsedUrl.query.url) || ''),
                httpStatus: tEntry ? tEntry.httpStatus : 0,
                ttfbMs: tEntry ? tEntry.ttfbMs : null,
                elapsedMs: tEntry ? Math.max(0, Date.now() - tEntry.startTs) : 0,
                totalBytes: tEntry ? tEntry.totalBytes : 0,
                kbps: tEntry ? tEntry.kbps : 0,
                kBps: tEntry ? Math.round(tEntry.kbps / 8) : 0,
                videoCodec: tEntry ? tEntry.videoCodec : '',
                audioCodec: tEntry ? tEntry.audioCodec : '',
                isTranscoding: false,
                vTranscode: false,
                hasFfmpeg: false,
                active: tEntry ? tEntry.active : false,
                verdict: diagVerdict
            };
            res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
            res.end(JSON.stringify(payload));
            return;
        }

        if (parsedUrl.pathname === '/lan-info') {
            var detectedIp = getLocalLanIp();
            var setupEndpoint = 'http://' + detectedIp + ':' + activeListenPort + '/setup';
            res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
            res.end(JSON.stringify({ ip: detectedIp, port: activeListenPort, url: setupEndpoint, setupUrl: setupEndpoint }));
            return;
        }

        if (parsedUrl.pathname === '/setup' && req.method === 'GET') {
            var hostHdr = req.headers.host || (getLocalLanIp() + ':' + activeListenPort);
            var htmlBody = buildRemoteSetupHtml('http://' + hostHdr + '/setup');
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
            res.end(htmlBody);
            return;
        }

        if (parsedUrl.pathname === '/remote-setup') {
            if (req.method === 'POST') {
                var rsParts = [];
                req.on('data', function(chunk) {
                    rsParts.push(chunk);
                });
                req.on('end', function() {
                    try {
                        var bodyText = Buffer.concat(rsParts).toString('utf8');
                        var parsedCfg = JSON.parse(bodyText || '{}');
                        pendingRemoteSetup = {
                            ts: Date.now(),
                            profile: parsedCfg
                        };
                        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
                        res.end(JSON.stringify({ ok: true, ts: pendingRemoteSetup.ts }));
                    } catch (eParse) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
                    }
                });
                return;
            }
            if (req.method === 'GET') {
                var outSetup = pendingRemoteSetup;
                if (parsedUrl.query && parsedUrl.query.consume === '1') {
                    pendingRemoteSetup = null;
                }
                res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
                res.end(JSON.stringify({ pending: outSetup }));
                return;
            }
        }

        if ((parsedUrl.pathname === '/xtream' || parsedUrl.pathname === '/m3u' || parsedUrl.pathname === '/xmltv') && ((parsedUrl.query && parsedUrl.query.url) || req.headers['x-target-url'])) {
            var rawTargetUrl = String((parsedUrl.query && parsedUrl.query.url) || req.headers['x-target-url'] || '').trim();
            var isTextRoute = (parsedUrl.pathname === '/m3u' || parsedUrl.pathname === '/xmltv');
            (function fetchRemoteWithRedirects(targetUrlStr, redirectsLeft) {
                if (redirectsLeft <= 0) {
                    res.writeHead(502, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Too many redirects' }));
                    return;
                }
                var parsedTarget = url.parse(targetUrlStr);
                if (!parsedTarget.hostname) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid target URL' }));
                    return;
                }
                var isHttpsTarget = parsedTarget.protocol === 'https:';
                var hClient = isHttpsTarget ? https : http;
                var rReq = hClient.request({
                    hostname: parsedTarget.hostname,
                    port: parsedTarget.port || (isHttpsTarget ? 443 : 80),
                    path: parsedTarget.path,
                    method: 'GET',
                    headers: {
                        'User-Agent': MAG_UA,
                        'Accept': '*/*',
                        'Accept-Encoding': 'gzip, deflate',
                        'Host': parsedTarget.host
                    },
                    agent: isHttpsTarget ? httpsAgent : httpAgent,
                    timeout: 35000,
                    rejectUnauthorized: false
                }, function(rRes) {
                    if ([301, 302, 303, 307, 308].indexOf(rRes.statusCode) !== -1 && rRes.headers.location) {
                        rRes.resume();
                        fetchRemoteWithRedirects(url.resolve(targetUrlStr, rRes.headers.location), redirectsLeft - 1);
                        return;
                    }
                    var stream = rRes;
                    var enc = String(rRes.headers['content-encoding'] || '').toLowerCase();
                    if (enc === 'gzip') {
                        stream = rRes.pipe(zlib.createGunzip());
                    } else if (enc === 'deflate') {
                        stream = rRes.pipe(zlib.createInflate());
                    }
                    var rChunks = [];
                    var totalLen = 0;
                    stream.on('data', function(c) {
                        totalLen += c.length;
                        if (totalLen <= 67108864) {
                            rChunks.push(c);
                        }
                    });
                    stream.on('end', function() {
                        var bodyBuf = Buffer.concat(rChunks);
                        rChunks = [];
                        if (bodyBuf.length >= 2 && bodyBuf[0] === 0x1f && bodyBuf[1] === 0x8b) {
                            zlib.gunzip(bodyBuf, function(gzErr, unzippedBuf) {
                                var finalBuf = (!gzErr && unzippedBuf) ? unzippedBuf : bodyBuf;
                                bodyBuf = null;
                                res.writeHead(rRes.statusCode || 200, {
                                    'Content-Type': isTextRoute ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
                                    'Cache-Control': 'no-store'
                                });
                                res.end(finalBuf);
                            });
                            return;
                        }
                        res.writeHead(rRes.statusCode || 200, {
                            'Content-Type': isTextRoute ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
                            'Cache-Control': 'no-store'
                        });
                        res.end(bodyBuf);
                    });
                    stream.on('error', function(zErr) {
                        rChunks = [];
                        res.writeHead(502, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: zErr.message }));
                    });
                });
                req.on('close', function() {
                    try {
                        rReq.abort();
                    } catch (eClose) {}
                });
                rReq.on('error', function(eReq) {
                    res.writeHead(502, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: eReq.message }));
                });
                rReq.on('timeout', function() {
                    rReq.abort();
                    res.writeHead(504, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Upstream timeout' }));
                });
                rReq.end();
            })(rawTargetUrl, 5);
            return;
        }

        var rawPortal = req.headers['x-stalker-portal'];
        var rawMac = req.headers['x-stalker-mac'];
        var rawToken = req.headers['x-stalker-token'];
        var rawTz = req.headers['x-stalker-tz'] || 'UTC';
        var targetSearch = req.headers['x-stalker-search'] || req.url;
        if (!rawPortal || !rawMac) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing x-stalker-portal or x-stalker-mac header' }));
            return;
        }
        var mac = safeDecodeURIComponent(rawMac).trim();
        var portal = safeDecodeURIComponent(rawPortal).trim();
        var tz = safeDecodeURIComponent(rawTz).trim() || 'UTC';
        var portalKey = normalizePortalKey(portal, mac);
        var refererUrl = getReferer(portal);
        lastPortalReferer = refererUrl;
        lastActiveMac = mac;
        var headers = {
            'User-Agent': MAG_UA,
            'X-User-Agent': 'Model: MAG250; Link: WiFi',
            'Accept': '*/*',
            'Accept-Encoding': 'gzip, deflate',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cookie': 'mac=' + encodeURIComponent(mac) + '; stb_lang=en; timezone=' + encodeURIComponent(tz),
            'Referer': refererUrl
        };
        if (rawToken) {
            headers.Authorization = 'Bearer ' + safeDecodeURIComponent(rawToken).trim();
        }
        var candidates = getCandidateUrls(portal, targetSearch, mac);
        var activeAbortFn = null;
        var reqStateObj = {
            portalKey: portalKey,
            mac: mac,
            candidates: candidates,
            idx: 0,
            headers: headers,
            redirectsLeft: 3,
            useFreshSocket: false,
            aborted: false,
            onAbort: function(fn) {
                activeAbortFn = fn;
            }
        };
        req.on('close', function() {
            reqStateObj.aborted = true;
            if (typeof activeAbortFn === 'function') {
                activeAbortFn();
            }
        });
        requestWithFallback(reqStateObj, function(err, result) {
            if (reqStateObj.aborted) {
                return;
            }
            if (err) {
                res.writeHead(502, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
                return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(result);
        });
    });
    server.on('error', function(err) {
        if (err && err.code === 'EADDRINUSE' && listenPort === PROXY_PORT) {
            server = null;
            startProxyServer(FALLBACK_PORT);
        }
    });
    server.listen(listenPort, '0.0.0.0', function() {
        activeListenPort = listenPort;
        console.log('Stalker proxy listening on http://127.0.0.1:' + listenPort);
    });
    return server;
}

function stopProxyServer(cb) {
    if (!server) {
        if (cb) {
            cb();
        }
        return;
    }
    var s = server;
    server = null;
    if (typeof s.closeAllConnections === 'function') {
        s.closeAllConnections();
    }
    s.close(function() {
        if (cb) {
            cb();
        }
    });
}

module.exports = {
    startProxyServer: startProxyServer,
    stopProxyServer: stopProxyServer,
    onStart: function() {
        startProxyServer(PROXY_PORT);
    },
    onRequest: function() {
        startProxyServer(PROXY_PORT);
    },
    onStop: function() {
        stopProxyServer();
    },
    onExit: function() {
        stopProxyServer();
    }
};
