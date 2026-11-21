# Prompt — make.fun best-stealth-game-20261121-1759 (scheduled job)

Build + submit SATU entri make.fun dalam sesi baru ini. SESI INI DIMULAI SETELAH
kompetisi buka (22 Nov 00:59 WIB) — syarat transcript gate thinking_in_window;
jangan pakai hasil kerja sesi lain yang dimulai sebelum buka.

Kompetisi: "Make the best stealth game" — slug best-stealth-game-20261121-1759,
pot $50 (10 besar berbagi), deadline 22 Nov 2026 12:59 WIB (05:59 UTC).
Dibuka 22 Nov 00:59 WIB. Jendela 12 jam.

Entri: game stealth lengkap yang dimainkan offline di browser desktop dari file
statis (keyboard + mouse), original dan selesai: level terlihat dari atas,
guard dengan vision cone, cover untuk bersembunyi, dan exit yang harus dicapai
tanpa terlihat. Serahkan game + screenshot + dossier: game/ (index.html +
semua file yang dimuat), 3–4 screenshot PNG/JPEG render asli dari kode game
sendiri di browser, main.ts di root repo yang menyalin game/ + screenshots/ ke
/output dan menulis /output/dossier.json dengan buildDossier dari
vendor/makefun-game.ts (salin file itu dari kit tanpa diubah). Playtest game di
browser sebelum submit dan perbaiki yang playtest tunjukkan. Kerjakan SERIUS
seperti untuk menang (standar Imam 20 Nov: "Jgn ngasal", target peringkat 1):
HUD padat, sistem bernama, level terasa jadi — bukan arena sepi.

Repo: publik baru DLiiMaGaming/stealth-game-20261121, dibuat SETELAH 22 Nov
00:59 WIB, lisensi MIT (baris SPDX), README berisi 3 badge make.fun, About
website https://make.fun/bounty/best-stealth-game-20261121-1759 + topic
makefun. Konektor GitHub 403 untuk create_repository — buat repo + push lewat
browser task (browser.browse) seperti pola csv-reader / news-image-20261121
yang terbukti. Tanpa repo publik JANGAN submit.

Submit via kit CLI pola Port Solano, env
MAKEFUN_CREDENTIALS=$HOME/.makefun/credentials-cli, keypair
~/workspace/makefun/makefun-keypair.json: --harness muse-app --provider meta
--model muse-spark-1.3 --prompt-origin scheduled --prompt-file <file prompt
sesi ini> --harness-version 1.3 --system-prompt --context ~/AGENTS.md.
Verifikasi bundle dulu (local check harus lolos); submit hanya bila check
lolos. Catat submission ID + kode klaim + tanggal hasil dari halaman bounty
setelah submit.

Rekam: update ~/workspace/makefun/screening-state.json (masukkan slug ke
entered + isi submissions[slug]: submission_id, claim_code, repo, commit,
receipt, checks, deadline, window_status; hapus dari in_build) dan tulis log
~/workspace/goals/make-fun-free-bounty-entries/hidden_files/makefun-stealth-game-20261121-log.md.
Lapor ke chat utama (Bahasa Indonesia): nama kompetisi, deadline, submission
ID + hasil gate, kode klaim. Bila terblokir: catat status BLOCKED + alasan di
state dan lapor sekali dengan jujur — jangan memalsukan submission. Jangan
edit MEMORY.md.

TAMBAHAN STANDAR JUARA (Imam 21 Nov 16:46 WIB): sebelum membangun, baca bagian
game di
~/workspace/goals/make-fun-free-bounty-entries/hidden_files/makefun-winners-research-2026-11-20.md
(best-game + spot-the-difference) dan terapkan pola game juaranya — kepadatan,
kelengkapan, screening lolos dulu — ATM: tiru POLANYA, jangan menyalin karya
juara. Target peringkat 1, bukan sekadar masuk 10 besar.
