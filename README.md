# Website KEBABDOTCOM

Landing page ringan (satu halaman statis) di **Cloudflare**: `kebabdotcom.id` & `www.kebabdotcom.id`.
Isi diubah lewat **CMS lokal** di laptop → tombol **Publikasikan** → GitHub → Cloudflare menayangkan otomatis (±1–2 menit).
Terpisah total dari aplikasi POS (`pos.kebabdotcom.id`): repo, Worker, dan domain sendiri; tanpa database.

```
content/site.json   ← semua teks, menu, outlet, franchise, sosmed (diubah lewat CMS)
public/             ← foto (img/menu, img/brand, img/uploads), style.css, ikon
build.mjs           ← content + public → dist/ (halaman jadi; tidak di-commit)
cms/                ← CMS lokal (http://localhost:4321)
wrangler.jsonc      ← Worker kebabdotcom-web + domain
```

## Mengubah isi website (rutin)
Jalankan di PowerShell, satu per satu:
```
cd D:\0ANTIGRAVITY\POS-KEBABDOTCOM\kebabdotcom-web
npm run cms
```
Browser terbuka di http://localhost:4321:
1. Pilih bagian di kiri (Menu, Outlet, Franchise, …) → ubah teks / unggah foto (JPG/PNG/WEBP maks. 3 MB).
2. **Simpan** → **Pratinjau ↗** untuk melihat hasilnya.
3. **Publikasikan** → isi catatan perubahan → website live diperbarui dalam ±1–2 menit.
4. Selesai: tutup jendela PowerShell (atau Ctrl+C).

CMS hanya bisa dibuka dari laptop ini. Bila laptop lain ingin mengubah: clone repo, `npm install`, `npm run cms`.

## Penyiapan pertama (sekali)
1. **GitHub**: buat repo baru **Private** `POS-Kebab/kebabdotcom-web` (tanpa README), lalu:
   ```
   git remote add origin https://github.com/POS-Kebab/kebabdotcom-web.git
   git push -u origin main
   ```
2. **Domain**: Cloudflare → kebabdotcom.id → DNS. Hapus record `A`/`AAAA`/`CNAME` untuk `kebabdotcom.id` (@) dan `www`
   bila ada (mis. bawaan registrar/parkir) — Cloudflare membuatnya otomatis saat deploy. Jangan hapus `MX`/`TXT` (email).
3. **Cloudflare** → Workers & Pages → **Create** → **Import a repository** → pilih `kebabdotcom-web`:
   - Build command: `npm run build`
   - Deploy command: `npx wrangler deploy`
   - (Situs statis boleh dibuat langsung dari GitHub — tidak butuh database seperti POS.)
4. Setelah build pertama sukses: buka https://kebabdotcom.id (sertifikat bisa butuh beberapa menit).

Deploy manual dari laptop (cadangan): `npx wrangler login` sekali, lalu `npm run deploy`.

## Catatan isi
- **Outlet**: kota & alamat awal perlu dicek; isi **Link Google Maps** (Google Maps → Bagikan → Salin link) agar tepat.
  Bila kosong, tombol membuka pencarian Google Maps "KEBABDOTCOM <nama outlet>".
- **WhatsApp**: isi nomor di *Info situs* → tombol WhatsApp melayang & tombol franchise otomatis membuka chat.
  Bila kosong, tombol franchise mengarah ke Instagram.
- Harga di website hanya informasi; harga kasir tetap diatur di aplikasi POS.
