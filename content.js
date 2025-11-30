// No-PostHog - With decompression support for proxied requests
(function() {
    // Check if logging is enabled (stored in localStorage)
    function isLoggingEnabled() {
        try {
            return localStorage.getItem('noPosthogLogging') !== 'false';
        } catch (e) {
            return true;
        }
    }
    
    function log(...args) {
        if (isLoggingEnabled()) {
            console.log(...args);
        }
    }
    
    log('[No-PostHog] Active (with decompression)');

    // LZ-String decompression (from lz-string library, minified)
    const LZString = (function() {
        const keyStrBase64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
        const baseReverseDic = {};
        
        function getBaseValue(alphabet, character) {
            if (!baseReverseDic[alphabet]) {
                baseReverseDic[alphabet] = {};
                for (let i = 0; i < alphabet.length; i++) {
                    baseReverseDic[alphabet][alphabet.charAt(i)] = i;
                }
            }
            return baseReverseDic[alphabet][character];
        }
        
        function _decompress(length, resetValue, getNextValue) {
            const dictionary = [];
            let enlargeIn = 4, dictSize = 4, numBits = 3;
            let entry = "", result = [], w, bits, resb, maxpower, power, c;
            let data = { val: getNextValue(0), position: resetValue, index: 1 };
            
            for (let i = 0; i < 3; i++) dictionary[i] = i;
            
            bits = 0; maxpower = Math.pow(2, 2); power = 1;
            while (power != maxpower) {
                resb = data.val & data.position;
                data.position >>= 1;
                if (data.position == 0) { data.position = resetValue; data.val = getNextValue(data.index++); }
                bits |= (resb > 0 ? 1 : 0) * power;
                power <<= 1;
            }
            
            switch (bits) {
                case 0: bits = 0; maxpower = Math.pow(2, 8); power = 1;
                    while (power != maxpower) {
                        resb = data.val & data.position;
                        data.position >>= 1;
                        if (data.position == 0) { data.position = resetValue; data.val = getNextValue(data.index++); }
                        bits |= (resb > 0 ? 1 : 0) * power;
                        power <<= 1;
                    }
                    c = String.fromCharCode(bits); break;
                case 1: bits = 0; maxpower = Math.pow(2, 16); power = 1;
                    while (power != maxpower) {
                        resb = data.val & data.position;
                        data.position >>= 1;
                        if (data.position == 0) { data.position = resetValue; data.val = getNextValue(data.index++); }
                        bits |= (resb > 0 ? 1 : 0) * power;
                        power <<= 1;
                    }
                    c = String.fromCharCode(bits); break;
                case 2: return "";
            }
            dictionary[3] = c; w = c; result.push(c);
            
            while (true) {
                if (data.index > length) return "";
                bits = 0; maxpower = Math.pow(2, numBits); power = 1;
                while (power != maxpower) {
                    resb = data.val & data.position;
                    data.position >>= 1;
                    if (data.position == 0) { data.position = resetValue; data.val = getNextValue(data.index++); }
                    bits |= (resb > 0 ? 1 : 0) * power;
                    power <<= 1;
                }
                
                switch (c = bits) {
                    case 0: bits = 0; maxpower = Math.pow(2, 8); power = 1;
                        while (power != maxpower) {
                            resb = data.val & data.position;
                            data.position >>= 1;
                            if (data.position == 0) { data.position = resetValue; data.val = getNextValue(data.index++); }
                            bits |= (resb > 0 ? 1 : 0) * power;
                            power <<= 1;
                        }
                        dictionary[dictSize++] = String.fromCharCode(bits);
                        c = dictSize - 1; enlargeIn--; break;
                    case 1: bits = 0; maxpower = Math.pow(2, 16); power = 1;
                        while (power != maxpower) {
                            resb = data.val & data.position;
                            data.position >>= 1;
                            if (data.position == 0) { data.position = resetValue; data.val = getNextValue(data.index++); }
                            bits |= (resb > 0 ? 1 : 0) * power;
                            power <<= 1;
                        }
                        dictionary[dictSize++] = String.fromCharCode(bits);
                        c = dictSize - 1; enlargeIn--; break;
                    case 2: return result.join('');
                }
                
                if (enlargeIn == 0) { enlargeIn = Math.pow(2, numBits); numBits++; }
                if (dictionary[c]) { entry = dictionary[c]; }
                else { if (c === dictSize) { entry = w + w.charAt(0); } else { return null; } }
                result.push(entry);
                dictionary[dictSize++] = w + entry.charAt(0);
                enlargeIn--;
                if (enlargeIn == 0) { enlargeIn = Math.pow(2, numBits); numBits++; }
                w = entry;
            }
        }
        
        return {
            decompressFromBase64: function(input) {
                if (input == null || input === "") return null;
                return _decompress(input.length, 32, function(index) {
                    return getBaseValue(keyStrBase64, input.charAt(index));
                });
            }
        };
    })();

    // Decompress gzip using DecompressionStream API
    async function decompressGzip(data) {
        try {
            const ds = new DecompressionStream('gzip');
            const blob = new Blob([data]);
            const decompressedStream = blob.stream().pipeThrough(ds);
            const decompressedBlob = await new Response(decompressedStream).blob();
            return await decompressedBlob.text();
        } catch (e) {
            return null;
        }
    }

    // Check if decompressed data is PostHog payload and extract events
    function isPostHogPayload(str) {
        if (!str || typeof str !== 'string') return false;
        return str.includes('"event"') && str.includes('"properties"') && 
               (str.includes('"$lib"') || str.includes('"distinct_id"') || 
                str.includes('"api_key"') || str.includes('"token"') ||
                str.includes('posthog'));
    }

    // Extract and display event names from payload
    function displayEvents(str) {
        if (!str) return;
        try {
            const data = JSON.parse(str);
            const events = Array.isArray(data) ? data : (data.batch || [data]);
            
            events.forEach(e => {
                if (e.event) {
                    const props = e.properties || {};
                    const info = [
                        `📊 Event: ${e.event}`,
                        props.$current_url ? `   URL: ${props.$current_url}` : '',
                        props.$pathname ? `   Path: ${props.$pathname}` : '',
                        props.distinct_id ? `   User: ${props.distinct_id.substring(0, 20)}...` : '',
                    ].filter(Boolean).join('\n');
                    log(`[No-PostHog] Blocked:\n${info}`);
                }
            });
        } catch (e) {
            // Not valid JSON, just log generic block
        }
    }

    // Try to decompress and check body
    async function checkBody(body, url) {
        if (!body) return false;
        
        try {
            let str = '';
            const compression = url.includes('compression=gzip') ? 'gzip' : 
                               url.includes('compression=lz64') ? 'lz64' : null;
            
            if (typeof body === 'string') {
                if (compression === 'lz64') {
                    // LZ64 compressed base64 string
                    str = LZString.decompressFromBase64(body.replace(/ /g, '+')) || body;
                } else {
                    str = body;
                }
            } else if (body instanceof ArrayBuffer || body instanceof Uint8Array) {
                const bytes = body instanceof ArrayBuffer ? new Uint8Array(body) : body;
                if (compression === 'gzip' || (bytes[0] === 0x1f && bytes[1] === 0x8b)) {
                    // Gzip compressed
                    str = await decompressGzip(bytes) || '';
                } else {
                    str = new TextDecoder().decode(bytes);
                }
            } else if (body instanceof Blob) {
                const buffer = await body.arrayBuffer();
                const bytes = new Uint8Array(buffer);
                if (compression === 'gzip' || (bytes[0] === 0x1f && bytes[1] === 0x8b)) {
                    str = await decompressGzip(bytes) || '';
                } else {
                    str = await body.text();
                }
            } else {
                str = JSON.stringify(body);
            }
            
            if (isPostHogPayload(str)) {
                displayEvents(str);
            return true;
            }
        } catch (e) {
            log('[No-PostHog] Decompress error:', e.message);
        }
        return false;
    }

    // Override fetch
    const origFetch = window.fetch;
    window.fetch = async function(...args) {
        const url = String(args[0]?.url || args[0] || '');
        const body = args[1]?.body;
        
        if (await checkBody(body, url)) {
            log('[No-PostHog] Blocked fetch:', url.substring(0, 80));
            return new Response('{}', { status: 200 });
        }
        return origFetch.apply(this, args);
    };

    // Override XHR (sync check for URL, can't async decompress here easily)
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;
    
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        this._url = String(url || '');
        return origOpen.apply(this, [method, url, ...rest]);
    };
    
    XMLHttpRequest.prototype.send = function(body) {
        const url = this._url || '';
        // Quick sync check for obvious PostHog
        if (url.includes('posthog') || url.includes('/e/?') || url.includes('/batch')) {
            log('[No-PostHog] Blocked XHR:', url.substring(0, 80));
            return;
        }
        // For string bodies, check directly
        if (typeof body === 'string' && isPostHogPayload(body)) {
            log('[No-PostHog] Blocked XHR (payload)');
            return;
        }
        return origSend.call(this, body);
    };

    // Override sendBeacon
    const origBeacon = navigator.sendBeacon?.bind(navigator);
    if (origBeacon) {
        navigator.sendBeacon = function(url, data) {
            const urlStr = String(url || '');
            if (urlStr.includes('posthog') || urlStr.includes('/e/?') || urlStr.includes('/batch')) {
                log('[No-PostHog] Blocked beacon:', urlStr.substring(0, 80));
                return true;
            }
            if (typeof data === 'string' && isPostHogPayload(data)) {
                log('[No-PostHog] Blocked beacon (payload)');
                return true;
            }
            return origBeacon(url, data);
        };
    }

    // Stub window.posthog
    const noop = function() { return this; };
    window.posthog = new Proxy({
        __SV: 1, _i: [],
        people: new Proxy({}, { get: () => noop, set: () => true })
    }, {
        get: (t, p) => p in t ? t[p] : noop,
        set: (t, p, v) => { t[p] = v; return true; }
    });

    log('[No-PostHog] Hooks installed with decompression support');
})();
