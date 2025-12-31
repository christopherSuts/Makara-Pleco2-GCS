# Konfigurasi Antarmuka Web GCS

Bagian ini menuraikan detail implementasi perangkat lunak Ground Control Station (GCS) berbasis web yang telah dikembangkan. Penjelasan mencakup arsitektur teknis aplikasi, mekanisme integrasi data, serta fitur-fitur operasional yang dirancang untuk mendukung misi survei otonom.

## 1. Struktur Pengembangan Aplikasi Web

Pengembangan antarmuka GCS mengadopsi tumpukan teknologi (*tech stack*) web modern untuk memastikan responsivitas dan kemudahan pemeliharaan kode. Kerangka kerja utama yang digunakan adalah **Next.js 15**, yang berjalan di atas pustaka **React 19**. Pemilihan arsitektur ini memungkinkan pengelolaan *state* aplikasi yang kompleks secara efisien, serta rendering antarmuka yang optimal. Untuk keperluan desain visual (styling), aplikasi menggunakan **TailwindCSS 4** yang menerapkan pendekatan *utility-first*, memfasilitasi pembangunan komponen antarmuka yang konsisten dan adaptif dengan cepat tanpa perlu menulis fail CSS konvensional secara ekstensif.

Struktur direktori kode sumber diorganisir secara modular untuk memisahkan logika bisnis dari lapisan presentasi. Direktori `frontend/src/app` berfungsi sebagai titik masuk (*entry point*) utama yang merender halaman dan menyatukan berbagai panel antarmuka dalam satu tampilan *viewport*. Komponen-komponen antarmuka yang dapat digunakan kembali, seperti panel status dan peta, ditempatkan dalam direktori `frontend/src/components`. Sementara itu, logika bisnis yang lebih kompleks, seperti pengelolaan koneksi WebSocket, perhitungan geometri perimeter, dan algoritma pembuatan jalur, dienkapsulasi ke dalam *custom hooks* pada direktori `frontend/src/components/features`. Pemisahan ini (`useTelemetry.js`, `usePerimeter.js`, `usePath.js`) memastikan kode tetap bersih dan mudah untuk diuji atau dikembangkan lebih lanjut.

## 2. Fitur Manajemen Misi

Sistem manajemen misi dirancang untuk memfasilitasi operator dalam merencanakan area dan jalur survei secara intuitif. Fitur ini terdiri atas empat perangkat utama yang bekerja secara berurutan untuk menjamin perencanaan misi yang aman dan efisien.

**Pembuatan Perimeter Survei (Perimeter Recording)**
Langkah awal dalam perencanaan misi adalah pembuatan perimeter survei, yang berfungsi sebagai mekanisme verifikasi keamanan area. Fitur ini bersifat opsional namun krusial, di mana operator mengendalikan *Autonomous Surface Vehicle* (ASV) secara manual untuk mengelilingi tepian area yang akan disurvei. Tujuannya adalah untuk memastikan bahwa area tersebut benar-benar aman, bebas rintangan, dan dapat dilalui oleh wahana. Jejak pergerakan (*track*) yang direkam selama proses ini menjadi referensi visual bagi operator untuk menentukan batasan misi yang sebenarnya.

**Penentuan Batas Wilayah (Boundary Tool)**
Setelah area dipastikan aman melalui perekaman perimeter, langkah selanjutnya adalah definisi batas wilayah misi (*boundary*). Berbeda dengan perimeter yang merupakan jejak jalur, boundary adalah poligon geofence virtual yang didefinisikan secara eksplisit oleh operator menggunakan *Boundary Tool*. Operator menentukan titik-titik sudut (*vertices*) pada peta, yang kemudian membentuk area tertutup. Poligon boundary inilah yang nantinya dijadikan rujukan matematis oleh algoritma untuk membatasi area operasi survei otonom.

**Pembuatan Jalur Otomatis (Path Generation)**
Berdasarkan boundary yang telah didefinisikan, aplikasi menyediakan fitur *Path Generation* untuk menghasilkan jalur survei secara otomatis menggunakan algoritma berbasis *Scan-line Grid Sampling*. Algoritma ini bekerja dengan memindai *bounding box* area survei dan mengambil sampel titik koordinat secara diskrit berdasarkan interval yang ditentukan. Setiap titik sampel divalidasi menggunakan metode *Ray Casting Algorithm* untuk menentukan apakah titik tersebut berada di dalam poligon *boundary* (Point-in-Polygon test). Titik-titik yang valid kemudian diurutkan dengan pola **Boustrophedon** (gerakan meliuk seperti membajak sawah) untuk memastikan cakupan area yang efisien dan kontinu. Operator memiliki fleksibilitas untuk mengatur orientasi sapuan serta parameter kerapatan jalur, seperti jarak antar baris (*row gap*) dan jarak antar titik (*waypoint gap*), guna menyesuaikan resolusi data survei yang diinginkan.

**Pengaturan Titik Kembali (Set Home Position)**
Fitur terakhir dalam persiapan misi adalah pengaturan *Home Position*, yaitu titik koordinat tujuan wahana saat mode *Return-to-Launch* (RTL) diaktifkan. Penentuan titik ini krusial untuk prosedur keselamatan dan pemulihan wahana. Operator dapat menetapkan posisi "Home" berdasarkan posisi ASV saat ini atau dengan memilih titik pendaratan yang aman secara manual pada peta antarmuka.

## 3. Visualisasi Peta dan Telemetri Real-time

Kemampuan pemantauan visual dimplementasikan secara mendalam untuk memberikan kesadaran situasional (*situational awareness*) penuh kepada operator.

**Visualisasi Geospasial**
Peta interaktif dibangun menggunakan pustaka **React-Leaflet**, yang berfungsi sebagai kanvas utama operasional. Peta ini memvisualisasikan posisi ASV secara real-time berdasarkan data `GLOBAL_POSITION_INT`, posisi operator (GCS) menggunakan geolokasi peramban, serta elemen grafis lain seperti jalur perimeter dan rencana misi. Pergerakan ikon wahana disinkronisasi langsung dengan aliran data koordinat yang diterima, memberikan representasi akurat mengenai keberadaan fisik wahana di lapangan.

**Visualisasi Sikap Wahana (Attitude)**
Selain posisi, orientasi wahana ditampilkan melalui panel instrumentasi khusus. Komponen ini menerjemahkan data `ATTITUDE` (roll, pitch, dan yaw) dari MAVLink menjadi visualisasi grafis. Jarum kompas digital berputar sesuai nilai *yaw*, sementara cakrawala buatan (*artificial horizon*) dan indikator kemiringan kapal bergerak dinamis merespons perubahan nilai *pitch* dan *roll*. Mekanisme *data binding* reaktif dari React (`useTelemetry` hook) memastikan bahwa setiap paket data telemetri yang diterima via WebSocket langsung diperbarui pada elemen antarmuka tanpa perlu *refresh* halaman.

## 4. Pemantauan Parameter Status dan Log Sistem

Untuk memastikan keamanan operasi, GCS menyediakan panel status yang menyajikan parameter vital wahana secara ringkas. Data esensial yang ditampilkan meliputi persentase daya dorong (*thruster output*) kiri dan kanan, tegangan baterai dalam satuan Volt, serta status pengaktifan sistem (*Arming State*). Indikator visual tambahan memberikan umpan balik instan mengenai kesehatan koneksi telemetri, yang didasarkan pada latensi penerimaan paket *heartbeat* terakhir.

Di sisi diagnostik, panel Log berfungsi sebagai terminal informasi yang menggabungkan dua aliran data: pesan status internal dari *flight controller* (ArduPilot `STATUSTEXT`) dan pesan *debug* dari sistem *backend* Python (melalui protokol `WS_LOG`). Hal ini memungkinkan operator untuk memantau peringatan sistem, status sensor EKF, serta kesehatan proses *backend* dalam satu tampilan terpadu.

## 5. Kendali Mode dan Komando

Interaksi aktif dengan wahana difasilitasi melalui panel kontrol yang menyediakan akses cepat ke fungsi-fungsi komando kritis. Panel ini utamanya berfungsi untuk mengganti mode operasi wahana, seperti beralih antara mode **MANUAL** untuk kendali tangan, **AUTO** untuk eksekusi misi otonom, dan **RTL** (*Return to Launch*) untuk pemanggilan kembali wahana darurat. Setiap perintah pergantian mode dikirimkan sebagai permintaan JSON ke *backend*, yang kemudian diteruskan sebagai perintah MAVLink. Sistem antarmuka juga dilengkapi mekanisme umpan balik (*acknowledgement*) untuk mengonfirmasi bahwa perintah telah sukses diterima dan dieksekusi oleh wahana, memberikan kepastian operasional kepada pengguna.
