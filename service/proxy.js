/* jshint node: true, undef: true, unused: true, strict: true, esversion: 5 */
/* global Buffer */
'use strict';

var http = require('http');
var https = require('https');
var url = require('url');
var fs = require('fs');
var path = require('path');
var zlib = require('zlib');
var os = require('os');
var dns = require('dns');
var net = require('net');
var crypto = require('crypto');

function ensureDirSyncSafe(dirPath) {
    if (!dirPath) {
        return false;
    }
    try {
        if (fs.existsSync(dirPath)) {
            return fs.statSync(dirPath).isDirectory();
        }
    } catch (eEx) {}
    var parent = path.dirname(dirPath);
    if (parent && parent !== dirPath) {
        ensureDirSyncSafe(parent);
    }
    try {
        fs.mkdirSync(dirPath);
        return true;
    } catch (eMk) {
        try {
            return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
        } catch (eStat) {
            return false;
        }
    }
}

function isDirWritableSafe(dirPath) {
    if (!ensureDirSyncSafe(dirPath)) {
        return false;
    }
    var probeFile = path.join(dirPath, '.vortix_probe_' + process.pid);
    try {
        fs.writeFileSync(probeFile, 'ok', 'utf8');
        fs.unlinkSync(probeFile);
        return true;
    } catch (eProbe) {
        return false;
    }
}

function resolvePersistentDataDir() {
    var candidates = [];
    if (process && process.env && process.env.VORTIX_DATA_DIR) {
        candidates.push(String(process.env.VORTIX_DATA_DIR));
    }
    if (typeof __dirname === 'string' && __dirname) {
        candidates.push(path.resolve(__dirname, '..', '..', 'shared', 'data'));
        candidates.push(path.resolve(__dirname, '..', 'data'));
    }
    if (process && process.env && process.env.HOME) {
        candidates.push(path.join(String(process.env.HOME), '.vortixtv'));
    }
    var tmpBase = (os && typeof os.tmpdir === 'function') ? os.tmpdir() : '/tmp';
    candidates.push(path.join(tmpBase, 'vortixtv_data'));
    for (var i = 0; i < candidates.length; i++) {
        if (candidates[i] && isDirWritableSafe(candidates[i])) {
            return candidates[i];
        }
    }
    return tmpBase;
}

var DATA_DIR = resolvePersistentDataDir();
var CATALOG_CACHE_DIR = path.join(DATA_DIR, 'catalog');
var DVR_DIR = path.join(DATA_DIR, 'recordings');
ensureDirSyncSafe(CATALOG_CACHE_DIR);
ensureDirSyncSafe(DVR_DIR);

var server = null;
var PROXY_PORT = 3001;
var FALLBACK_PORT = 3000;
var activeListenPort = PROXY_PORT;
var BACKUP_FILE_PATH = path.join(DATA_DIR, 'vortixtv_backup.json');
var FAVORITES_M3U_PATH = path.join(DATA_DIR, 'vortixtv_favorites.m3u');
var endpointCache = {};
var cookieJar = {};
var lastPortalReferer = '';
var lastActiveMac = '';
var memoryBackupJson = '';
var memoryFavoritesM3u = '';
var memoryFavoritesCount = 0;
var memoryFavoritesUpdatedAt = 0;
var activeVideoUpReq = null;
var activeVideoStreamKey = '';
var pendingRemoteSetup = null;
var pendingRemoteRestoreJson = null;
var pendingRemoteM3uContent = '';
var MAG_UA = 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3';
var VLC_UA = 'VLC/3.0.20 LibVLC/3.0.20';
var streamTelemetryMap = {};
var streamTelemetryKeys = [];
var latestStreamTelemetryKey = '';
var activeRecordingSession = null;

try {
    if (fs.existsSync(BACKUP_FILE_PATH)) {
        memoryBackupJson = fs.readFileSync(BACKUP_FILE_PATH, 'utf8') || '';
    }
} catch (eInitBk) {}
try {
    if (fs.existsSync(FAVORITES_M3U_PATH)) {
        memoryFavoritesM3u = fs.readFileSync(FAVORITES_M3U_PATH, 'utf8') || '';
        if (memoryFavoritesM3u) {
            var favLinesInit = memoryFavoritesM3u.split('#EXTINF:').length - 1;
            memoryFavoritesCount = Math.max(0, favLinesInit);
            memoryFavoritesUpdatedAt = fs.statSync(FAVORITES_M3U_PATH).mtime.getTime();
        }
    }
} catch (eInitFav) {}

// =========================================================================
// v2.1.0: 4-Digit Cryptographic Pairing PIN & Brute-Force Rate Limiter
// =========================================================================
function generateSecure4DigitPin() {
    try {
        if (crypto && typeof crypto.randomBytes === 'function') {
            var buf = crypto.randomBytes(2);
            var num = ((buf[0] << 8) | buf[1]) % 10000;
            return ('0000' + String(num)).slice(-4);
        }
    } catch (ePin) {}
    return ('0000' + String(Math.floor(Math.random() * 10000))).slice(-4);
}

var currentPairingPin = generateSecure4DigitPin();
var globalPinFailures = 0;
var ipPinRateLimitMap = {};

function verifyLanPairingPin(clientIp, submittedPin) {
    var now = Date.now();
    var ipKey = String(clientIp || 'unknown');
    var rec = ipPinRateLimitMap[ipKey];
    if (rec && rec.lockedUntil > now) {
        var waitSec = Math.ceil((rec.lockedUntil - now) / 1000);
        return {
            valid: false,
            locked: true,
            rotated: false,
            retryAfterSec: waitSec,
            error: 'Too many failed attempts. Locked out for ' + waitSec + 's.'
        };
    }
    if (rec && rec.lockedUntil && rec.lockedUntil <= now) {
        rec.fails = 0;
        rec.lockedUntil = 0;
    }
    var cleanPin = String(submittedPin || '').trim();
    if (cleanPin && cleanPin === currentPairingPin) {
        if (rec) {
            rec.fails = 0;
            rec.lockedUntil = 0;
        }
        globalPinFailures = 0;
        return { valid: true, locked: false, rotated: false, retryAfterSec: 0 };
    }
    if (!rec) {
        rec = { fails: 0, lockedUntil: 0 };
        ipPinRateLimitMap[ipKey] = rec;
    }
    rec.fails += 1;
    globalPinFailures += 1;
    var rotated = false;
    if (globalPinFailures >= 10) {
        var nextPin = generateSecure4DigitPin();
        if (nextPin === currentPairingPin) {
            nextPin = ('0000' + String((Number(nextPin) + 1) % 10000)).slice(-4);
        }
        currentPairingPin = nextPin;
        globalPinFailures = 0;
        rotated = true;
    }
    if (rec.fails >= 5) {
        rec.lockedUntil = now + 60000;
        return {
            valid: false,
            locked: true,
            rotated: rotated,
            retryAfterSec: 60,
            error: rotated
                ? '5 failed attempts (60s cooldown) & 10 global fails reached — TV PIN rotated.'
                : '5 failed PIN attempts — IP locked for 60s cooldown.'
        };
    }
    return {
        valid: false,
        locked: false,
        rotated: rotated,
        retryAfterSec: 0,
        error: rotated
            ? 'Invalid PIN. Security alert: 10 global failures reached — TV PIN has rotated.'
            : ('Invalid 4-digit TV PIN (' + (5 - rec.fails) + ' attempts left).')
    };
}

function pruneProxyMemory() {
    try {
        var epKeys = Object.keys(endpointCache);
        if (epKeys.length > 40) {
            for (var i = 0; i < epKeys.length - 25; i++) {
                delete endpointCache[epKeys[i]];
            }
        }
        var ipKeys = Object.keys(ipPinRateLimitMap);
        if (ipKeys.length > 50) {
            var now = Date.now();
            for (var j = 0; j < ipKeys.length; j++) {
                var rec = ipPinRateLimitMap[ipKeys[j]];
                if (!rec || (!rec.fails && (!rec.lockedUntil || rec.lockedUntil <= now))) {
                    delete ipPinRateLimitMap[ipKeys[j]];
                }
            }
        }
        while (streamTelemetryKeys.length > 25) {
            var oldKey = streamTelemetryKeys.shift();
            if (oldKey && oldKey !== latestStreamTelemetryKey) {
                delete streamTelemetryMap[oldKey];
            }
        }
    } catch (ePrune) {}
}
var pruneTimer = setInterval(pruneProxyMemory, 60000);
if (pruneTimer && typeof pruneTimer.unref === 'function') {
    pruneTimer.unref();
}

// =========================================================================
// v2.1.0: Loopback Enforcement, SSRF & DNS Rebinding Protection
// =========================================================================
function isLoopbackClient(req) {
    var addr = String((req && req.socket && req.socket.remoteAddress) || (req && req.connection && req.connection.remoteAddress) || '').trim().toLowerCase();
    var cleanAddr = addr.indexOf('::ffff:') === 0 ? addr.slice(7) : addr;
    if (
        cleanAddr === '127.0.0.1' ||
        cleanAddr === '::1' ||
        cleanAddr.indexOf('127.') === 0
    ) {
        return true;
    }
    try {
        var tvLanIp = String(getLocalLanIp() || '').trim().toLowerCase();
        if (tvLanIp && tvLanIp !== '127.0.0.1' && cleanAddr === tvLanIp) {
            return true;
        }
    } catch (eLan) {}
    return false;
}

function isBlockedUpstreamIp(ipStr) {
    if (!ipStr) {
        return true;
    }
    var clean = String(ipStr).trim().toLowerCase();
    if (clean.indexOf('::ffff:') === 0) {
        clean = clean.slice(7);
    }
    if (clean === '::1' || clean === '::' || clean === '0.0.0.0') {
        return true;
    }
    if (clean.indexOf('fe80:') === 0 || clean.indexOf('fe90:') === 0 || clean.indexOf('fea0:') === 0 || clean.indexOf('feb0:') === 0) {
        return true;
    }
    var parts = clean.split('.');
    if (parts.length === 4) {
        var a = Number(parts[0]);
        var b = Number(parts[1]);
        if (a === 0 || a === 127) {
            return true;
        }
        if (a === 169 && b === 254) {
            return true;
        }
        if (a >= 224) {
            return true;
        }
    }
    return false;
}

function createSafeDnsLookup() {
    return function(hostname, options, callback) {
        var cb = typeof options === 'function' ? options : callback;
        var opts = typeof options === 'object' && options !== null ? options : {};
        dns.lookup(hostname, opts, function(err, address, family) {
            if (err) {
                return cb(err);
            }
            if (Array.isArray(address)) {
                for (var i = 0; i < address.length; i++) {
                    if (isBlockedUpstreamIp(address[i] && address[i].address)) {
                        return cb(new Error('SSRF Blocked: Restricted upstream IP ' + address[i].address));
                    }
                }
                return cb(null, address);
            }
            if (isBlockedUpstreamIp(address)) {
                return cb(new Error('SSRF Blocked: Restricted upstream IP ' + address));
            }
            return cb(null, address, family);
        });
    };
}

function guardUpstreamSocketLookup(sock, reqToAbort) {
    if (!sock || typeof sock.on !== 'function') {
        return;
    }
    sock.on('lookup', function(err, address) {
        if (!err && address && isBlockedUpstreamIp(address)) {
            try {
                if (reqToAbort && typeof reqToAbort.abort === 'function') {
                    reqToAbort.abort();
                }
                sock.destroy(new Error('Blocked SSRF upstream IP'));
            } catch (eDestroy) {}
        }
    });
}

function validateSafeUpstreamUrl(rawUrl, callback) {
    var parsed;
    try {
        parsed = url.parse(String(rawUrl || '').trim());
    } catch (eParse) {
        return callback(new Error('Invalid URL'));
    }
    if (!parsed || !parsed.hostname || (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')) {
        return callback(new Error('Invalid HTTP/HTTPS target URL'));
    }
    var isHttps = parsed.protocol === 'https:';
    var port = Number(parsed.port) || (isHttps ? 443 : 80);
    var hostname = String(parsed.hostname).replace(/^\[|\]$/g, '');
    var safeTarget = {
        protocol: parsed.protocol,
        hostname: hostname,
        host: parsed.host,
        port: port,
        path: parsed.path || '/',
        resolvedIp: hostname
    };
    if (net.isIP(hostname)) {
        if (isBlockedUpstreamIp(hostname)) {
            return callback(new Error('SSRF Blocked: Restricted upstream IP ' + hostname));
        }
        return callback(null, safeTarget);
    }
    dns.lookup(hostname, function(err, address) {
        if (err) {
            return callback(err);
        }
        if (isBlockedUpstreamIp(address)) {
            return callback(new Error('SSRF Blocked: Restricted upstream IP ' + address));
        }
        safeTarget.resolvedIp = address || hostname;
        return callback(null, safeTarget);
    });
}

function proxyDashAndDrmRequest(targetUrlStr, customHdrsObj, clientReq, clientRes, redirectsLeft) {
    if (redirectsLeft <= 0) {
        if (!clientRes.headersSent) {
            clientRes.writeHead(502, { 'Access-Control-Allow-Origin': '*' });
        }
        clientRes.end('Too many redirects');
        return;
    }
    var reqBodyChunks = [];
    var reqBodyLen = 0;
    var aborted = false;
    clientReq.on('error', function() {
        aborted = true;
        reqBodyChunks = [];
    });
    clientReq.on('data', function(chunk) {
        var b = Buffer.isBuffer(chunk) ? chunk : allocBufferUtf8(chunk);
        reqBodyLen += b.length;
        if (reqBodyLen <= 2097152) {
            reqBodyChunks.push(b);
        }
    });
    clientReq.on('end', function() {
        if (aborted) {
            return;
        }
        var bodyBuf = reqBodyChunks.length > 0 ? Buffer.concat(reqBodyChunks) : null;
        reqBodyChunks = [];
        (function sendHop(candidateUrl, hopsLeft) {
            validateSafeUpstreamUrl(candidateUrl, function(ssrfErr, safeTarget) {
                if (ssrfErr || !safeTarget) {
                    if (!clientRes.headersSent) {
                        clientRes.writeHead(403, {
                            'Access-Control-Allow-Origin': '*',
                            'Content-Type': 'application/json'
                        });
                    }
                    clientRes.end(JSON.stringify({ error: ssrfErr ? ssrfErr.message : 'Blocked target' }));
                    return;
                }
                var isHttps = safeTarget.protocol === 'https:';
                var client = isHttps ? https : http;
                var outHeaders = {};
                function setHeaderCaseInsensitive(targetObj, hName, hVal) {
                    var lowTarget = String(hName || '').toLowerCase();
                    if (!lowTarget) {
                        return;
                    }
                    var existing = Object.keys(targetObj);
                    for (var ei = 0; ei < existing.length; ei++) {
                        if (existing[ei].toLowerCase() === lowTarget) {
                            delete targetObj[existing[ei]];
                        }
                    }
                    targetObj[hName] = hVal;
                }
                function hasHeaderCaseInsensitive(targetObj, hName) {
                    var lowTarget = String(hName || '').toLowerCase();
                    var existing = Object.keys(targetObj);
                    for (var ei = 0; ei < existing.length; ei++) {
                        if (existing[ei].toLowerCase() === lowTarget) {
                            return true;
                        }
                    }
                    return false;
                }
                var skipReq = {
                    host: true,
                    connection: true,
                    'keep-alive': true,
                    origin: true,
                    referer: true,
                    'accept-encoding': true,
                    'content-length': true,
                    'x-target-url': true,
                    'x-proxy-ua': true,
                    'x-proxy-referer': true,
                    'x-proxy-origin': true,
                    'x-proxy-cookie': true,
                    'x-proxy-headers': true,
                    'x-vortixtv-client': true,
                    'sec-fetch-site': true,
                    'sec-fetch-mode': true,
                    'sec-fetch-dest': true
                };
                if (clientReq.headers) {
                    var inKeys = Object.keys(clientReq.headers);
                    for (var i = 0; i < inKeys.length; i++) {
                        var ik = inKeys[i];
                        var lowK = ik.toLowerCase();
                        if (!skipReq[lowK] && clientReq.headers[ik] !== undefined) {
                            setHeaderCaseInsensitive(outHeaders, ik, clientReq.headers[ik]);
                        }
                    }
                }
                if (customHdrsObj && typeof customHdrsObj === 'object') {
                    var cKeys = Object.keys(customHdrsObj);
                    for (var ci = 0; ci < cKeys.length; ci++) {
                        var ck = String(cKeys[ci] || '').trim();
                        var cv = String(customHdrsObj[ck] || '').trim();
                        if (ck && cv) {
                            setHeaderCaseInsensitive(outHeaders, ck, cv);
                        }
                    }
                }
                if (!hasHeaderCaseInsensitive(outHeaders, 'User-Agent')) {
                    setHeaderCaseInsensitive(outHeaders, 'User-Agent', 'Mozilla/5.0 (SMART-TV; Linux; Tizen 5.5) AppleWebKit/537.36');
                }
                if (bodyBuf && bodyBuf.length > 0) {
                    setHeaderCaseInsensitive(outHeaders, 'Content-Length', String(bodyBuf.length));
                }
                setHeaderCaseInsensitive(outHeaders, 'Host', safeTarget.host);
                var upReq = client.request({
                    hostname: safeTarget.resolvedIp || safeTarget.hostname,
                    port: safeTarget.port,
                    path: safeTarget.path,
                    method: clientReq.method || 'GET',
                    headers: outHeaders,
                    servername: safeTarget.hostname,
                    agent: isHttps ? httpsAgent : httpAgent,
                    timeout: 20000,
                    rejectUnauthorized: false
                }, function(upRes) {
                    var sc = Number(upRes.statusCode) || 502;
                    if ([301, 302, 303, 307, 308].indexOf(sc) !== -1 && upRes.headers && upRes.headers.location && hopsLeft > 1) {
                        var nextLoc = url.resolve(candidateUrl, upRes.headers.location);
                        upRes.resume();
                        sendHop(nextLoc, hopsLeft - 1);
                        return;
                    }
                    var resHeaders = {
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': '*',
                        'Access-Control-Expose-Headers': '*',
                        'Access-Control-Allow-Methods': 'GET, POST, HEAD, OPTIONS',
                        'X-Final-Url': candidateUrl
                    };
                    var skipRes = {
                        'transfer-encoding': true,
                        connection: true,
                        'keep-alive': true,
                        te: true,
                        trailer: true,
                        trailers: true,
                        upgrade: true,
                        'proxy-authenticate': true,
                        'proxy-authorization': true
                    };
                    var upKeys = Object.keys(upRes.headers || {});
                    for (var ui = 0; ui < upKeys.length; ui++) {
                        var uk = upKeys[ui];
                        var lowUk = String(uk || '').toLowerCase();
                        if (!skipRes[lowUk] && !/^access-control-allow-/i.test(uk) && upRes.headers[uk] !== undefined) {
                            resHeaders[uk] = upRes.headers[uk];
                        }
                    }
                    if (!clientRes.headersSent) {
                        clientRes.writeHead(sc, resHeaders);
                    }
                    upRes.pipe(clientRes);
                });
                upReq.on('error', function(eUp) {
                    if (!clientRes.headersSent) {
                        clientRes.writeHead(502, { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/plain' });
                    }
                    try { clientRes.end('DASH/DRM Proxy error: ' + (eUp ? eUp.message : 'upstream failed')); } catch (eEnd) {}
                });
                upReq.on('timeout', function() {
                    try { upReq.abort(); } catch (eTo) {}
                    if (!clientRes.headersSent) {
                        clientRes.writeHead(504, { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/plain' });
                    }
                    try { clientRes.end('DASH/DRM Proxy timeout'); } catch (eEnd2) {}
                });
                clientReq.once('close', function() {
                    try { upReq.abort(); } catch (eAb) {}
                });
                if (bodyBuf && bodyBuf.length > 0) {
                    upReq.write(bodyBuf);
                }
                upReq.end();
            });
        })(targetUrlStr, redirectsLeft);
    });
}

function validateVortixTvClient(req) {
    if (!req || !req.headers) {
        return { ok: false, error: 'Missing headers' };
    }
    var isLoopback = isLoopbackClient(req);
    var secSite = String(req.headers['sec-fetch-site'] || '').toLowerCase();
    var origin = String(req.headers.origin || '').toLowerCase();
    if (secSite === 'cross-site') {
        var isLocalWebOrigin = !origin || origin === 'null' || /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(origin) || /^file:/i.test(origin);
        if (!isLoopback || !isLocalWebOrigin) {
            return { ok: false, error: 'Blocked cross-site origin (sec-fetch-site: cross-site)' };
        }
    }
    if (origin === 'null' && !isLoopback) {
        return { ok: false, error: 'Blocked null origin' };
    }
    return { ok: true };
}

function stopActiveRecordingSession() {
    if (!activeRecordingSession) {
        return null;
    }
    var sess = activeRecordingSession;
    activeRecordingSession = null;
    sess.active = false;
    sess.stoppedAt = Date.now();
    if (sess.upReq) {
        try {
            sess.upReq.abort();
        } catch (eRecAbt) {}
        sess.upReq = null;
    }
    if (sess.fileStream) {
        try {
            sess.fileStream.end();
        } catch (eRecEnd) {}
        sess.fileStream = null;
    }
    return sess;
}

function sanitizeDvrFileName(rawName) {
    var base = path.basename(String(rawName || '').trim());
    if (!base || base.indexOf('..') !== -1 || !/^[a-zA-Z0-9._-]+\.ts$/i.test(base)) {
        return '';
    }
    return base;
}

function listDvrRecordingsSync() {
    var results = [];
    try {
        var entries = fs.readdirSync(DVR_DIR) || [];
        var activeName = (activeRecordingSession && activeRecordingSession.active && activeRecordingSession.fileName) ? activeRecordingSession.fileName : '';
        for (var i = 0; i < entries.length; i++) {
            var fn = sanitizeDvrFileName(entries[i]);
            if (!fn) {
                continue;
            }
            var fullPath = path.join(DVR_DIR, fn);
            try {
                var st = fs.statSync(fullPath);
                if (!st || !st.isFile()) {
                    continue;
                }
                var prettyTitle = fn.replace(/^vortixtv_rec_/, '').replace(/_\d+\.ts$/i, '').replace(/_/g, ' ').trim() || fn;
                results.push({
                    fileName: fn,
                    title: prettyTitle,
                    sizeBytes: st.size || 0,
                    createdAt: (st.mtime && typeof st.mtime.getTime === 'function') ? st.mtime.getTime() : Date.now(),
                    isRecording: Boolean(activeName && activeName === fn)
                });
            } catch (eStat) {}
        }
        results.sort(function(a, b) {
            return Number(b.createdAt || 0) - Number(a.createdAt || 0);
        });
    } catch (eList) {}
    return results;
}

function pruneOldDvrRecordingsIfNeeded() {
    try {
        var list = listDvrRecordingsSync();
        var maxClips = 20;
        var maxTotalBytes = 1073741824;
        var totalBytes = 0;
        for (var i = 0; i < list.length; i++) {
            totalBytes += Number(list[i].sizeBytes || 0);
        }
        for (var idx = list.length - 1; idx >= 0 && (list.length > maxClips || totalBytes > maxTotalBytes); idx--) {
            var item = list[idx];
            if (!item || item.isRecording) {
                continue;
            }
            try {
                fs.unlinkSync(path.join(DVR_DIR, item.fileName));
                totalBytes -= Number(item.sizeBytes || 0);
                list.splice(idx, 1);
            } catch (eDel) {}
        }
    } catch (ePruneDvr) {}
}

if (typeof process !== 'undefined' && process && typeof process.on === 'function') {
    process.on('uncaughtException', function(err) {
        try {
            console.error('[VortixProxy] Uncaught exception:', err && (err.stack || err.message || String(err)));
            stopActiveRecordingSession();
        } catch (eLog) {}
    });
    process.on('unhandledRejection', function(reason) {
        try {
            console.error('[VortixProxy] Unhandled rejection:', reason && (reason.stack || reason.message || String(reason)));
        } catch (eRej) {}
    });
}

function getLocalLanIp() {
    try {
        var nets = os.networkInterfaces ? os.networkInterfaces() : {};
        var names = Object.keys(nets);
        for (var i = 0; i < names.length; i++) {
            var list = nets[names[i]] || [];
            for (var j = 0; j < list.length; j++) {
                var netIf = list[j];
                var fam = netIf && netIf.family;
                if ((fam === 'IPv4' || fam === 4) && !netIf.internal && netIf.address && netIf.address !== '127.0.0.1') {
                    return netIf.address;
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
        '<title>VortixTV v2.2.0 Companion Setup & Backup</title>',
        '<style>',
        'body{font-family:system-ui,-apple-system,sans-serif;background:#070b14;color:#f8fafc;margin:0;padding:18px;}',
        '.card{max-width:540px;margin:0 auto 16px auto;background:#111827;border:1px solid #1f2937;border-radius:14px;padding:20px;box-shadow:0 12px 30px rgba(0,0,0,0.55);}',
        'h2{margin-top:0;color:#38bdf8;font-size:20px;display:flex;align-items:center;justify-content:space-between;}',
        'h3{margin-top:0;color:#fde047;font-size:16px;}',
        'label{display:block;font-size:13px;color:#94a3b8;margin-top:12px;margin-bottom:4px;font-weight:600;}',
        'input,select,textarea{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:8px;border:1px solid #374151;background:#090d16;color:#fff;font-size:15px;}',
        '.pin-input{font-family:monospace;font-size:22px;font-weight:900;letter-spacing:6px;text-align:center;border-color:#f59e0b;color:#fde047;}',
        'button{width:100%;margin-top:12px;padding:12px;border:none;border-radius:8px;background:#2563eb;color:#fff;font-size:15px;font-weight:700;cursor:pointer;}',
        'button.sec{background:#059669;}',
        'button.amber{background:#d97706;}',
        'button.danger{background:#dc2626;}',
        'button.sm{margin-top:0;padding:7px 10px;font-size:12px;width:auto;}',
        '.row{display:flex;gap:10px;}',
        '.msg{margin-top:12px;font-size:14px;text-align:center;font-weight:600;}',
        '.m3u-drop{border:1px dashed #3b82f6;border-radius:10px;padding:12px;margin-top:10px;background:rgba(30,58,138,0.18);}',
        '.dvr-list{margin-top:12px;max-height:220px;overflow-y:auto;}',
        '.dvr-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border:1px solid #1f2937;border-radius:8px;background:#090d16;margin-bottom:8px;}',
        '.dvr-meta{font-size:12px;color:#cbd5e1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;}',
        '</style></head><body>',
        '<div class="card">',
        '<h2><span>VortixTV v2.2.0 LAN Companion</span><span style="font-size:12px;background:#1e3a8a;color:#93c5fd;padding:3px 8px;border-radius:99px;">PIN Guarded</span></h2>',
        '<p style="font-size:13px;color:#cbd5e1;margin-top:0;">Enter the 4-digit pairing PIN shown on your Samsung TV screen (' + String(endpointUrl || '') + ').</p>',
        '<label>🔑 4-Digit TV Pairing PIN (Required)</label>',
        '<input id="pin" class="pin-input" maxlength="4" placeholder="0000" inputmode="numeric">',
        '<label>Profile Name</label><input id="name" placeholder="Living Room TV" value="Living Room 4K">',
        '<label>Provider Type</label><select id="type" onchange="syncType()"><option value="stalker">Stalker MAC Portal</option><option value="xtream">Xtream Codes API</option><option value="m3u">M3U / M3U8 Playlist</option></select>',
        '<div id="grp-stalker">',
        '<label>Stalker Portal URL</label><input id="portal" placeholder="http://example.com/stalker_portal/c/">',
        '<label>Stalker MAC Address</label><input id="mac" placeholder="00:1A:79:XX:XX:XX">',
        '</div>',
        '<div id="grp-xtream" style="display:none">',
        '<label>Xtream Server URL</label><input id="xtreamUrl" placeholder="http://server.example.com:8080">',
        '<label>Xtream Username</label><input id="xtreamUser" placeholder="username">',
        '<label>Xtream Password</label><input id="xtreamPass" type="password" placeholder="password">',
        '</div>',
        '<div id="grp-m3u" style="display:none">',
        '<label>M3U Playlist URL</label><input id="m3uUrl" placeholder="https://example.com/playlist.m3u8">',
        '<div class="m3u-drop">',
        '<label style="margin-top:0;color:#93c5fd;">📂 Or Upload .M3U / .M3U8 File from Device</label>',
        '<input id="m3uFile" type="file" accept=".m3u,.m3u8,audio/x-mpegurl,application/vnd.apple.mpegurl,text/plain" onchange="handleM3uFileSelect()">',
        '<div id="m3uFileInfo" style="font-size:12px;color:#cbd5e1;margin-top:6px;">No local playlist file selected</div>',
        '</div>',
        '</div>',
        '<label>Custom XMLTV EPG URL (Optional)</label><input id="epgUrl" placeholder="http://example.com/epg.xml.gz">',
        '<label>EPG Time-Shift Offset (Hours)</label><select id="epgOffsetHours"><option value="-4">-4h</option><option value="-3">-3h</option><option value="-2">-2h</option><option value="-1">-1h</option><option value="0" selected>0h (Auto UTC)</option><option value="1">+1h</option><option value="2">+2h</option><option value="3">+3h</option><option value="4">+4h</option></select>',
        '<button id="sendBtn" onclick="pushCfg()">🚀 Push Profile / M3U to TV Now</button>',
        '<div id="status" class="msg"></div>',
        '</div>',
        '<div class="card">',
        '<h3>📦 Phone Backup & Restore over LAN</h3>',
        '<p style="font-size:13px;color:#94a3b8;margin-top:0;">One-click download or restore of your full TV JSON configuration (profiles, favorites, watch history, preferences) guarded by your 4-digit PIN.</p>',
        '<div class="row">',
        '<button class="sec" onclick="downloadBackup()">⬇ Download TV Backup</button>',
        '<button class="amber" onclick="restoreBackup()">⬆ Restore JSON to TV</button>',
        '</div>',
        '<label>Backup JSON Payload (Auto-filled on Download or Paste to Restore)</label>',
        '<textarea id="backupJson" rows="4" placeholder=\'{"version":2,"profiles":[...]}\'></textarea>',
        '<div id="backupStatus" class="msg"></div>',
        '</div>',
        '<div class="card">',
        '<h3>📋 Favorites .M3U & 📼 DVR Recordings</h3>',
        '<p style="font-size:13px;color:#94a3b8;margin-top:0;">Download your TV Favorites .M3U playlist or manage & download recorded .TS clips stored on the TV.</p>',
        '<div class="row">',
        '<button class="sec" onclick="downloadFavoritesM3u()">⬇ Download Favorites .M3U</button>',
        '<button onclick="refreshDvrList()">🔄 Load DVR Clips</button>',
        '</div>',
        '<div id="dvrList" class="dvr-list"></div>',
        '<div id="lanMediaStatus" class="msg"></div>',
        '</div>',
        '<script>',
        'var uploadedM3uName="";var uploadedM3uRaw="";',
        'function syncType(){var t=document.getElementById("type").value;document.getElementById("grp-stalker").style.display=(t==="stalker"?"block":"none");document.getElementById("grp-xtream").style.display=(t==="xtream"?"block":"none");document.getElementById("grp-m3u").style.display=(t==="m3u"?"block":"none");}',
        'function handleM3uFileSelect(){var inp=document.getElementById("m3uFile");var info=document.getElementById("m3uFileInfo");var f=inp&&inp.files?inp.files[0]:null;uploadedM3uName="";uploadedM3uRaw="";if(!f){if(info)info.textContent="No local playlist file selected";return;}if(!/\\.(m3u8?|txt)$/i.test(f.name)){if(info)info.textContent="⚠ Please choose a .m3u or .m3u8 file";return;}if(f.size>22020096){if(info)info.textContent="⚠ File exceeds 21 MB limit";return;}if(info)info.textContent="Reading "+f.name+"...";var r=new FileReader();r.onload=function(){var txt=String(r.result||"");if(txt.indexOf("#EXTM3U")===-1&&txt.indexOf("#EXTINF")===-1){if(info)info.textContent="⚠ Invalid M3U content (missing #EXTM3U / #EXTINF)";return;}uploadedM3uName=f.name;uploadedM3uRaw=txt;if(info)info.textContent="✅ Ready: "+f.name+" ("+Math.round(txt.length/1024)+" KB)";};r.readAsText(f);}',
        'function pushCfg(){',
        'var pin=document.getElementById("pin").value;var pType=document.getElementById("type").value;var st=document.getElementById("status");',
        'if(pType==="m3u"&&uploadedM3uRaw){st.textContent="⏳ Uploading "+uploadedM3uName+"...";fetch("/remote-setup",{method:"POST",headers:{"Content-Type":"application/json","X-Vortix-Pin":pin},body:JSON.stringify({action:"upload_m3u",pin:pin,name:document.getElementById("name").value,fileName:uploadedM3uName,rawText:uploadedM3uRaw,epgUrl:document.getElementById("epgUrl").value,epgOffsetHours:Number(document.getElementById("epgOffsetHours").value)||0})}).then(function(r){return r.json();}).then(function(d){st.textContent=d.ok?"✅ Uploaded M3U playlist to TV! Loading catalog...":"❌ "+(d.error||"Upload failed");});return;}',
        'var payload={pin:pin,name:document.getElementById("name").value,type:pType,portal:document.getElementById("portal").value,mac:document.getElementById("mac").value,xtreamUrl:document.getElementById("xtreamUrl").value,xtreamUser:document.getElementById("xtreamUser").value,xtreamPass:document.getElementById("xtreamPass").value,m3uUrl:document.getElementById("m3uUrl").value,epgUrl:document.getElementById("epgUrl").value,epgOffsetHours:Number(document.getElementById("epgOffsetHours").value)||0};',
        'fetch("/remote-setup",{method:"POST",headers:{"Content-Type":"application/json","X-Vortix-Pin":pin},body:JSON.stringify(payload)}).then(function(r){return r.json();}).then(function(d){st.textContent=d.ok?"✅ Sent to TV! Settings will apply automatically.":"❌ "+(d.error||"Failed");});',
        '}',
        'function downloadBackup(){',
        'var pin=document.getElementById("pin").value;',
        'fetch("/remote-setup",{method:"POST",headers:{"Content-Type":"application/json","X-Vortix-Pin":pin},body:JSON.stringify({action:"export_backup",pin:pin})}).then(function(r){return r.json();}).then(function(d){',
        'if(d.ok&&d.backup){var str=typeof d.backup==="string"?d.backup:JSON.stringify(d.backup,null,2);document.getElementById("backupJson").value=str;document.getElementById("backupStatus").textContent="✅ TV Configuration Backup downloaded!";}else{document.getElementById("backupStatus").textContent="❌ "+(d.error||"Backup failed");}',
        '});}',
        'function restoreBackup(){',
        'var pin=document.getElementById("pin").value;var raw=document.getElementById("backupJson").value;',
        'fetch("/remote-setup",{method:"POST",headers:{"Content-Type":"application/json","X-Vortix-Pin":pin},body:JSON.stringify({action:"import_backup",pin:pin,backup:raw})}).then(function(r){return r.json();}).then(function(d){',
        'document.getElementById("backupStatus").textContent=d.ok?"✅ Restore queued! TV will reload configuration automatically.":"❌ "+(d.error||"Restore failed");',
        '});}',
        'function triggerBlobDownload(blob,fname){var u=URL.createObjectURL(blob);var a=document.createElement("a");a.href=u;a.download=fname;document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(function(){URL.revokeObjectURL(u);},2000);}',
        'function downloadFavoritesM3u(){var pin=document.getElementById("pin").value;var ms=document.getElementById("lanMediaStatus");fetch("/lan-download?type=favorites",{headers:{"X-Vortix-Pin":pin}}).then(function(r){if(!r.ok){return r.json().then(function(e){throw new Error(e.error||("HTTP "+r.status));});}return r.blob();}).then(function(b){triggerBlobDownload(b,"vortixtv-favorites.m3u");ms.textContent="✅ Favorites .M3U downloaded!";}).catch(function(e){ms.textContent="❌ "+e.message;});}',
        'function refreshDvrList(){var pin=document.getElementById("pin").value;var box=document.getElementById("dvrList");var ms=document.getElementById("lanMediaStatus");fetch("/remote-setup",{method:"POST",headers:{"Content-Type":"application/json","X-Vortix-Pin":pin},body:JSON.stringify({action:"list_dvr",pin:pin})}).then(function(r){return r.json();}).then(function(d){if(!d.ok){ms.textContent="❌ "+(d.error||"Failed");return;}var list=d.recordings||[];box.innerHTML="";if(list.length===0){ms.textContent="No DVR clips recorded on TV yet.";return;}ms.textContent="✅ Found "+list.length+" DVR recording(s).";list.forEach(function(rec){var row=document.createElement("div");row.className="dvr-row";var meta=document.createElement("div");meta.className="dvr-meta";meta.textContent=(rec.isRecording?"🔴 ":"📼 ")+rec.title+" ("+(rec.sizeBytes/1048576).toFixed(1)+" MB)";var dl=document.createElement("button");dl.className="sec sm";dl.textContent="⬇ .TS";dl.onclick=function(){downloadDvrClip(rec.fileName);};var del=document.createElement("button");del.className="danger sm";del.textContent="🗑";del.onclick=function(){deleteDvrClip(rec.fileName);};row.appendChild(meta);row.appendChild(dl);row.appendChild(del);box.appendChild(row);});});}',
        'function downloadDvrClip(fname){var pin=document.getElementById("pin").value;var ms=document.getElementById("lanMediaStatus");ms.textContent="⏳ Downloading "+fname+"...";fetch("/lan-download?type=dvr&file="+encodeURIComponent(fname),{headers:{"X-Vortix-Pin":pin}}).then(function(r){if(!r.ok){return r.json().then(function(e){throw new Error(e.error||("HTTP "+r.status));});}return r.blob();}).then(function(b){triggerBlobDownload(b,fname);ms.textContent="✅ Downloaded "+fname;syncType();}).catch(function(e){ms.textContent="❌ "+e.message;});}',
        'function deleteDvrClip(fname){var pin=document.getElementById("pin").value;var ms=document.getElementById("lanMediaStatus");fetch("/remote-setup",{method:"POST",headers:{"Content-Type":"application/json","X-Vortix-Pin":pin},body:JSON.stringify({action:"delete_dvr",pin:pin,fileName:fname})}).then(function(r){return r.json();}).then(function(d){if(d.ok){ms.textContent="🗑 Deleted "+fname;refreshDvrList();}else{ms.textContent="❌ "+(d.error||"Delete failed");}});}',
        '</script></body></html>'
    ].join('');
}

function getStreamKey(u) {
    var str = String(u || '').trim();
    var idx = str.indexOf('/stream?url=');
    if (idx !== -1) {
        var encoded = str.substring(idx + 12).split('&')[0];
        try {
            str = decodeURIComponent(encoded);
        } catch (eDec) {
            str = encoded;
        }
    }
    return str.split('?')[0];
}

function sniffStreamPayload(firstChunk, contentType, streamUrl) {
    var ct = String(contentType || '').toLowerCase().split(';')[0].trim();
    var u = String(streamUrl || '').toLowerCase().split('?')[0];
    var buf = Buffer.isBuffer(firstChunk) ? firstChunk : (firstChunk ? Buffer.from(firstChunk) : null);
    var headStr = buf ? buf.slice(0, 512).toString('utf8').replace(/^\uFEFF/, '').trim().toLowerCase() : '';
    var isHtml = (ct.indexOf('text/html') !== -1 || ct.indexOf('application/xhtml') !== -1) ||
        (headStr.indexOf('<!doctype html') === 0 || headStr.indexOf('<html') === 0 || headStr.indexOf('<head>') !== -1);
    if (isHtml) {
        return { format: 'HTML', isHtmlError: true, isPlaylist: false };
    }
    if (headStr.indexOf('#extm3u') === 0 || ct.indexOf('mpegurl') !== -1 || /\.m3u8?$/.test(u)) {
        return { format: 'HLS', isHtmlError: false, isPlaylist: true };
    }
    if (headStr.indexOf('<mpd') !== -1 || headStr.indexOf('urn:mpeg:dash:schema:mpd') !== -1 || ct.indexOf('dash+xml') !== -1 || /\.mpd$/.test(u)) {
        return { format: 'MPEG-DASH', isHtmlError: false, isPlaylist: true };
    }
    if ((buf && buf.length >= 1 && buf[0] === 0x47 && (buf.length < 189 || buf[188] === 0x47 || buf.length < 193 || buf[192] === 0x47)) || ct.indexOf('mp2t') !== -1 || /\.ts$/.test(u)) {
        return { format: 'MPEG-TS', isHtmlError: false, isPlaylist: false };
    }
    if ((buf && buf.length >= 8 && buf.slice(4, 8).toString('ascii') === 'ftyp') || ct === 'video/mp4' || /\.mp4$/.test(u)) {
        return { format: 'MP4', isHtmlError: false, isPlaylist: false };
    }
    if ((buf && buf.length >= 4 && buf[0] === 0x1A && buf[1] === 0x45 && buf[2] === 0xDF && buf[3] === 0xA3) || ct.indexOf('matroska') !== -1 || /\.mkv$/.test(u)) {
        return { format: 'MKV', isHtmlError: false, isPlaylist: false };
    }
    if (ct.indexOf('json') !== -1 && (headStr.indexOf('{') === 0 || headStr.indexOf('[') === 0)) {
        return { format: 'JSON', isHtmlError: true, isPlaylist: false };
    }
    if (ct.indexOf('video/') === 0) {
        return { format: ct.slice(6).toUpperCase(), isHtmlError: false, isPlaylist: false };
    }
    if (ct.indexOf('audio/') === 0) {
        return { format: ct.slice(6).toUpperCase(), isHtmlError: false, isPlaylist: false };
    }
    return { format: '', isHtmlError: false, isPlaylist: false };
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
            firstByteTs: 0,
            httpStatus: 0,
            ttfbMs: null,
            totalBytes: 0,
            windowBytes: 0,
            kbps: 0,
            samples: [],
            errorText: '',
            contentType: '',
            detectedFormat: '',
            isHtmlError: false,
            isPlaylist: false,
            videoCodec: '',
            audioCodec: '',
            active: true
        };
        streamTelemetryMap[key] = entry;
    } else {
        entry.active = true;
        if (data && (data.reset || data.code === 0)) {
            entry.url = u || entry.url;
            entry.startTs = now;
            entry.firstByteTs = 0;
            entry.httpStatus = 0;
            entry.ttfbMs = null;
            entry.totalBytes = 0;
            entry.windowBytes = 0;
            entry.kbps = 0;
            entry.samples = [];
            entry.errorText = '';
            entry.contentType = '';
            entry.detectedFormat = '';
            entry.isHtmlError = false;
            entry.isPlaylist = false;
            entry.videoCodec = '';
            entry.audioCodec = '';
        }
    }
    latestStreamTelemetryKey = key;
    if (data) {
        if (data.code !== undefined && data.code !== null && data.code > 0) {
            entry.httpStatus = data.code;
            if (data.code >= 200 && data.code < 400) {
                entry.errorText = '';
            }
        }
        if (data.contentType) {
            entry.contentType = String(data.contentType);
        }
        if (data.detectedFormat) {
            entry.detectedFormat = String(data.detectedFormat);
        }
        if (data.isHtmlError !== undefined) {
            entry.isHtmlError = Boolean(data.isHtmlError);
        }
        if (data.isPlaylist !== undefined) {
            entry.isPlaylist = Boolean(data.isPlaylist);
        }
        if (data.ttfb && !entry.ttfbMs) {
            entry.ttfbMs = data.ttfb;
        }
        if (data.err) {
            entry.errorText = data.err.message || String(data.err);
        }
        if (data.chunkLen) {
            if (!entry.firstByteTs) {
                entry.firstByteTs = now;
            }
            entry.errorText = '';
            entry.totalBytes += data.chunkLen;
            entry.windowBytes = (entry.windowBytes || 0) + data.chunkLen;
            var sLen = entry.samples.length;
            var lastSample = sLen > 0 ? entry.samples[sLen - 1] : null;
            if (lastSample && (now - lastSample.ts) < 50) {
                lastSample.bytes += data.chunkLen;
            } else {
                entry.samples.push({ ts: now, bytes: data.chunkLen });
            }
            var cutoff = now - 2500;
            while (entry.samples.length > 0 && entry.samples[0].ts < cutoff) {
                var removed = entry.samples.shift();
                entry.windowBytes = Math.max(0, entry.windowBytes - removed.bytes);
            }
            var windowSpanSec = entry.samples.length > 1
                ? Math.max(0.25, Math.min(2.5, (now - entry.samples[0].ts) / 1000))
                : 2.5;
            entry.kbps = Math.round((entry.windowBytes * 8) / windowSpanSec);
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
    if (entry.active) {
        var cutoff = now - 2500;
        while (entry.samples.length > 0 && entry.samples[0].ts < cutoff) {
            var expired = entry.samples.shift();
            entry.windowBytes = Math.max(0, (entry.windowBytes || 0) - expired.bytes);
        }
        if (entry.samples.length === 0) {
            entry.windowBytes = 0;
            entry.kbps = 0;
        }
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

    if (entry.isHtmlError) {
        var htmlReason = 'Upstream returned an ' + (entry.detectedFormat || 'HTML') + ' error/block page instead of playable media (' + entry.totalBytes + ' B).';
        return {
            status: 'provider_error',
            source: 'provider',
            label: 'PROVIDER BLOCKED / NON-MEDIA RESPONSE',
            summary: htmlReason,
            reason: htmlReason,
            recommendation: 'The server responded with non-video text/HTML (expired token, geo/IP block, or portal error).'
        };
    }

    if (entry.totalBytes === 0 && (!entry.active || elapsedMs >= 3000)) {
        var idleReason = 'Connected to provider (' + (code ? 'HTTP ' + code : 'waiting') + '), but 0 bytes received after ' + (elapsedMs / 1000).toFixed(1) + 's. Event/channel is likely off-air.';
        return {
            status: 'provider_error',
            source: 'provider',
            label: 'PROVIDER IDLE (0 KB/s)',
            summary: idleReason,
            reason: idleReason,
            recommendation: 'Channel has no active broadcast feed on the provider right now.'
        };
    }

    if (entry.isPlaylist && entry.totalBytes > 0) {
        var manifestReason = (entry.detectedFormat || 'Playlist') + ' manifest reachable (' + entry.totalBytes + ' B)' + (entry.ttfbMs ? ' • TTFB ' + entry.ttfbMs + 'ms' : '') + '.';
        return {
            status: 'healthy',
            source: 'healthy',
            label: 'MANIFEST READY',
            summary: manifestReason,
            reason: manifestReason,
            recommendation: 'Playlist/manifest responded cleanly. Press Play to stream segments.'
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

// Persistent Keep-Alive agents with high socket concurrency and SSRF-safe DNS lookup
var safeLookup = createSafeDnsLookup();
var httpAgent = new http.Agent({ keepAlive: true, keepAliveMsecs: 3000, maxSockets: 64, maxFreeSockets: 8, lookup: safeLookup });
var httpsAgent = new https.Agent({ keepAlive: true, keepAliveMsecs: 3000, maxSockets: 64, maxFreeSockets: 8, rejectUnauthorized: false, lookup: safeLookup });

var activeCatalogAbortFns = [];
var trailerSearchCache = {};

function registerCatalogAbort(fn) {
    if (typeof fn === 'function') {
        activeCatalogAbortFns.push(fn);
    }
}

function unregisterCatalogAbort(fn) {
    var idx = activeCatalogAbortFns.indexOf(fn);
    if (idx !== -1) {
        activeCatalogAbortFns.splice(idx, 1);
    }
}

function resetAllProxySessions() {
    endpointCache = {};
    cookieJar = {};
    lastPortalReferer = '';
    lastActiveMac = '';
    if (activeCatalogAbortFns.length > 0) {
        var fns = activeCatalogAbortFns.slice();
        activeCatalogAbortFns = [];
        for (var i = 0; i < fns.length; i++) {
            try {
                fns[i]();
            } catch (eCatAb) {}
        }
    }
    if (activeVideoUpReq) {
        try {
            activeVideoUpReq.abort();
        } catch (eAb) {}
        activeVideoUpReq = null;
        activeVideoStreamKey = '';
    }
    try {
        if (httpAgent && typeof httpAgent.destroy === 'function') {
            httpAgent.destroy();
        }
        if (httpsAgent && typeof httpsAgent.destroy === 'function') {
            httpsAgent.destroy();
        }
    } catch (eAg) {}
    httpAgent = new http.Agent({ keepAlive: true, keepAliveMsecs: 3000, maxSockets: 64, maxFreeSockets: 8, lookup: safeLookup });
    httpsAgent = new https.Agent({ keepAlive: true, keepAliveMsecs: 3000, maxSockets: 64, maxFreeSockets: 8, rejectUnauthorized: false, lookup: safeLookup });
}

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

function clearCookieScopeForPortal(rawPortal, mac) {
    if (!rawPortal) {
        return;
    }
    var pStr = String(rawPortal).trim();
    if (!/^https?:\/\//i.test(pStr)) {
        pStr = 'http://' + pStr;
    }
    try {
        var parsed = url.parse(pStr);
        if (parsed && parsed.hostname) {
            var scopeKey = getCookieScopeKey(parsed.hostname, mac);
            delete cookieJar[scopeKey];
        }
    } catch (eClearCookie) {}
}

function storeSetCookies(hostname, setCookieHeaders, mac) {
    if (!hostname || !setCookieHeaders) {
        return;
    }
    var scopeKey = getCookieScopeKey(hostname, mac);
    if (!cookieJar[scopeKey]) {
        var jarKeys = Object.keys(cookieJar);
        if (jarKeys.length > 80) {
            delete cookieJar[jarKeys[0]];
        }
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
    var hasStalkerPortalPath = /\/stalker_portal(?:\/|$)/i.test(clean);
    var defaults = hasStalkerPortalPath ? [
        base + '/stalker_portal/server/load.php',
        base + '/portal.php',
        base + '/server/load.php'
    ] : [
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
    var settled = false;
    validateSafeUpstreamUrl(currentUrl, function(ssrfErr, safeTarget) {
        if (settled || reqState.aborted) {
            return;
        }
        if (ssrfErr || !safeTarget) {
            settled = true;
            if (idx + 1 < candidates.length) {
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
            } else {
                callback(ssrfErr || new Error('SSRF Blocked: Restricted upstream target'));
            }
            return;
        }
        var isHttps = safeTarget.protocol === 'https:';
        var client = isHttps ? https : http;
        var mergedCookie = getHostCookieHeader(safeTarget.hostname, headers.Cookie || '', mac);
        var reqHeaders = extendHeaders(headers, {
            Host: safeTarget.host,
            Cookie: mergedCookie,
            Connection: useFreshSocket ? 'close' : 'keep-alive'
        });
        var isCatalogQuery = currentUrl.indexOf('get_all_channels') !== -1 ||
                             currentUrl.indexOf('get_genres') !== -1 ||
                             currentUrl.indexOf('get_categories') !== -1;
        var options = {
            hostname: safeTarget.resolvedIp || safeTarget.hostname,
            port: safeTarget.port,
            path: safeTarget.path,
            method: 'GET',
            headers: reqHeaders,
            servername: safeTarget.hostname,
            agent: useFreshSocket ? false : (isHttps ? httpsAgent : httpAgent),
            lookup: useFreshSocket ? safeLookup : undefined,
            rejectUnauthorized: false,
            timeout: isCatalogQuery ? 35000 : 12000
        };
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
            storeSetCookies(safeTarget.hostname, proxyRes.headers['set-cookie'], mac);
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
                                    var epKeys1 = Object.keys(endpointCache);
                                    if (!endpointCache[portalKey] && epKeys1.length >= 50) {
                                        delete endpointCache[epKeys1[0]];
                                    }
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
                                        var epKeys2 = Object.keys(endpointCache);
                                        if (!endpointCache[portalKey] && epKeys2.length >= 50) {
                                            delete endpointCache[epKeys2[0]];
                                        }
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
        proxyReq.on('socket', function(sock) {
            guardUpstreamSocketLookup(sock, proxyReq);
            if (sock && typeof sock.setNoDelay === 'function') {
                try {
                    sock.setNoDelay(true);
                } catch (eNd) {}
            }
        });
        proxyReq.on('error', function() {
            retryOrNextCandidate();
        });
        proxyReq.on('timeout', function() {
            proxyReq.abort();
            retryOrNextCandidate();
        });
        proxyReq.end();
    });
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

function probeUpstreamStream(streamUrl, redirectsLeft, doneCb, originKey, customHeaders) {
    var streamKey = originKey || getStreamKey(streamUrl);
    if (redirectsLeft <= 0) {
        doneCb(streamTelemetryMap[streamKey] || null);
        return;
    }
    var reqStartTs = Date.now();
    if (!originKey) {
        recordStreamTelemetry(streamKey, streamUrl, { code: 0, reset: true });
    }
    validateSafeUpstreamUrl(streamUrl, function(ssrfErr, safeTarget) {
        if (ssrfErr || !safeTarget) {
            recordStreamTelemetry(streamKey, streamUrl, { err: ssrfErr || new Error('SSRF Blocked') });
            doneCb(streamTelemetryMap[streamKey] || null);
            return;
        }
        var finished = false;
        var probeTimer = null;
        var upReq = null;
        var firstChunkBuf = null;
        var firstChunkSniffed = false;
        var resContentType = '';
        var firstByteTs = 0;

        function finishProbe() {
            if (finished) {
                return;
            }
            finished = true;
            if (probeTimer) {
                clearTimeout(probeTimer);
                probeTimer = null;
            }
            var entry = streamTelemetryMap[streamKey] || null;
            if (entry) {
                entry.active = false;
                if (entry.totalBytes > 0 && !entry.isPlaylist && !entry.isHtmlError) {
                    var baseTs = firstByteTs || reqStartTs;
                    var streamDurSec = Math.max(0.05, (Date.now() - baseTs) / 1000);
                    entry.kbps = Math.round((entry.totalBytes * 8) / streamDurSec);
                }
            }
            doneCb(entry);
        }

        var isHttps = safeTarget.protocol === 'https:';
        var client = isHttps ? https : http;
        var isProbeVod = /\.(?:mkv|mp4|avi|mov)(?:\?|$)/i.test(safeTarget.path || '') ||
            /\.(?:mkv|mp4|avi|mov)(?:\?|$)/i.test(streamUrl || '') ||
            /\/(?:movie|series)\//i.test(safeTarget.path || '') ||
            /\/(?:movie|series)\//i.test(streamUrl || '');
        var mergedCookie = getHostCookieHeader(safeTarget.hostname, '', lastActiveMac);
        var headers = {
            'User-Agent': (customHeaders && customHeaders.ua) ? String(customHeaders.ua) : (isProbeVod ? VLC_UA : MAG_UA),
            'Accept': '*/*',
            'Connection': 'close',
            'Host': safeTarget.host
        };
        if (customHeaders && customHeaders.cookie) {
            headers.Cookie = mergedCookie ? (mergedCookie + '; ' + String(customHeaders.cookie)) : String(customHeaders.cookie);
        } else if (mergedCookie) {
            headers.Cookie = mergedCookie;
        }
        if (customHeaders && customHeaders.referer) {
            headers.Referer = String(customHeaders.referer);
        } else if (lastPortalReferer && !isProbeVod) {
            headers.Referer = lastPortalReferer;
        }
        if (customHeaders && customHeaders.origin) {
            headers.Origin = String(customHeaders.origin);
        }

        upReq = client.request({
            hostname: safeTarget.resolvedIp || safeTarget.hostname,
            port: safeTarget.port,
            path: safeTarget.path,
            method: 'GET',
            headers: headers,
            servername: safeTarget.hostname,
            agent: isHttps ? httpsAgent : httpAgent,
            timeout: 4500,
            rejectUnauthorized: false
        }, function(upRes) {
            var ttfb = Date.now() - reqStartTs;
            storeSetCookies(safeTarget.hostname, upRes.headers['set-cookie'], lastActiveMac);
            if ([301, 302, 303, 307, 308].indexOf(upRes.statusCode) !== -1 && upRes.headers.location) {
                upRes.resume();
                if (probeTimer) {
                    clearTimeout(probeTimer);
                    probeTimer = null;
                }
                finished = true;
                probeUpstreamStream(url.resolve(streamUrl, upRes.headers.location), redirectsLeft - 1, doneCb, streamKey, customHeaders);
                return;
            }
            resContentType = String(upRes.headers['content-type'] || '');
            var initialSniff = sniffStreamPayload(null, resContentType, streamUrl);
            recordStreamTelemetry(streamKey, streamUrl, {
                code: upRes.statusCode,
                ttfb: ttfb,
                contentType: resContentType,
                detectedFormat: initialSniff.format,
                isHtmlError: initialSniff.isHtmlError,
                isPlaylist: initialSniff.isPlaylist
            });
            if (upRes.statusCode >= 400) {
                upRes.resume();
                try {
                    upReq.abort();
                } catch (eAb0) {}
                finishProbe();
                return;
            }
            probeTimer = setTimeout(function() {
                try {
                    upReq.abort();
                } catch (eAb1) {}
                finishProbe();
            }, 1100);
            upRes.on('data', function(chunk) {
                var cLen = chunk ? chunk.length : 0;
                if (cLen > 0 && !firstByteTs) {
                    firstByteTs = Date.now();
                }
                if (!firstChunkSniffed && chunk && cLen > 0) {
                    firstChunkBuf = firstChunkBuf ? Buffer.concat([firstChunkBuf, chunk]) : Buffer.from(chunk);
                    if (firstChunkBuf.length >= 256 || initialSniff.isPlaylist || initialSniff.isHtmlError) {
                        firstChunkSniffed = true;
                        var bodySniff = sniffStreamPayload(firstChunkBuf, resContentType, streamUrl);
                        if (bodySniff.format || bodySniff.isHtmlError || bodySniff.isPlaylist) {
                            recordStreamTelemetry(streamKey, streamUrl, {
                                detectedFormat: bodySniff.format,
                                isHtmlError: bodySniff.isHtmlError,
                                isPlaylist: bodySniff.isPlaylist
                            });
                        }
                    }
                }
                recordStreamTelemetry(streamKey, streamUrl, { chunkLen: cLen });
                var curEntry = streamTelemetryMap[streamKey];
                if (curEntry && curEntry.totalBytes >= 1048576) {
                    try {
                        upReq.abort();
                    } catch (eAb2) {}
                    finishProbe();
                }
            });
            upRes.on('end', function() {
                if (!firstChunkSniffed && firstChunkBuf && firstChunkBuf.length > 0) {
                    firstChunkSniffed = true;
                    var finalSniff = sniffStreamPayload(firstChunkBuf, resContentType, streamUrl);
                    if (finalSniff.format || finalSniff.isHtmlError || finalSniff.isPlaylist) {
                        recordStreamTelemetry(streamKey, streamUrl, {
                            detectedFormat: finalSniff.format,
                            isHtmlError: finalSniff.isHtmlError,
                            isPlaylist: finalSniff.isPlaylist
                        });
                    }
                }
                finishProbe();
            });
            upRes.on('error', function(uErr) {
                recordStreamTelemetry(streamKey, streamUrl, { err: uErr });
                finishProbe();
            });
        });
        upReq.on('socket', function(sock) {
            guardUpstreamSocketLookup(sock, upReq);
        });
        upReq.on('timeout', function() {
            recordStreamTelemetry(streamKey, streamUrl, { err: new Error('Stream probe timeout') });
            try {
                upReq.abort();
            } catch (eTo) {}
            finishProbe();
        });
        upReq.on('error', function(e) {
            recordStreamTelemetry(streamKey, streamUrl, { err: e });
            finishProbe();
        });
        upReq.end();
    });
}

function proxyVideoStream(streamUrl, clientReq, clientRes, redirectsLeft, originKey) {
    if (redirectsLeft <= 0) {
        if (!clientRes.headersSent) {
            clientRes.writeHead(502);
        }
        clientRes.end();
        return;
    }
    var streamKey = originKey || getStreamKey(streamUrl);
    var reqStartTs = Date.now();
    var isSecondaryRange = Boolean(clientReq.headers && clientReq.headers.range && !/^bytes=0-/i.test(clientReq.headers.range));
    if (!originKey && !isSecondaryRange) {
        recordStreamTelemetry(streamKey, streamUrl, { code: 0, reset: true });
    }
    var clientClosedEarly = false;
    function markEarlyClose() {
        clientClosedEarly = true;
    }
    clientReq.once('close', markEarlyClose);
    validateSafeUpstreamUrl(streamUrl, function(ssrfErr, safeTarget) {
        clientReq.removeListener('close', markEarlyClose);
        if (clientClosedEarly) {
            return;
        }
        if (ssrfErr || !safeTarget) {
            recordStreamTelemetry(streamKey, streamUrl, { err: ssrfErr || new Error('SSRF Blocked') });
            if (!clientRes.headersSent) {
                clientRes.writeHead(403, { 'Content-Type': 'application/json' });
            }
            clientRes.end(JSON.stringify({ error: ssrfErr ? ssrfErr.message : 'Blocked target' }));
            return;
        }
        var isHttps = safeTarget.protocol === 'https:';
        var client = isHttps ? https : http;
        var isVodContainer = /\.(?:mkv|mp4|avi|mov)(?:\?|$)/i.test(safeTarget.path || '') || /\.(?:mkv|mp4|avi|mov)(?:\?|$)/i.test(streamUrl || '');
        var isVodStream = isVodContainer || /\/(?:movie|series)\//i.test(safeTarget.path || '') || /\/(?:movie|series)\//i.test(streamUrl || '');
        var mergedCookie = getHostCookieHeader(safeTarget.hostname, '', lastActiveMac);
        var headers = {
            'User-Agent': isVodStream ? VLC_UA : MAG_UA,
            'Accept': '*/*',
            'Connection': 'keep-alive',
            'Host': safeTarget.host
        };
        if (mergedCookie) {
            headers.Cookie = mergedCookie;
        }
        if (lastPortalReferer && !isVodStream) {
            headers.Referer = lastPortalReferer;
        }
        if (clientReq.headers.range) {
            headers.Range = clientReq.headers.range;
        }
        var hasRangeHeader = Boolean(clientReq.headers && clientReq.headers.range);
        var isSegmentOrSubRequest = /\.m4s(\?|$)|\.aac(\?|$)|\.vtt(\?|$)/i.test(safeTarget.path || '');
        var isDifferentStream = Boolean(activeVideoStreamKey && activeVideoStreamKey !== streamKey);
        if (!originKey && !isSegmentOrSubRequest && (isDifferentStream || (!hasRangeHeader && !isVodContainer)) && activeVideoUpReq) {
            try {
                activeVideoUpReq.abort();
            } catch (eAbort) {}
            activeVideoUpReq = null;
            activeVideoStreamKey = '';
        }
        clientRes.on('error', function() {});
        var accumulatedBytes = 0;
        var lastTelemetryFlushTs = Date.now();
        var telemetryFlushTimer = null;
        function flushAccumulatedBytes() {
            if (accumulatedBytes > 0) {
                var bytesToReport = accumulatedBytes;
                accumulatedBytes = 0;
                lastTelemetryFlushTs = Date.now();
                recordStreamTelemetry(streamKey, streamUrl, { chunkLen: bytesToReport });
            }
        }
        var upReq = client.request({
            hostname: safeTarget.resolvedIp || safeTarget.hostname,
            port: safeTarget.port,
            path: safeTarget.path,
            method: 'GET',
            headers: headers,
            servername: safeTarget.hostname,
            agent: isHttps ? httpsAgent : httpAgent,
            timeout: 45000,
            rejectUnauthorized: false
        }, function(upRes) {
            var ttfb = Date.now() - reqStartTs;
            storeSetCookies(safeTarget.hostname, upRes.headers['set-cookie'], lastActiveMac);
            if ([301, 302, 303, 307, 308].indexOf(upRes.statusCode) !== -1 && upRes.headers.location) {
                clientReq.removeListener('close', onClientClose);
                upRes.resume();
                proxyVideoStream(url.resolve(streamUrl, upRes.headers.location), clientReq, clientRes, redirectsLeft - 1, streamKey);
                return;
            }
            recordStreamTelemetry(streamKey, streamUrl, { code: upRes.statusCode, ttfb: ttfb });
            if (!isSegmentOrSubRequest) {
                activeVideoUpReq = upReq;
                activeVideoStreamKey = streamKey;
            }
            upRes.on('error', function(uErr) {
                if (telemetryFlushTimer) {
                    clearTimeout(telemetryFlushTimer);
                    telemetryFlushTimer = null;
                }
                flushAccumulatedBytes();
                recordStreamTelemetry(streamKey, streamUrl, { err: uErr });
                try {
                    clientRes.end();
                } catch (eEnd) {}
            });
            var contentType = String(upRes.headers['content-type'] || '').toLowerCase();
            var isTsPath = /\.ts(\?|$)/i.test(safeTarget.path || '');
            var isDashManifest = contentType.indexOf('dash+xml') !== -1 || /\.mpd(\?|$)/i.test(safeTarget.path || '');
            var isM3u8 = !isTsPath && !isDashManifest && (
                contentType.indexOf('mpegurl') !== -1 ||
                contentType.indexOf('m3u') !== -1 ||
                /\.m3u8(\?|$)/i.test(safeTarget.path || '')
            );

            if (isM3u8 && (upRes.statusCode === 200 || upRes.statusCode === 206)) {
                var m3u8Chunks = [];
                var m3u8Bytes = 0;
                upRes.on('data', function(chunk) {
                    var cBuf = Buffer.isBuffer(chunk) ? chunk : allocBufferUtf8(chunk);
                    recordStreamTelemetry(streamKey, streamUrl, { chunkLen: cBuf.length });
                    m3u8Bytes += cBuf.length;
                    if (m3u8Bytes <= 2097152) {
                        m3u8Chunks.push(cBuf);
                    }
                });
                upRes.on('error', function() {
                    m3u8Chunks = [];
                    if (!clientRes.headersSent) {
                        clientRes.writeHead(502);
                    }
                    try {
                        clientRes.end();
                    } catch (eM3uErr) {}
                });
                upRes.on('end', function() {
                    var rawBuf = Buffer.concat(m3u8Chunks);
                    m3u8Chunks = [];
                    decodeBufferByEncoding(rawBuf, upRes.headers['content-encoding'], function(decodedBuf) {
                        var rawText = (decodedBuf || rawBuf).toString('utf8');
                        if (rawText.indexOf('#EXTM3U') !== -1) {
                            var rewritten = rewriteM3u8Manifest(rawText, streamUrl);
                            var outBuf = allocBufferUtf8(rewritten);
                            if (!clientRes.headersSent) {
                                clientRes.writeHead(200, {
                                    'Access-Control-Allow-Origin': '*',
                                    'Content-Type': 'application/vnd.apple.mpegurl',
                                    'Content-Length': outBuf.length,
                                    'Cache-Control': 'no-cache'
                                });
                            }
                            clientRes.end(outBuf);
                        } else {
                            if (!clientRes.headersSent) {
                                clientRes.writeHead(upRes.statusCode || 200, {
                                    'Access-Control-Allow-Origin': '*',
                                    'Content-Type': upRes.headers['content-type'] || 'video/mp2t'
                                });
                            }
                            clientRes.end(decodedBuf || rawBuf);
                        }
                    });
                });
                return;
            }

            var resHeaders = {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Expose-Headers': '*',
                'Content-Type': upRes.headers['content-type'] || (isDashManifest ? 'application/dash+xml' : 'video/mp2t')
            };
            if (upRes.headers['content-length']) {
                resHeaders['Content-Length'] = upRes.headers['content-length'];
            }
            if (upRes.headers['content-range']) {
                resHeaders['Content-Range'] = upRes.headers['content-range'];
            }
            if (upRes.headers['accept-ranges']) {
                resHeaders['Accept-Ranges'] = upRes.headers['accept-ranges'];
            } else if (isVodStream) {
                resHeaders['Accept-Ranges'] = 'bytes';
            }

            clientRes.writeHead(upRes.statusCode || 200, resHeaders);
            upRes.on('data', function(chunk) {
                var len = chunk ? chunk.length : 0;
                accumulatedBytes += len;
                var now = Date.now();
                if (now - lastTelemetryFlushTs >= 500) {
                    flushAccumulatedBytes();
                } else if (!telemetryFlushTimer) {
                    telemetryFlushTimer = setTimeout(function() {
                        telemetryFlushTimer = null;
                        flushAccumulatedBytes();
                    }, 500);
                }
            });
            upRes.on('end', function() {
                if (telemetryFlushTimer) {
                    clearTimeout(telemetryFlushTimer);
                    telemetryFlushTimer = null;
                }
                flushAccumulatedBytes();
            });
            upRes.on('close', function() {
                if (telemetryFlushTimer) {
                    clearTimeout(telemetryFlushTimer);
                    telemetryFlushTimer = null;
                }
                flushAccumulatedBytes();
            });
            upRes.pipe(clientRes);
        });
        upReq.on('socket', function(sock) {
            guardUpstreamSocketLookup(sock, upReq);
            if (sock && typeof sock.setNoDelay === 'function') {
                try {
                    sock.setNoDelay(true);
                } catch (eNd) {}
            }
            if (sock && typeof sock.setKeepAlive === 'function') {
                try {
                    sock.setKeepAlive(true, 15000);
                } catch (eKa) {}
            }
        });
        upReq.on('timeout', function() {
            recordStreamTelemetry(streamKey, streamUrl, { err: new Error('Stream upstream timeout') });
            try {
                upReq.abort();
            } catch (eTo) {}
            if (!clientRes.headersSent) {
                clientRes.writeHead(504);
            }
            try {
                clientRes.end();
            } catch (eToEnd) {}
        });
        upReq.on('error', function(e) {
            recordStreamTelemetry(streamKey, streamUrl, { err: e });
            if (!clientRes.headersSent) {
                clientRes.writeHead(502);
            }
            clientRes.end();
        });
        function onClientClose() {
            if (telemetryFlushTimer) {
                clearTimeout(telemetryFlushTimer);
                telemetryFlushTimer = null;
            }
            flushAccumulatedBytes();
            if (activeVideoUpReq === upReq) {
                activeVideoUpReq = null;
                activeVideoStreamKey = '';
            }
            if (!isSecondaryRange && streamTelemetryMap[streamKey]) {
                streamTelemetryMap[streamKey].active = false;
            }
            try {
                upReq.abort();
            } catch (eCl) {}
        }
        clientReq.once('close', onClientClose);
        upReq.end();
    });
}

function startProxyServer(port) {
    if (server) {
        return server;
    }
    var listenPort = (typeof port === 'number') ? port : PROXY_PORT;
    server = http.createServer(function(req, res) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.setHeader('Access-Control-Expose-Headers', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, HEAD, OPTIONS');
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

        // v2.1.0 Security Hardening: Loopback-Lock sensitive proxy routes & block cross-site requests
        var clientCheck = validateVortixTvClient(req);
        if (!clientCheck.ok) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: clientCheck.error }));
            return;
        }
        var isLoopback = isLoopbackClient(req);
        var loopbackOnlyPaths = ['/backup', '/catalog-cache', '/favorites-export', '/lan-info', '/stream', '/dash-proxy', '/stream-diag', '/vod-resolve', '/record', '/xtream', '/m3u', '/xmltv', '/trailer-search', '/trailer-embed', '/reset_session'];
        if (!isLoopback && loopbackOnlyPaths.indexOf(parsedUrl.pathname) !== -1) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Forbidden: Route restricted to local loopback (127.0.0.1 / ::1)' }));
            return;
        }

        if (parsedUrl.pathname === '/reset_session') {
            resetAllProxySessions();
            res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
            res.end(JSON.stringify({ ok: true, status: 'session_reset', ts: Date.now() }));
            return;
        }

        if (parsedUrl.pathname === '/backup') {
            if (req.method === 'POST') {
                var bodyParts = [];
                var backupBytes = 0;
                var backupTooLarge = false;
                req.on('error', function() {
                    bodyParts = [];
                });
                req.on('data', function(c) {
                    var bChunk = Buffer.isBuffer(c) ? c : allocBufferUtf8(c);
                    backupBytes += bChunk.length;
                    if (backupBytes > 5242880) {
                        backupTooLarge = true;
                        bodyParts = [];
                        return;
                    }
                    bodyParts.push(bChunk);
                });
                req.on('end', function() {
                    if (backupTooLarge) {
                        res.writeHead(413, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Backup payload too large' }));
                        return;
                    }
                    memoryBackupJson = Buffer.concat(bodyParts).toString('utf8');
                    bodyParts = [];
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
        if (parsedUrl.pathname === '/favorites-export') {
            if (req.method === 'POST') {
                var favParts = [];
                var favBytes = 0;
                var favTooLarge = false;
                req.on('error', function() {
                    favParts = [];
                });
                req.on('data', function(c) {
                    var fChunk = Buffer.isBuffer(c) ? c : allocBufferUtf8(c);
                    favBytes += fChunk.length;
                    if (favBytes > 5242880) {
                        favTooLarge = true;
                        favParts = [];
                        return;
                    }
                    favParts.push(fChunk);
                });
                req.on('end', function() {
                    if (favTooLarge) {
                        res.writeHead(413, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Favorites export payload too large' }));
                        return;
                    }
                    try {
                        var favRaw = Buffer.concat(favParts).toString('utf8');
                        favParts = [];
                        var favBody = JSON.parse(favRaw || '{}');
                        var m3uStr = String(favBody.m3u || '');
                        if (!m3uStr) {
                            res.writeHead(400, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ ok: false, error: 'Missing M3U content' }));
                            return;
                        }
                        memoryFavoritesM3u = m3uStr;
                        memoryFavoritesCount = Number(favBody.count) || Math.max(0, m3uStr.split('#EXTINF:').length - 1);
                        memoryFavoritesUpdatedAt = Date.now();
                        try {
                            fs.writeFileSync(FAVORITES_M3U_PATH, m3uStr, 'utf8');
                        } catch (eFavWr) {
                            fs.writeFile(FAVORITES_M3U_PATH, m3uStr, 'utf8', function() {});
                        }
                        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
                        res.end(JSON.stringify({
                            ok: true,
                            count: memoryFavoritesCount,
                            bytes: Buffer.byteLength(m3uStr, 'utf8'),
                            filePath: FAVORITES_M3U_PATH,
                            updatedAt: memoryFavoritesUpdatedAt
                        }));
                    } catch (eFavJson) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ ok: false, error: 'Invalid JSON payload' }));
                    }
                });
                return;
            }
            if (req.method === 'GET') {
                res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
                res.end(JSON.stringify({
                    ok: Boolean(memoryFavoritesM3u),
                    count: memoryFavoritesCount,
                    updatedAt: memoryFavoritesUpdatedAt,
                    filePath: FAVORITES_M3U_PATH,
                    m3u: memoryFavoritesM3u
                }));
                return;
            }
        }
        if (parsedUrl.pathname === '/catalog-cache') {
            var profKey = String((parsedUrl.query && parsedUrl.query.profile) || 'default').replace(/[^a-zA-Z0-9_-]/g, '') || 'default';
            var cacheFilePath = path.join(CATALOG_CACHE_DIR, 'vortixtv_catalog_' + profKey + '.json');
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
                req.on('error', function() {
                    catParts = [];
                });
                req.on('data', function(c) {
                    var buf = Buffer.isBuffer(c) ? c : allocBufferUtf8(c);
                    totalBytes += buf.length;
                    if (totalBytes > 26214400) {
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
        if (parsedUrl.pathname === '/dash-proxy' && ((parsedUrl.query && parsedUrl.query.url) || req.headers['x-target-url'])) {
            var dashTarget = String((parsedUrl.query && parsedUrl.query.url) || req.headers['x-target-url'] || '').trim();
            var dashHdrs = {};
            if (parsedUrl.query && parsedUrl.query.hdrs) {
                try {
                    var parsedHdrsQ = JSON.parse(String(parsedUrl.query.hdrs));
                    if (parsedHdrsQ && typeof parsedHdrsQ === 'object') {
                        dashHdrs = parsedHdrsQ;
                    }
                } catch (eHq) {}
            }
            if (req.headers['x-proxy-headers']) {
                try {
                    var parsedHdrsH = JSON.parse(String(req.headers['x-proxy-headers']));
                    if (parsedHdrsH && typeof parsedHdrsH === 'object') {
                        var phk = Object.keys(parsedHdrsH);
                        for (var phi = 0; phi < phk.length; phi++) {
                            dashHdrs[phk[phi]] = parsedHdrsH[phk[phi]];
                        }
                    }
                } catch (eHh) {}
            }
            if (parsedUrl.query && parsedUrl.query.ua) dashHdrs['User-Agent'] = String(parsedUrl.query.ua);
            if (parsedUrl.query && parsedUrl.query.ref) dashHdrs.Referer = String(parsedUrl.query.ref);
            if (parsedUrl.query && parsedUrl.query.orig) dashHdrs.Origin = String(parsedUrl.query.orig);
            if (parsedUrl.query && parsedUrl.query.cookie) dashHdrs.Cookie = String(parsedUrl.query.cookie);
            if (req.headers['x-proxy-ua']) dashHdrs['User-Agent'] = String(req.headers['x-proxy-ua']);
            if (req.headers['x-proxy-referer']) dashHdrs.Referer = String(req.headers['x-proxy-referer']);
            if (req.headers['x-proxy-origin']) dashHdrs.Origin = String(req.headers['x-proxy-origin']);
            if (req.headers['x-proxy-cookie']) dashHdrs.Cookie = String(req.headers['x-proxy-cookie']);
            proxyDashAndDrmRequest(dashTarget, dashHdrs, req, res, 5);
            return;
        }

        if (parsedUrl.pathname === '/stream-diag') {
            var hasQueryUrl = Boolean(parsedUrl.query && parsedUrl.query.url);
            var diagKey = hasQueryUrl ? getStreamKey(parsedUrl.query.url) : latestStreamTelemetryKey;
            var existingEntry = diagKey ? (streamTelemetryMap[diagKey] || null) : null;
            var wantsActiveProbe = Boolean(hasQueryUrl && parsedUrl.query.probe === '1' && (!existingEntry || !existingEntry.httpStatus || !existingEntry.active));
            var customProbeHeaders = {
                ua: (parsedUrl.query && parsedUrl.query.ua) ? String(parsedUrl.query.ua) : '',
                referer: (parsedUrl.query && parsedUrl.query.referer) ? String(parsedUrl.query.referer) : '',
                cookie: (parsedUrl.query && parsedUrl.query.cookie) ? String(parsedUrl.query.cookie) : '',
                origin: (parsedUrl.query && parsedUrl.query.origin) ? String(parsedUrl.query.origin) : ''
            };
            var sendDiagResponse = function(tEntry) {
                var diagVerdict = computeStreamDiagnosticVerdict(tEntry);
                var payload = {
                    url: tEntry ? tEntry.url : ((parsedUrl.query && parsedUrl.query.url) || ''),
                    httpStatus: tEntry ? tEntry.httpStatus : 0,
                    ttfbMs: tEntry ? tEntry.ttfbMs : null,
                    elapsedMs: tEntry ? Math.max(0, Date.now() - tEntry.startTs) : 0,
                    totalBytes: tEntry ? tEntry.totalBytes : 0,
                    kbps: tEntry ? tEntry.kbps : 0,
                    kBps: tEntry ? Math.round(tEntry.kbps / 8) : 0,
                    contentType: tEntry ? (tEntry.contentType || '') : '',
                    detectedFormat: tEntry ? (tEntry.detectedFormat || '') : '',
                    isPlaylist: tEntry ? Boolean(tEntry.isPlaylist) : false,
                    isHtmlError: tEntry ? Boolean(tEntry.isHtmlError) : false,
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
            };
            if (wantsActiveProbe) {
                probeUpstreamStream(parsedUrl.query.url, 3, sendDiagResponse, null, customProbeHeaders);
                return;
            }
            sendDiagResponse(existingEntry);
            return;
        }

        if (parsedUrl.pathname === '/lan-info') {
            var detectedIp = getLocalLanIp();
            var setupEndpoint = 'http://' + detectedIp + ':' + activeListenPort + '/setup';
            if (isLoopback && parsedUrl.query && parsedUrl.query.pin && /^\d{4}$/.test(String(parsedUrl.query.pin)) && globalPinFailures === 0) {
                currentPairingPin = String(parsedUrl.query.pin);
            }
            res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
            res.end(JSON.stringify({
                ip: detectedIp,
                port: activeListenPort,
                url: setupEndpoint,
                setupUrl: setupEndpoint,
                pin: currentPairingPin,
                pairingPin: currentPairingPin
            }));
            return;
        }

        if (parsedUrl.pathname === '/setup' && req.method === 'GET') {
            var hostHdr = req.headers.host || (getLocalLanIp() + ':' + activeListenPort);
            var htmlBody = buildRemoteSetupHtml('http://' + hostHdr + '/setup');
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
            res.end(htmlBody);
            return;
        }

        if (parsedUrl.pathname === '/lan-download' && req.method === 'GET') {
            var dlIp = (req.socket && req.socket.remoteAddress) || 'unknown';
            var dlPin = String(req.headers['x-vortix-pin'] || (parsedUrl.query && parsedUrl.query.pin) || '').trim();
            var dlPinRes = verifyLanPairingPin(dlIp, dlPin);
            if (!dlPinRes.valid) {
                res.writeHead(dlPinRes.locked ? 429 : 403, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
                res.end(JSON.stringify({
                    ok: false,
                    error: dlPinRes.error,
                    locked: dlPinRes.locked,
                    rotated: dlPinRes.rotated,
                    retryAfterSec: dlPinRes.retryAfterSec
                }));
                return;
            }
            var dlType = String((parsedUrl.query && parsedUrl.query.type) || '').toLowerCase();
            if (dlType === 'favorites') {
                var favText = memoryFavoritesM3u;
                if (!favText) {
                    try {
                        if (fs.existsSync(FAVORITES_M3U_PATH)) {
                            favText = fs.readFileSync(FAVORITES_M3U_PATH, 'utf8') || '';
                            memoryFavoritesM3u = favText;
                        }
                    } catch (eFavRd) {}
                }
                if (!favText) {
                    res.writeHead(404, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
                    res.end(JSON.stringify({ ok: false, error: 'No Favorites exported from TV yet. Open Favorites on TV to export.' }));
                    return;
                }
                var favBuf = allocBufferUtf8(favText);
                res.writeHead(200, {
                    'Content-Type': 'audio/x-mpegurl; charset=utf-8',
                    'Content-Disposition': 'attachment; filename="vortixtv-favorites.m3u"',
                    'Content-Length': String(favBuf.length),
                    'Cache-Control': 'no-store'
                });
                res.end(favBuf);
                return;
            }
            if (dlType === 'dvr') {
                var reqDvrFile = sanitizeDvrFileName(parsedUrl.query && parsedUrl.query.file);
                if (!reqDvrFile) {
                    res.writeHead(400, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
                    res.end(JSON.stringify({ ok: false, error: 'Invalid DVR file name' }));
                    return;
                }
                var dvrFileFull = path.join(DVR_DIR, reqDvrFile);
                fs.stat(dvrFileFull, function(stErr, st) {
                    if (stErr || !st || !st.isFile()) {
                        res.writeHead(404, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
                        res.end(JSON.stringify({ ok: false, error: 'DVR clip not found' }));
                        return;
                    }
                    res.writeHead(200, {
                        'Content-Type': 'video/mp2t',
                        'Content-Disposition': 'attachment; filename="' + reqDvrFile + '"',
                        'Content-Length': String(st.size || 0),
                        'Cache-Control': 'no-store'
                    });
                    fs.createReadStream(dvrFileFull).pipe(res);
                });
                return;
            }
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'Unsupported download type' }));
            return;
        }

        if (parsedUrl.pathname === '/remote-setup') {
            if (req.method === 'POST') {
                var hdrPin = String(req.headers['x-vortix-pin'] || '').trim();
                var maxRsBytes = (hdrPin && hdrPin === currentPairingPin) ? 26214400 : 5242880;
                var rsParts = [];
                var rsBytes = 0;
                var rsTooLarge = false;
                req.on('error', function() {
                    rsParts = [];
                });
                req.on('data', function(chunk) {
                    var rChunk = Buffer.isBuffer(chunk) ? chunk : allocBufferUtf8(chunk);
                    rsBytes += rChunk.length;
                    if (rsBytes > maxRsBytes) {
                        rsTooLarge = true;
                        rsParts = [];
                        return;
                    }
                    rsParts.push(rChunk);
                });
                req.on('end', function() {
                    if (rsTooLarge) {
                        res.writeHead(413, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Payload too large' }));
                        return;
                    }
                    try {
                        var bodyText = Buffer.concat(rsParts).toString('utf8');
                        rsParts = [];
                        var parsedCfg = JSON.parse(bodyText || '{}');
                        var clientIp = (req.socket && req.socket.remoteAddress) || 'unknown';
                        var pinRes = verifyLanPairingPin(clientIp, parsedCfg.pin || hdrPin);
                        if (!pinRes.valid) {
                            res.writeHead(pinRes.locked ? 429 : 403, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
                            res.end(JSON.stringify({
                                ok: false,
                                error: pinRes.error,
                                locked: pinRes.locked,
                                rotated: pinRes.rotated,
                                retryAfterSec: pinRes.retryAfterSec
                            }));
                            return;
                        }
                        if (parsedCfg.action === 'export_backup') {
                            res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
                            res.end(JSON.stringify({ ok: true, backup: memoryBackupJson || '{}' }));
                            return;
                        }
                        if (parsedCfg.action === 'import_backup' && parsedCfg.backup) {
                            var rawBackupStr = typeof parsedCfg.backup === 'string' ? parsedCfg.backup : JSON.stringify(parsedCfg.backup);
                            memoryBackupJson = rawBackupStr;
                            pendingRemoteRestoreJson = { ts: Date.now(), backup: rawBackupStr };
                            try {
                                fs.writeFile(BACKUP_FILE_PATH, memoryBackupJson, 'utf8', function() {});
                            } catch (eBw) {}
                            res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
                            res.end(JSON.stringify({ ok: true, restored: true, ts: Date.now() }));
                            return;
                        }
                        if (parsedCfg.action === 'list_dvr') {
                            res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
                            res.end(JSON.stringify({
                                ok: true,
                                recordings: listDvrRecordingsSync(),
                                active: Boolean(activeRecordingSession && activeRecordingSession.active)
                            }));
                            return;
                        }
                        if (parsedCfg.action === 'delete_dvr') {
                            var delLanFile = sanitizeDvrFileName(parsedCfg.fileName);
                            if (!delLanFile) {
                                res.writeHead(400, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ ok: false, error: 'Invalid DVR file name' }));
                                return;
                            }
                            if (activeRecordingSession && activeRecordingSession.active && activeRecordingSession.fileName === delLanFile) {
                                stopActiveRecordingSession();
                            }
                            try {
                                fs.unlinkSync(path.join(DVR_DIR, delLanFile));
                                res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
                                res.end(JSON.stringify({ ok: true, deleted: delLanFile }));
                            } catch (eLanDel) {
                                res.writeHead(404, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ ok: false, error: 'DVR clip not found' }));
                            }
                            return;
                        }
                        if (parsedCfg.action === 'upload_m3u') {
                            var rawM3u = String(parsedCfg.rawText || '');
                            if (!rawM3u || (rawM3u.indexOf('#EXTM3U') === -1 && rawM3u.indexOf('#EXTINF') === -1)) {
                                res.writeHead(400, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ ok: false, error: 'Invalid M3U file content (missing #EXTM3U / #EXTINF)' }));
                                return;
                            }
                            var m3uBaseName = path.basename(String(parsedCfg.fileName || 'uploaded_playlist.m3u').trim()).replace(/[^a-zA-Z0-9._-]/g, '_') || 'uploaded_playlist.m3u';
                            pendingRemoteM3uContent = rawM3u;
                            pendingRemoteSetup = {
                                ts: Date.now(),
                                profile: {
                                    name: String(parsedCfg.name || m3uBaseName.replace(/\.m3u8?$/i, '') || 'Uploaded M3U').slice(0, 64),
                                    type: 'm3u',
                                    m3uUrl: 'local://' + m3uBaseName,
                                    m3uFileName: m3uBaseName,
                                    hasUploadedM3u: true,
                                    epgUrl: String(parsedCfg.epgUrl || ''),
                                    epgOffsetHours: Number(parsedCfg.epgOffsetHours) || 0
                                }
                            };
                            res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
                            res.end(JSON.stringify({
                                ok: true,
                                ts: pendingRemoteSetup.ts,
                                fileName: m3uBaseName,
                                bytes: rawM3u.length
                            }));
                            return;
                        }
                        pendingRemoteM3uContent = '';
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
                if (!isLoopback) {
                    res.writeHead(403, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Polling restricted to TV loopback' }));
                    return;
                }
                var outSetup = pendingRemoteSetup;
                var outRestore = pendingRemoteRestoreJson;
                var outM3uText = pendingRemoteM3uContent;
                if (parsedUrl.query && parsedUrl.query.consume === '1') {
                    pendingRemoteSetup = null;
                    pendingRemoteRestoreJson = null;
                    pendingRemoteM3uContent = '';
                }
                res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
                res.end(JSON.stringify({
                    pending: outSetup,
                    pendingRestore: outRestore,
                    uploadedM3uText: outM3uText,
                    pin: currentPairingPin,
                    pairingPin: currentPairingPin
                }));
                return;
            }
        }

        if (parsedUrl.pathname === '/record') {
            var recAction = String((parsedUrl.query && parsedUrl.query.action) || 'status').toLowerCase();
            if (recAction === 'list') {
                res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
                res.end(JSON.stringify({
                    ok: true,
                    dataDir: DVR_DIR,
                    recordings: listDvrRecordingsSync(),
                    active: Boolean(activeRecordingSession && activeRecordingSession.active),
                    activeFile: (activeRecordingSession && activeRecordingSession.fileName) ? activeRecordingSession.fileName : ''
                }));
                return;
            }
            if (recAction === 'delete') {
                var delClipName = sanitizeDvrFileName(parsedUrl.query && parsedUrl.query.file);
                if (!delClipName) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: false, error: 'Invalid recording file name' }));
                    return;
                }
                if (activeRecordingSession && activeRecordingSession.active && activeRecordingSession.fileName === delClipName) {
                    stopActiveRecordingSession();
                }
                fs.unlink(path.join(DVR_DIR, delClipName), function(unErr) {
                    if (unErr) {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ ok: false, error: 'Recording not found' }));
                        return;
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
                    res.end(JSON.stringify({ ok: true, deleted: delClipName }));
                });
                return;
            }
            if (recAction === 'play') {
                var playClipName = sanitizeDvrFileName(parsedUrl.query && parsedUrl.query.file);
                if (!playClipName) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid DVR file name' }));
                    return;
                }
                var playFileFull = path.join(DVR_DIR, playClipName);
                fs.stat(playFileFull, function(stErr, st) {
                    if (stErr || !st || !st.isFile()) {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'DVR recording not found' }));
                        return;
                    }
                    var totalSize = st.size || 0;
                    var rangeHdr = String((req.headers && req.headers.range) || '');
                    if (rangeHdr && totalSize > 0) {
                        var mRange = /^bytes=(\d*)-(\d*)$/i.exec(rangeHdr.trim());
                        if (mRange) {
                            var start = mRange[1] ? parseInt(mRange[1], 10) : 0;
                            var end = mRange[2] ? parseInt(mRange[2], 10) : (totalSize - 1);
                            if (start >= totalSize || end >= totalSize || start > end) {
                                res.writeHead(416, { 'Content-Range': 'bytes */' + totalSize });
                                res.end();
                                return;
                            }
                            var chunkLen = (end - start) + 1;
                            res.writeHead(206, {
                                'Content-Range': 'bytes ' + start + '-' + end + '/' + totalSize,
                                'Accept-Ranges': 'bytes',
                                'Content-Length': String(chunkLen),
                                'Content-Type': 'video/mp2t',
                                'Cache-Control': 'no-store'
                            });
                            if (req.method === 'HEAD') {
                                res.end();
                                return;
                            }
                            fs.createReadStream(playFileFull, { start: start, end: end }).pipe(res);
                            return;
                        }
                    }
                    res.writeHead(200, {
                        'Accept-Ranges': 'bytes',
                        'Content-Length': String(totalSize),
                        'Content-Type': 'video/mp2t',
                        'Cache-Control': 'no-store'
                    });
                    if (req.method === 'HEAD') {
                        res.end();
                        return;
                    }
                    fs.createReadStream(playFileFull).pipe(res);
                });
                return;
            }
            if (recAction === 'stop') {
                var stoppedSess = stopActiveRecordingSession();
                res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
                res.end(JSON.stringify({
                    active: false,
                    stopped: Boolean(stoppedSess),
                    file: stoppedSess ? stoppedSess.filePath : '',
                    fileName: stoppedSess ? (stoppedSess.fileName || '') : '',
                    bytes: stoppedSess ? stoppedSess.bytes : 0,
                    elapsedSec: stoppedSess ? Math.max(1, Math.round((stoppedSess.stoppedAt - stoppedSess.startedAt) / 1000)) : 0
                }));
                return;
            }
            if (recAction === 'start' && parsedUrl.query && parsedUrl.query.url) {
                var recUrl = String(parsedUrl.query.url || '').trim();
                validateSafeUpstreamUrl(recUrl, function(ssrfErr, initialTarget) {
                    if (ssrfErr || !initialTarget) {
                        res.writeHead(403, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: ssrfErr ? ssrfErr.message : 'Blocked recording URL' }));
                        return;
                    }
                    stopActiveRecordingSession();
                    ensureDirSyncSafe(DVR_DIR);
                    pruneOldDvrRecordingsIfNeeded();
                    var rawChName = String(parsedUrl.query.name || 'channel').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 32) || 'channel';
                    var recFileName = 'vortixtv_rec_' + rawChName + '_' + Date.now() + '.ts';
                    var recFilePath = path.join(DVR_DIR, recFileName);
                    var fStream = null;
                    try {
                        fStream = fs.createWriteStream(recFilePath);
                        fStream.on('error', function() {});
                    } catch (eFs) {
                        fStream = null;
                    }
                    var newRecSess = {
                        active: true,
                        url: recUrl,
                        name: rawChName,
                        fileName: recFileName,
                        filePath: recFilePath,
                        startedAt: Date.now(),
                        stoppedAt: 0,
                        bytes: 0,
                        fileStream: fStream,
                        upReq: null
                    };
                    activeRecordingSession = newRecSess;
                    var startRecordingUpstream = function(targetUrlStr, redirectsLeft, prevalidatedTarget) {
                        if (!activeRecordingSession || activeRecordingSession !== newRecSess || redirectsLeft <= 0) {
                            return;
                        }
                        var launchHop = function(safeTarget) {
                            if (!activeRecordingSession || activeRecordingSession !== newRecSess) {
                                return;
                            }
                            var isRecHttps = safeTarget.protocol === 'https:';
                            var recClient = isRecHttps ? https : http;
                            var isRecVod = /\.(?:mkv|mp4|avi|mov)(?:\?|$)/i.test(safeTarget.path || '') ||
                                /\/(?:movie|series)\//i.test(safeTarget.path || '');
                            var recHeaders = {
                                'User-Agent': isRecVod ? VLC_UA : MAG_UA,
                                'Accept': '*/*',
                                'Connection': 'keep-alive',
                                'Host': safeTarget.host
                            };
                            var recCookie = getHostCookieHeader(safeTarget.hostname, '', lastActiveMac);
                            if (recCookie) {
                                recHeaders.Cookie = recCookie;
                            }
                            if (lastPortalReferer && !isRecVod) {
                                recHeaders.Referer = lastPortalReferer;
                            }
                            var recUpReq = recClient.request({
                                hostname: safeTarget.resolvedIp || safeTarget.hostname,
                                port: safeTarget.port,
                                path: safeTarget.path,
                                method: 'GET',
                                headers: recHeaders,
                                servername: safeTarget.hostname,
                                agent: isRecHttps ? httpsAgent : httpAgent,
                                timeout: 20000,
                                rejectUnauthorized: false
                            }, function(recRes) {
                                if (recRes.headers && recRes.headers['set-cookie']) {
                                    storeSetCookies(safeTarget.hostname, recRes.headers['set-cookie'], lastActiveMac);
                                }
                                if (recRes.statusCode >= 300 && recRes.statusCode < 400 && recRes.headers.location && redirectsLeft > 1) {
                                    var nextRecUrl = url.resolve(targetUrlStr, recRes.headers.location);
                                    recRes.resume();
                                    startRecordingUpstream(nextRecUrl, redirectsLeft - 1, null);
                                    return;
                                }
                                if (recRes.statusCode && recRes.statusCode >= 400) {
                                    recRes.resume();
                                    if (activeRecordingSession === newRecSess) {
                                        stopActiveRecordingSession();
                                    }
                                    return;
                                }
                                recRes.on('data', function(chunk) {
                                    if (!activeRecordingSession || activeRecordingSession !== newRecSess) {
                                        return;
                                    }
                                    var bChunk = Buffer.isBuffer(chunk) ? chunk : allocBufferUtf8(chunk);
                                    newRecSess.bytes += bChunk.length;
                                    if (newRecSess.fileStream) {
                                        try {
                                            newRecSess.fileStream.write(bChunk);
                                        } catch (eWr) {}
                                    }
                                    if (newRecSess.bytes >= 262144000 || (Date.now() - newRecSess.startedAt) >= 1800000) {
                                        stopActiveRecordingSession();
                                    }
                                });
                                recRes.on('end', function() {
                                    if (activeRecordingSession === newRecSess) {
                                        stopActiveRecordingSession();
                                    }
                                });
                                recRes.on('error', function() {
                                    if (activeRecordingSession === newRecSess) {
                                        stopActiveRecordingSession();
                                    }
                                });
                            });
                            recUpReq.on('socket', function(sock) {
                                guardUpstreamSocketLookup(sock, recUpReq);
                            });
                            recUpReq.on('timeout', function() {
                                try {
                                    recUpReq.abort();
                                } catch (eRecTo) {}
                                if (activeRecordingSession === newRecSess) {
                                    stopActiveRecordingSession();
                                }
                            });
                            recUpReq.on('error', function() {
                                if (activeRecordingSession === newRecSess) {
                                    stopActiveRecordingSession();
                                }
                            });
                            recUpReq.end();
                            newRecSess.upReq = recUpReq;
                        };
                        if (prevalidatedTarget) {
                            launchHop(prevalidatedTarget);
                        } else {
                            validateSafeUpstreamUrl(targetUrlStr, function(hopErr, hopTarget) {
                                if (hopErr || !hopTarget) {
                                    if (activeRecordingSession === newRecSess) {
                                        stopActiveRecordingSession();
                                    }
                                    return;
                                }
                                launchHop(hopTarget);
                            });
                        }
                    };
                    startRecordingUpstream(recUrl, 5, initialTarget);
                    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
                    res.end(JSON.stringify({
                        active: true,
                        file: recFilePath,
                        fileName: recFileName,
                        bytes: 0,
                        elapsedSec: 0
                    }));
                });
                return;
            }
            var curRec = activeRecordingSession;
            res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
            res.end(JSON.stringify({
                active: Boolean(curRec && curRec.active),
                file: curRec ? curRec.filePath : '',
                fileName: curRec ? (curRec.fileName || '') : '',
                bytes: curRec ? curRec.bytes : 0,
                elapsedSec: (curRec && curRec.active) ? Math.max(0, Math.round((Date.now() - curRec.startedAt) / 1000)) : 0
            }));
            return;
        }

        if (parsedUrl.pathname === '/vod-resolve' && ((parsedUrl.query && parsedUrl.query.url) || req.headers['x-target-url'])) {
            var rawVodUrl = String((parsedUrl.query && parsedUrl.query.url) || req.headers['x-target-url'] || '').trim();
            var customVodUa = String((parsedUrl.query && parsedUrl.query.ua) || req.headers['x-vod-ua'] || VLC_UA).trim();
            var customVodRef = String((parsedUrl.query && parsedUrl.query.referer) || req.headers['x-vod-referer'] || lastPortalReferer || '').trim();
            var customVodCookie = String((parsedUrl.query && parsedUrl.query.cookie) || req.headers['x-vod-cookie'] || '').trim();
            var resolveDone = false;
            var sendResolveResult = function(payload) {
                if (resolveDone) {
                    return;
                }
                resolveDone = true;
                if (!res.headersSent) {
                    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
                }
                try {
                    res.end(JSON.stringify(payload));
                } catch (eResEnd) {}
            };
            (function followVodRedirect(candidateUrl, hopsLeft) {
                if (resolveDone) {
                    return;
                }
                if (hopsLeft <= 0) {
                    sendResolveResult({ ok: true, finalUrl: candidateUrl, redirected: candidateUrl !== rawVodUrl, status: 200 });
                    return;
                }
                validateSafeUpstreamUrl(candidateUrl, function(ssrfErr, safeTarget) {
                    if (ssrfErr || !safeTarget) {
                        sendResolveResult({ ok: false, finalUrl: rawVodUrl, error: ssrfErr ? ssrfErr.message : 'Blocked URL' });
                        return;
                    }
                    var isHttpsVod = safeTarget.protocol === 'https:';
                    var vClient = isHttpsVod ? https : http;
                    var vHeaders = {
                        'User-Agent': customVodUa || VLC_UA,
                        'Accept': '*/*',
                        'Range': 'bytes=0-0',
                        'Connection': 'keep-alive',
                        'Host': safeTarget.host
                    };
                    if (customVodRef) {
                        vHeaders.Referer = customVodRef;
                    }
                    if (customVodCookie) {
                        vHeaders.Cookie = customVodCookie;
                    }
                    var vReq = vClient.request({
                        hostname: safeTarget.resolvedIp || safeTarget.hostname,
                        port: safeTarget.port,
                        path: safeTarget.path,
                        method: 'GET',
                        headers: vHeaders,
                        servername: safeTarget.hostname,
                        agent: isHttpsVod ? httpsAgent : httpAgent,
                        timeout: 3200,
                        rejectUnauthorized: false
                    }, function(vRes) {
                        var sc = Number(vRes.statusCode) || 200;
                        if ([301, 302, 303, 307, 308].indexOf(sc) !== -1 && vRes.headers && vRes.headers.location) {
                            var nextLoc = url.resolve(candidateUrl, vRes.headers.location);
                            try {
                                vRes.destroy();
                            } catch (eD1) {}
                            followVodRedirect(nextLoc, hopsLeft - 1);
                            return;
                        }
                        var cType = String((vRes.headers && vRes.headers['content-type']) || '');
                        var aRanges = String((vRes.headers && vRes.headers['accept-ranges']) || '');
                        try {
                            vRes.destroy();
                        } catch (eD2) {}
                        sendResolveResult({
                            ok: sc < 400,
                            finalUrl: candidateUrl,
                            redirected: candidateUrl !== rawVodUrl,
                            status: sc,
                            contentType: cType,
                            acceptRanges: aRanges || 'bytes'
                        });
                    });
                    vReq.on('timeout', function() {
                        try {
                            vReq.abort();
                        } catch (eVt) {}
                        sendResolveResult({ ok: true, finalUrl: candidateUrl, redirected: candidateUrl !== rawVodUrl, status: 0 });
                    });
                    vReq.on('error', function() {
                        sendResolveResult({ ok: true, finalUrl: candidateUrl, redirected: candidateUrl !== rawVodUrl, status: 0 });
                    });
                    vReq.end();
                });
            })(rawVodUrl, 5);
            return;
        }

        if (parsedUrl.pathname === '/trailer-embed') {
            var embedVid = String((parsedUrl.query && parsedUrl.query.v) || '').trim();
            var embedAltsRaw = String((parsedUrl.query && parsedUrl.query.alts) || '').trim();
            var embedTitle = String((parsedUrl.query && parsedUrl.query.title) || 'Official Trailer').slice(0, 120);
            if (!/^[a-zA-Z0-9_-]{11}$/.test(embedVid)) {
                res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
                res.end('<!DOCTYPE html><html><body style="background:#04070f;color:#e2e8f0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div>Invalid trailer video ID. Press GREEN to search in Samsung YouTube TV App.</div></body></html>');
                return;
            }
            var altList = [];
            var rawParts = embedAltsRaw ? embedAltsRaw.split(',') : [];
            for (var ai = 0; ai < rawParts.length; ai++) {
                var candidateId = String(rawParts[ai] || '').trim();
                if (/^[a-zA-Z0-9_-]{11}$/.test(candidateId) && candidateId !== embedVid && altList.indexOf(candidateId) === -1) {
                    altList.push(candidateId);
                }
            }
            var allIds = [embedVid].concat(altList).slice(0, 5);
            var originHost = 'http://' + (req.headers.host || ('127.0.0.1:' + activeListenPort));
            var safeTitleHtml = embedTitle.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            var embedHtml = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + safeTitleHtml + '</title>' +
                '<style>html,body,#player-wrap,#yt-frame{margin:0;padding:0;width:100%;height:100%;background:transparent !important;background-color:transparent !important;overflow:visible;font-family:sans-serif;color:#e2e8f0;}' +
                '#fallback-msg{display:none;position:absolute;inset:0;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:32px;background:#070b14;}' +
                '#fallback-msg.visible{display:flex;}' +
                '.title{font-size:22px;font-weight:700;margin-bottom:10px;color:#f8fafc;}' +
                '.sub{font-size:16px;color:#94a3b8;max-width:620px;line-height:1.5;}</style></head><body>' +
                '<div id="player-wrap"><iframe id="yt-frame" allowtransparency="true" src="https://www.youtube.com/embed/' + encodeURIComponent(allIds[0]) +
                '?autoplay=1&rel=0&modestbranding=1&playsinline=1&enablejsapi=1&origin=' + encodeURIComponent(originHost) +
                '" title="' + safeTitleHtml + '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen style="border:0;width:100%;height:100%;display:block;background:transparent !important;"></iframe></div>' +
                '<div id="fallback-msg"><div class="title">Embedded playback unavailable for this trailer</div>' +
                '<div class="sub" id="fallback-detail">The video owner disabled embedded playback. Press <b>GREEN</b> to launch the Native Samsung YouTube TV App, or <b>BACK</b> to close.</div></div>' +
                '<script>' +
                'var ids=' + JSON.stringify(allIds) + ';var idx=0;var ytPlayer=null;' +
                'function tryNextCandidate(errCode){' +
                '  idx++;' +
                '  if(idx<ids.length){' +
                '    if(ytPlayer&&typeof ytPlayer.loadVideoById==="function"){ytPlayer.loadVideoById(ids[idx]);}' +
                '    else{var f=document.getElementById("yt-frame");if(f){f.src="https://www.youtube.com/embed/"+encodeURIComponent(ids[idx])+"?autoplay=1&rel=0&modestbranding=1&playsinline=1&enablejsapi=1&origin="+encodeURIComponent(' + JSON.stringify(originHost) + ');}}' +
                '    return;' +
                '  }' +
                '  var m=document.getElementById("fallback-msg");var d=document.getElementById("fallback-detail");' +
                '  if(d&&errCode){d.innerHTML="YouTube error "+String(errCode)+" (embedding blocked by studio). Press <b>GREEN</b> to watch in the Native Samsung YouTube TV App, or <b>BACK</b> to return.";}' +
                '  if(m){m.className="visible";}' +
                '}' +
                'window.onYouTubeIframeAPIReady=function(){' +
                '  try{ytPlayer=new YT.Player("yt-frame",{events:{onError:function(ev){tryNextCandidate(ev&&ev.data);}}});}catch(e){}' +
                '};' +
                'var s=document.createElement("script");s.src="https://www.youtube.com/iframe_api";s.async=true;document.head.appendChild(s);' +
                '</script></body></html>';
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
            res.end(embedHtml);
            return;
        }

        if (parsedUrl.pathname === '/trailer-search') {
            var rawQuery = String((parsedUrl.query && parsedUrl.query.q) || '').trim();
            var mediaTypeHint = String((parsedUrl.query && parsedUrl.query.type) || '').toLowerCase();
            var yearHint = String((parsedUrl.query && parsedUrl.query.year) || '').replace(/[^0-9]/g, '').slice(0, 4);
            if (!rawQuery) {
                res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
                res.end(JSON.stringify({ ok: false, videoId: '', candidates: [], error: 'Missing trailer search query' }));
                return;
            }
            var normQ = (rawQuery + '|' + mediaTypeHint + '|' + yearHint).toLowerCase().slice(0, 150);
            if (trailerSearchCache[normQ] && trailerSearchCache[normQ].videoId) {
                res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
                res.end(JSON.stringify({
                    ok: true,
                    videoId: trailerSearchCache[normQ].videoId,
                    candidates: trailerSearchCache[normQ].candidates || [trailerSearchCache[normQ].videoId],
                    title: trailerSearchCache[normQ].title || '',
                    cached: true
                }));
                return;
            }

            var parseDurationSec = function(lenText) {
                var s = String(lenText || '').trim();
                if (!s) {
                    return 0;
                }
                var parts = s.split(':');
                var total = 0;
                for (var pi = 0; pi < parts.length; pi++) {
                    var n = parseInt(parts[pi], 10);
                    if (isNaN(n)) {
                        return 0;
                    }
                    total = (total * 60) + n;
                }
                return total;
            };

            var extractYtInitialDataJson = function(htmlStr) {
                var markers = ['var ytInitialData = ', 'window["ytInitialData"] = ', "window['ytInitialData'] = "];
                for (var mi = 0; mi < markers.length; mi++) {
                    var startMarker = markers[mi];
                    var idx = htmlStr.indexOf(startMarker);
                    if (idx === -1) {
                        continue;
                    }
                    var jsonStart = htmlStr.indexOf('{', idx + startMarker.length);
                    if (jsonStart === -1) {
                        continue;
                    }
                    var depth = 0;
                    var inStr = false;
                    var escaped = false;
                    for (var ci = jsonStart; ci < htmlStr.length; ci++) {
                        var ch = htmlStr.charAt(ci);
                        if (inStr) {
                            if (escaped) {
                                escaped = false;
                            } else if (ch === '\\') {
                                escaped = true;
                            } else if (ch === '"') {
                                inStr = false;
                            }
                        } else {
                            if (ch === '"') {
                                inStr = true;
                            } else if (ch === '{') {
                                depth++;
                            } else if (ch === '}') {
                                depth--;
                                if (depth === 0) {
                                    try {
                                        return JSON.parse(htmlStr.slice(jsonStart, ci + 1));
                                    } catch (eJson) {
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
                return null;
            };

            var collectCandidatesFromYtData = function(rootObj) {
                var found = [];
                var seenIds = {};
                var walkNode = function(node, inAdOrShort) {
                    if (!node || typeof node !== 'object' || found.length >= 25) {
                        return;
                    }
                    if (node.reelShelfRenderer || node.reelItemRenderer || node.shortsLockupViewModel || node.adSlotRenderer || node.promotedVideoRenderer) {
                        return;
                    }
                    if (node.videoRenderer && node.videoRenderer.videoId) {
                        var vr = node.videoRenderer;
                        var vid = String(vr.videoId || '').trim();
                        if (/^[a-zA-Z0-9_-]{11}$/.test(vid) && !seenIds[vid]) {
                            var navUrl = (vr.navigationEndpoint && vr.navigationEndpoint.commandMetadata && vr.navigationEndpoint.commandMetadata.webCommandMetadata && vr.navigationEndpoint.commandMetadata.webCommandMetadata.url) || '';
                            var isShortUrl = navUrl.indexOf('/shorts/') !== -1;
                            var lenText = (vr.lengthText && vr.lengthText.simpleText) || '';
                            var durSec = parseDurationSec(lenText);
                            var titleText = '';
                            if (vr.title && Array.isArray(vr.title.runs)) {
                                for (var tr = 0; tr < vr.title.runs.length; tr++) {
                                    titleText += (vr.title.runs[tr].text || '');
                                }
                            } else if (vr.title && vr.title.simpleText) {
                                titleText = vr.title.simpleText;
                            }
                            var chanText = '';
                            if (vr.ownerText && Array.isArray(vr.ownerText.runs) && vr.ownerText.runs[0]) {
                                chanText = vr.ownerText.runs[0].text || '';
                            }
                            if (!isShortUrl && !inAdOrShort) {
                                seenIds[vid] = true;
                                found.push({
                                    id: vid,
                                    title: String(titleText || '').trim(),
                                    channel: String(chanText || '').trim(),
                                    durationSec: durSec,
                                    durationText: lenText
                                });
                            }
                        }
                        return;
                    }
                    if (Array.isArray(node)) {
                        for (var ai = 0; ai < node.length; ai++) {
                            walkNode(node[ai], inAdOrShort);
                        }
                    } else {
                        var keys = Object.keys(node);
                        for (var ki = 0; ki < keys.length; ki++) {
                            walkNode(node[keys[ki]], inAdOrShort);
                        }
                    }
                };
                walkNode(rootObj, false);
                return found;
            };

            var scoreCandidate = function(cand, queryStr, isSeriesHint, yrHint) {
                var titleLow = String(cand.title || '').toLowerCase();
                var chanLow = String(cand.channel || '').toLowerCase();
                var score = 0;
                var tokens = String(queryStr || '').toLowerCase()
                    .replace(/\b(official|trailer|teaser|tv|series|movie|hd|4k)\b/g, ' ')
                    .replace(/[^a-z0-9\u00C0-\u024F\s]/g, ' ')
                    .split(/\s+/);
                var matchedTokens = 0;
                var totalTokens = 0;
                for (var ti = 0; ti < tokens.length; ti++) {
                    var tok = tokens[ti];
                    if (tok.length >= 2) {
                        totalTokens++;
                        if (titleLow.indexOf(tok) !== -1) {
                            matchedTokens++;
                        }
                    }
                }
                if (totalTokens > 0) {
                    score += Math.round((matchedTokens / totalTokens) * 45);
                }
                if (titleLow.indexOf('official trailer') !== -1 || titleLow.indexOf('main trailer') !== -1) {
                    score += 35;
                } else if (titleLow.indexOf('trailer') !== -1) {
                    score += 22;
                } else if (titleLow.indexOf('teaser') !== -1) {
                    score += 14;
                }
                if (yrHint && titleLow.indexOf(yrHint) !== -1) {
                    score += 12;
                }
                if (isSeriesHint && /\b(season|series|tv|netflix|hbo|max|apple tv|prime video|hulu|fx|amc|showtime)\b/.test(titleLow + ' ' + chanLow)) {
                    score += 12;
                }
                if (/\b(rotten tomatoes|warner bros|universal pictures|sony pictures|paramount|marvel|disney|a24|netflix|hbo|lionsgate|20th century|focus features|searchlight|mgm|apple tv|prime video)\b/.test(chanLow)) {
                    score += 15;
                }
                if (cand.durationSec >= 35 && cand.durationSec <= 270) {
                    score += 20;
                } else if (cand.durationSec > 600) {
                    score -= 45;
                } else if (cand.durationSec > 0 && cand.durationSec < 15) {
                    score -= 35;
                }
                if (/\b(reaction|review|explained|ending explained|breakdown|full movie|soundtrack|ost|pitch meeting|honest trailers|parody|recap|gameplay)\b/.test(titleLow)) {
                    score -= 45;
                }
                return score;
            };

            var checkOembed = function(vid, cb) {
                var done = false;
                var finish = function(ok) {
                    if (!done) {
                        done = true;
                        cb(ok);
                    }
                };
                var oReq = https.request({
                    hostname: 'www.youtube.com',
                    port: 443,
                    path: '/oembed?url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + vid) + '&format=json',
                    method: 'GET',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    },
                    timeout: 2200,
                    rejectUnauthorized: false
                }, function(oRes) {
                    oRes.resume();
                    finish(oRes.statusCode === 200);
                });
                oReq.on('timeout', function() {
                    try { oReq.abort(); } catch (eO) {}
                    finish(false);
                });
                oReq.on('error', function() {
                    finish(false);
                });
                oReq.end();
            };

            var ytSearchPath = '/results?search_query=' + encodeURIComponent(rawQuery);
            var ytDone = false;
            var finishYtResult = function(ok, videoId, candidates, titleText, errMsg) {
                if (ytDone) {
                    return;
                }
                ytDone = true;
                var validId = (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) ? videoId : '';
                if (ok && validId) {
                    var cacheKeys = Object.keys(trailerSearchCache);
                    if (cacheKeys.length >= 120) {
                        delete trailerSearchCache[cacheKeys[0]];
                    }
                    trailerSearchCache[normQ] = {
                        videoId: validId,
                        candidates: candidates || [validId],
                        title: titleText || ''
                    };
                }
                if (!res.headersSent) {
                    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
                }
                try {
                    res.end(JSON.stringify({
                        ok: Boolean(ok && validId),
                        videoId: validId,
                        candidates: candidates || (validId ? [validId] : []),
                        title: titleText || '',
                        query: rawQuery,
                        error: (!ok || !validId) ? (errMsg || 'No matching trailer found') : undefined
                    }));
                } catch (eYtEnd) {}
            };

            var ytReq = https.request({
                hostname: 'www.youtube.com',
                port: 443,
                path: ytSearchPath,
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate',
                    'Cookie': 'CONSENT=PENDING+987; SOCS=CAI'
                },
                timeout: 6500,
                rejectUnauthorized: false
            }, function(ytRes) {
                var ytParts = [];
                var ytLen = 0;
                ytRes.on('data', function(c) {
                    var b = Buffer.isBuffer(c) ? c : allocBufferUtf8(c);
                    if (ytLen < 3145728) {
                        ytLen += b.length;
                        ytParts.push(b);
                    }
                });
                ytRes.on('end', function() {
                    var rawBuf = Buffer.concat(ytParts);
                    ytParts = [];
                    decodeBufferByEncoding(rawBuf, ytRes.headers && ytRes.headers['content-encoding'], function(decodedBuf) {
                        var htmlStr = decodedBuf.toString('utf8');
                        var parsedData = extractYtInitialDataJson(htmlStr);
                        var candidates = parsedData ? collectCandidatesFromYtData(parsedData) : [];
                        if (candidates.length === 0) {
                            var reVid = /"videoRenderer":\{"videoId":"([a-zA-Z0-9_-]{11})"/g;
                            var mFallback;
                            var seenFallback = {};
                            while ((mFallback = reVid.exec(htmlStr)) !== null && candidates.length < 10) {
                                if (!seenFallback[mFallback[1]]) {
                                    seenFallback[mFallback[1]] = true;
                                    candidates.push({ id: mFallback[1], title: '', channel: '', durationSec: 0, durationText: '' });
                                }
                            }
                        }
                        if (candidates.length === 0) {
                            finishYtResult(false, '', [], '', 'YouTube search returned no video candidates');
                            return;
                        }
                        var isSer = (mediaTypeHint === 'series');
                        for (var si = 0; si < candidates.length; si++) {
                            candidates[si].score = scoreCandidate(candidates[si], rawQuery, isSer, yearHint);
                        }
                        candidates.sort(function(a, b) {
                            return b.score - a.score;
                        });
                        var topSlice = candidates.slice(0, 5);
                        var rankedIds = [];
                        for (var ri = 0; ri < topSlice.length; ri++) {
                            rankedIds.push(topSlice[ri].id);
                        }
                        var probeIdx = 0;
                        var tryVerifyNext = function() {
                            if (probeIdx >= Math.min(3, topSlice.length)) {
                                finishYtResult(true, topSlice[0].id, rankedIds, topSlice[0].title, '');
                                return;
                            }
                            var cand = topSlice[probeIdx++];
                            checkOembed(cand.id, function(embedOk) {
                                if (embedOk) {
                                    var ordered = [cand.id];
                                    for (var oi = 0; oi < rankedIds.length; oi++) {
                                        if (rankedIds[oi] !== cand.id) {
                                            ordered.push(rankedIds[oi]);
                                        }
                                    }
                                    finishYtResult(true, cand.id, ordered, cand.title, '');
                                } else {
                                    tryVerifyNext();
                                }
                            });
                        };
                        tryVerifyNext();
                    });
                });
                ytRes.on('error', function() {
                    ytParts = [];
                    finishYtResult(false, '', [], '', 'YouTube search stream error');
                });
            });
            ytReq.on('timeout', function() {
                try {
                    ytReq.abort();
                } catch (eYtTo) {}
                finishYtResult(false, '', [], '', 'YouTube search timed out');
            });
            ytReq.on('error', function() {
                finishYtResult(false, '', [], '', 'YouTube search request failed');
            });
            ytReq.end();
            return;
        }

        if ((parsedUrl.pathname === '/xtream' || parsedUrl.pathname === '/m3u' || parsedUrl.pathname === '/xmltv') && ((parsedUrl.query && parsedUrl.query.url) || req.headers['x-target-url'])) {
            var rawTargetUrl = String((parsedUrl.query && parsedUrl.query.url) || req.headers['x-target-url'] || '').trim();
            var isTextRoute = (parsedUrl.pathname === '/m3u' || parsedUrl.pathname === '/xmltv');
            var remoteDone = false;
            var currentRemoteReq = null;
            var abortRemoteCatalogFn = function() {
                remoteDone = true;
                if (currentRemoteReq) {
                    try {
                        currentRemoteReq.abort();
                    } catch (eAbRem) {}
                    currentRemoteReq = null;
                }
                if (!res.headersSent) {
                    try {
                        res.writeHead(499, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Profile switched — request aborted' }));
                    } catch (eResAb) {}
                }
            };
            registerCatalogAbort(abortRemoteCatalogFn);
            var sendRemoteError = function(statusCode, errMsg) {
                unregisterCatalogAbort(abortRemoteCatalogFn);
                if (remoteDone) {
                    return;
                }
                remoteDone = true;
                if (!res.headersSent) {
                    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
                }
                try {
                    res.end(JSON.stringify({ error: String(errMsg || 'Proxy error') }));
                } catch (eEnd) {}
            };
            req.on('close', function() {
                unregisterCatalogAbort(abortRemoteCatalogFn);
                remoteDone = true;
                if (currentRemoteReq) {
                    try {
                        currentRemoteReq.abort();
                    } catch (eClose) {}
                }
            });
            (function fetchRemoteWithRedirects(targetUrlStr, redirectsLeft) {
                if (remoteDone) {
                    return;
                }
                if (redirectsLeft <= 0) {
                    sendRemoteError(502, 'Too many redirects');
                    return;
                }
                validateSafeUpstreamUrl(targetUrlStr, function(ssrfErr, safeTarget) {
                    if (remoteDone) {
                        return;
                    }
                    if (ssrfErr || !safeTarget) {
                        sendRemoteError(403, ssrfErr ? ssrfErr.message : 'Blocked target URL');
                        return;
                    }
                    var isHttpsTarget = safeTarget.protocol === 'https:';
                    var hClient = isHttpsTarget ? https : http;
                    var rReq = hClient.request({
                        hostname: safeTarget.resolvedIp || safeTarget.hostname,
                        port: safeTarget.port,
                        path: safeTarget.path,
                        method: 'GET',
                        headers: {
                            'User-Agent': isTextRoute ? VLC_UA : MAG_UA,
                            'Accept': '*/*',
                            'Accept-Encoding': 'gzip, deflate',
                            'Host': safeTarget.host
                        },
                        servername: safeTarget.hostname,
                        agent: isHttpsTarget ? httpsAgent : httpAgent,
                        timeout: 35000,
                        rejectUnauthorized: false
                    }, function(rRes) {
                        if ([301, 302, 303, 307, 308].indexOf(rRes.statusCode) !== -1 && rRes.headers.location) {
                            rRes.resume();
                            fetchRemoteWithRedirects(url.resolve(targetUrlStr, rRes.headers.location), redirectsLeft - 1);
                            return;
                        }
                        var rChunks = [];
                        var totalLen = 0;
                        rRes.on('data', function(c) {
                            if (remoteDone) {
                                rChunks = [];
                                try {
                                    rReq.abort();
                                } catch (eChunkAb) {}
                                return;
                            }
                            var bufC = Buffer.isBuffer(c) ? c : allocBufferUtf8(c);
                            totalLen += bufC.length;
                            if (totalLen <= 67108864) {
                                rChunks.push(bufC);
                            }
                        });
                        rRes.on('end', function() {
                            unregisterCatalogAbort(abortRemoteCatalogFn);
                            if (remoteDone) {
                                rChunks = [];
                                return;
                            }
                            var bodyBuf = Buffer.concat(rChunks);
                            rChunks = [];
                            decodeBufferByEncoding(bodyBuf, rRes.headers['content-encoding'], function(decodedBuf) {
                                var finalBuf = decodedBuf || bodyBuf;
                                bodyBuf = null;
                                if (remoteDone) {
                                    return;
                                }
                                remoteDone = true;
                                if (!res.headersSent) {
                                    res.writeHead(rRes.statusCode || 200, {
                                        'Content-Type': isTextRoute ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
                                        'Cache-Control': 'no-store'
                                    });
                                }
                                res.end(finalBuf);
                            });
                        });
                        rRes.on('error', function(zErr) {
                            rChunks = [];
                            sendRemoteError(502, zErr ? zErr.message : 'Upstream response error');
                        });
                    });
                    rReq.on('socket', function(sock) {
                        guardUpstreamSocketLookup(sock, rReq);
                    });
                    currentRemoteReq = rReq;
                    rReq.on('error', function(eReq) {
                        sendRemoteError(502, eReq ? eReq.message : 'Upstream connection error');
                    });
                    rReq.on('timeout', function() {
                        sendRemoteError(504, 'Upstream timeout');
                        try {
                            rReq.abort();
                        } catch (eTimeout) {}
                    });
                    rReq.end();
                });
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
        var isHandshakeReq = String(targetSearch || '').indexOf('action=handshake') !== -1;
        if (isHandshakeReq) {
            clearCookieScopeForPortal(portal, mac);
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
            useFreshSocket: isHandshakeReq,
            aborted: false,
            onAbort: function(fn) {
                activeAbortFn = fn;
            }
        };
        var abortStalkerCatalogFn = function() {
            reqStateObj.aborted = true;
            if (typeof activeAbortFn === 'function') {
                activeAbortFn();
            }
            if (!res.headersSent) {
                try {
                    res.writeHead(499, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Profile switched — request aborted' }));
                } catch (eStAb) {}
            }
        };
        registerCatalogAbort(abortStalkerCatalogFn);
        req.on('close', function() {
            unregisterCatalogAbort(abortStalkerCatalogFn);
            reqStateObj.aborted = true;
            if (typeof activeAbortFn === 'function') {
                activeAbortFn();
            }
        });
        requestWithFallback(reqStateObj, function(err, result) {
            unregisterCatalogAbort(abortStalkerCatalogFn);
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
    server.on('connection', function(sock) {
        if (sock && typeof sock.setNoDelay === 'function') {
            try {
                sock.setNoDelay(true);
            } catch (eNd) {}
        }
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
    isLoopbackClient: isLoopbackClient,
    isBlockedUpstreamIp: isBlockedUpstreamIp,
    sanitizeDvrFileName: sanitizeDvrFileName,
    sniffStreamPayload: sniffStreamPayload,
    computeStreamDiagnosticVerdict: computeStreamDiagnosticVerdict,
    getPairingPin: function() {
        return currentPairingPin;
    },
    getDataDir: function() {
        return DATA_DIR;
    },
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
