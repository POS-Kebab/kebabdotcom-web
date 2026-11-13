// CMS lokal: npm run cms → http://localhost:4321 (hanya bisa dibuka dari laptop ini).
// Mengubah content/site.json & foto di public/img/, pratinjau dist/, lalu "Publikasikan" = git commit + push
// → Cloudflare Workers Builds membangun & menayangkan situs.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join, dirname, extname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { build, render } from '../build.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = join(ROOT, 'content/site.json');
const PORT = Number(process.env.PORT) || 4321;
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.xml': 'application/xml', '.txt': 'text/plain' };
const IMG = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const send = (res, code, body, type = 'application/json') => { res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' }); res.end(type === 'application/json' ? JSON.stringify(body) : body); };
const git = (...a) => { const r = spawnSync('git', a, { cwd: ROOT, encoding: 'utf8' }); return { ok: r.status === 0, out: ((r.stdout || '') + (r.stderr || '')).trim() }; };
/** Berkas statis di dalam folder `base` (tolak ../) */
function serveFile(res, base, rel) {
    const p = normalize(join(base, decodeURIComponent(rel)));
    if (!p.startsWith(base + sep) && p !== base) return send(res, 403, { error: 'Dilarang' });
    const f = existsSync(p) && statSync(p).isDirectory() ? join(p, 'index.html') : p;
    if (!existsSync(f)) return send(res, 404, 'Tidak ditemukan', 'text/plain');
    send(res, 200, readFileSync(f), TYPES[extname(f).toLowerCase()] || 'application/octet-stream');
}
async function body(req, limit = 12e6) {
    let size = 0; const parts = [];
    for await (const ch of req) { size += ch.length; if (size > limit) throw new Error('Data terlalu besar'); parts.push(ch); }
    return JSON.parse(Buffer.concat(parts).toString('utf8') || '{}');
}

const api = {
    'GET /api/content': () => JSON.parse(readFileSync(CONTENT, 'utf8')),
    // Simpan + bangun ulang; bila build gagal (mis. foto hilang) isi lama dikembalikan
    'PUT /api/content': async req => {
        const next = await body(req), old = readFileSync(CONTENT, 'utf8');
        writeFileSync(CONTENT, JSON.stringify(next, null, 2) + '\n');
        try { build(); } catch (e) { writeFileSync(CONTENT, old); build(); throw e; }
        return { ok: true };
    },
    'POST /api/upload': async req => {
        const { name = 'foto', data = '' } = await body(req);
        const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(data);
        if (!m) throw new Error('Hanya foto JPG, PNG, atau WEBP');
        const buf = Buffer.from(m[2], 'base64');
        if (buf.length > 3e6) throw new Error('Foto maksimal 3 MB — perkecil dulu (mis. lebar 1200 px)');
        const base = String(name).replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'foto';
        mkdirSync(join(ROOT, 'public/img/uploads'), { recursive: true });
        const file = `${base}-${randomBytes(3).toString('hex')}${IMG[m[1]]}`;
        writeFileSync(join(ROOT, 'public/img/uploads', file), buf);
        return { path: '/img/uploads/' + file };
    },
    'GET /api/git': () => {
        const remote = git('remote', 'get-url', 'origin');
        const changes = git('status', '--porcelain').out.split('\n').filter(Boolean).filter(l => !/\sdist\//.test(l));
        return { remote: remote.ok ? remote.out : '', changes, last: git('log', '-1', '--format=%h %s (%cr)').out };
    },
    'POST /api/publish': async req => {
        const { message } = await body(req);
        build();
        if (!git('remote', 'get-url', 'origin').ok) throw new Error('Repo belum terhubung ke GitHub (git remote add origin …). Lihat README.');
        const log = [];
        const add = git('add', '-A'); if (!add.ok) throw new Error(add.out);
        const st = git('status', '--porcelain');
        if (st.out) {
            const c = git('commit', '-m', String(message || '').trim() || 'Perbarui isi situs');
            log.push(c.out); if (!c.ok) throw new Error(c.out);
        } else log.push('Tidak ada perubahan baru untuk di-commit.');
        const p = git('push');
        log.push(p.out); if (!p.ok) throw new Error(log.join('\n'));
        return { ok: true, log: log.join('\n') };
    }
};

createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    // Hanya dari laptop ini (cegah halaman web lain memanggil API lokal)
    if (req.method !== 'GET' && req.headers.origin && req.headers.origin !== `http://localhost:${PORT}` && req.headers.origin !== `http://127.0.0.1:${PORT}`) return send(res, 403, { error: 'Asal permintaan ditolak' });
    try {
        const h = api[`${req.method} ${url.pathname}`];
        if (h) return send(res, 200, await h(req));
        if (url.pathname === '/' || url.pathname === '/index.html') return serveFile(res, join(ROOT, 'cms'), 'index.html');
        // Situs lengkap walau mode "segera hadir" menyala (hanya di CMS, tidak ikut ke dist/)
        if (url.pathname === '/preview/' && url.searchParams.has('full')) return send(res, 200, render(JSON.parse(readFileSync(CONTENT, 'utf8'))), TYPES['.html']);
        if (url.pathname.startsWith('/preview/')) return serveFile(res, join(ROOT, 'dist'), url.pathname.slice('/preview/'.length) || 'index.html');
        if (url.pathname === '/preview') { res.writeHead(302, { location: '/preview/' }); return res.end(); }
        // Pratinjau memakai alamat absolut (/style.css, /img/…) → layani dari dist
        return serveFile(res, join(ROOT, 'dist'), url.pathname.slice(1));
    } catch (e) { send(res, 400, { error: e.message }); }
}).listen(PORT, '127.0.0.1', () => {
    try { build(); } catch (e) { console.error('✖ ' + e.message); }
    console.log(`CMS KEBABDOTCOM: http://localhost:${PORT}  (Ctrl+C untuk berhenti)`);
    const open = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', `http://localhost:${PORT}`]] : [process.platform === 'darwin' ? 'open' : 'xdg-open', [`http://localhost:${PORT}`]];
    if (!process.argv.includes('--no-open')) spawnSync(open[0], open[1], { stdio: 'ignore' });
});
