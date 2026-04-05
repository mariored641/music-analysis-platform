/**
 * Quick test: does webmscore work in Node.js 24 with polyfills?
 * Run: node renderer-tests/scripts/test-webmscore.cjs
 */
const fs = require('fs');
const path = require('path');

// Polyfills — must happen BEFORE require('webmscore')
// Node.js 24 makes navigator a read-only getter, webmscore tries to assign it
Object.defineProperty(globalThis, 'navigator', {
  value: globalThis.navigator || {},
  writable: true,
  configurable: true,
});
if (!globalThis.window) globalThis.window = globalThis;

const webmscoreDir = path.dirname(require.resolve('webmscore'));
if (!globalThis.location) {
  globalThis.location = {
    pathname: webmscoreDir.replace(/\\/g, '/') + '/',
    href: 'file:///' + webmscoreDir.replace(/\\/g, '/') + '/',
  };
}

// Patch fetch for file:// and relative paths
const origFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : String(input);
  if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('data:')) {
    let filePath = url;
    if (url.startsWith('file:///')) filePath = url.slice(8);
    else if (url.startsWith('file://')) filePath = url.slice(7);
    if (!path.isAbsolute(filePath)) filePath = path.join(webmscoreDir, filePath);
    console.log('  [fetch] reading:', filePath);
    const buf = fs.readFileSync(filePath);
    return new Response(buf, { status: 200, headers: { 'content-type': 'application/wasm' } });
  }
  return origFetch(input, init);
};

// Polyfill XMLHttpRequest
if (!globalThis.XMLHttpRequest) {
  globalThis.XMLHttpRequest = class {
    constructor() {
      this.status = 0;
      this.response = null;
      this.responseType = '';
      this.readyState = 0;
      this.onload = null;
      this.onerror = null;
      this.onprogress = null;
      this._url = '';
    }
    open(m, u) { this._url = u; }
    send() {
      try {
        let fp = this._url;
        if (!path.isAbsolute(fp)) fp = path.join(webmscoreDir, fp);
        console.log('  [XHR] reading:', fp);
        const buf = fs.readFileSync(fp);
        this.status = 200;
        this.readyState = 4;
        this.response = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
        if (this.onload) this.onload();
      } catch (e) {
        console.error('  [XHR] error:', e.message);
        this.status = 404;
        if (this.onerror) this.onerror(e);
      }
    }
  };
}

const WebMscore = require('webmscore');
WebMscore.ready.then(async () => {
  console.log('webmscore ready');
  const xmlPath = path.join(process.cwd(), 'public/renderer-tests/fixtures/01-noteheads.xml');
  const xmlData = new Uint8Array(fs.readFileSync(xmlPath));
  try {
    const score = await WebMscore.load('xml', xmlData, []);
    console.log('score loaded');
    const mp = await score.measurePositions();
    console.log('measures:', mp.elements.length, 'pageSize:', JSON.stringify(mp.pageSize));
    console.log('first 3 measures:', JSON.stringify(mp.elements.slice(0, 3)));

    try {
      const sp = await score.segmentPositions();
      console.log('segments:', sp.elements.length);
    } catch (e) {
      console.log('segmentPositions FAILED (known WASM issue):', e.message);
    }

    try {
      const svg = await score.saveSvg(0);
      console.log('svg length:', svg.length);
      // Extract all unique class names
      const classes = new Set();
      svg.replace(/class="([^"]+)"/g, (m, c) => { classes.add(c); });
      console.log('SVG classes:', [...classes].sort().join(', '));
      for (const c of classes) {
        const re = new RegExp('class="' + c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"', 'g');
        console.log('  ' + c + ':', (svg.match(re) || []).length);
      }
      // Save full SVG for analysis
      fs.writeFileSync('renderer-tests/reference-data/_test-full.svg', svg);
    } catch (e) {
      console.log('saveSvg FAILED:', e.message);
    }
    await score.destroy();
    console.log('SUCCESS');
  } catch (e) {
    console.error('ERROR:', e.message);
    console.error(e.stack);
  }
}).catch(e => {
  console.error('INIT ERROR:', e);
});
