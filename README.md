<div align="center">

<p align="center">
  <img src="assets/promo.gif" width="100%" alt="AnyClient" />
</p>

# AnyClient

### Terminal Medya Merkezi
**Reklamsız • Hızlı • 4K & 1080p • MPV Tabanlı**

<p align="center">
  <a href="#genel-bakış">Genel Bakış</a> •
  <a href="#özellikler">Özellikler</a> •
  <a href="#kurulum">Kurulum</a> •
  <a href="#kısayollar">Kısayollar</a> •
  <a href="#yol-haritası">Yol Haritası</a> •
  <a href="#lisans">Lisans</a>
</p>

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-black?style=flat-square&logo=node.js)](https://nodejs.org/)
[![MPV](https://img.shields.io/badge/Player-MPV-black?style=flat-square&logo=mpv)](https://mpv.io/)
[![Quality](https://img.shields.io/badge/Quality-4K%20%7C%201080p-black?style=flat-square)](https://github.com/grkmdev/anyclient)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS-black?style=flat-square)](https://github.com/grkmdev/anyclient)
[![License](https://img.shields.io/badge/License-MIT-black?style=flat-square)](LICENSE)

</div>

---

## Genel Bakış

AnyClient, tarayıcılardaki reklamlar, açılır pencereler ve gereksiz bellek yükü olmadan, doğrudan komut satırından dizi, film, anime ve canlı yayınlara erişim sağlayan minimal bir terminal medya istemcisidir.

Tüm içerikler doğrudan ham HLS (`.m3u8`) veya doğrudan video akışları (`.mp4`) üzerinden **MPV oynatıcı** ile donanım ivmeli ve kayıpsız kalitede açılır.

---

## Özellikler

### 1. Canlı Spor ve TV Kanalları (50+ Kanal)
- Ulusal kanallar: TRT 1, TRT Spor, TV8.5, A Spor ve genel yayınlar.
- Uluslararası spor kanalları: Eurosport 1, Eurosport 2, NBA TV, CBC Sport.
- Dinamik HLS akışları taranarak en hızlı ve kaliteli yayın otomatik seçilir.

### 2. Anime ve 4K Fansub Arşivi
- Anizium: 4K UHD (2160p / 1080p 60fps) yüksek bitrate doğrudan MP4 akışları.
- Anizm & AnimeciX: Güncel Türkçe altyazılı anime arşivi.
- AniSkip Entegrasyonu: Açılış (`OP`) ve kapanış (`ED`) jeneriklerini tek tuşla (`Tab` / `i`) otomatik atlama.

### 3. Film ve Yabancı Dizi Kütüphanesi
- HDFilmCehennemi: 1080p Dual (Türkçe Dublaj & Altyazılı) sinema filmleri ve diziler.
- Film Makinesi: OynatLo ve Versene CDN doğrudan akışları.
- DiziBOX & YabancıDizi: Hızlı dizi sunucuları.

### 4. Yerli Türk Dizileri
- 1000'den fazla nostaljik ve güncel yerli yapım (Ezel, Kurtlar Vadisi, Behzat Ç., Avrupa Yakası vb.) tek parça HD akış.

### 5. Asya ve Kore Dizileri (K-Drama / C-Drama)
- DiziKorea, DiziAsya ve WebDramaTurkey kaynakları üzerinden güncel yapımlar.

---

## Kurulum

### Gereksinimler
- Node.js (v18 veya üzeri)
- MPV Player (`winget install mpv.mpv` veya paket yöneticiniz üzerinden)

### Adımlar

```bash
# Depoyu klonlayın
git clone https://github.com/grkmdev/anyclient.git
cd anyclient

# Bağımlılıkları yükleyin
npm install

# Global komut olarak bağlayın (isteğe bağlı)
npm link
```

### Başlatma

Herhangi bir terminal penceresinden çalıştırabilirsiniz:

```bash
anyclient
# veya
any
```

---

## MPV Kontrolleri ve Kısayollar

| Tuş | İşlev |
| :--- | :--- |
| `Tab` / `i` | AniSkip: Açılış/Kapanış jeneriğini atla |
| `Space` | Oynat / Duraklat |
| `f` | Tam Ekran Aç / Kapat |
| `[` / `]` | Oynatma Hızını Azalt / Artır |
| `Left` / `Right` | 5 saniye geri / ileri sar |
| `Up` / `Down` | 1 dakika ileri / geri sar |
| `9` / `0` | Ses Seviyesini Azalt / Artır |
| `m` | Sesi Kapat / Aç |
| `j` | Altyazı Değiştir |
| `q` | Oynatıcıyı Kapat ve Terminale Dön |

---

## Mimari

AnyClient, modüler bir scraping ve stream çözümleme mimarisi kullanır:

- **CLI Arayüzü:** Node.js tabanlı minimalist ve klavye dostu seçim menüsü.
- **Akış Çözücü:** Web kaynaklarındaki token korumalı veya şifrelenmiş HLS/MP4 linklerini anlık olarak yakalar.
- **Yerel Oynatıcı:** Çözümlenen doğrudan akışı harici MPV sürecine argümanlarla (`--hwdec=auto`, `--ytdl=no`) aktarır.

---

## 🚀 Yol Haritası (Gelecek Güncellemeler)

- 📱 **Android APK:** Mobil cihazlar için optimize edilmiş, dokunmatik kontrollere sahip bağımsız Android APK uygulaması çok yakında gelecektir.
- 💻 **Masaüstü Uygulaması (GUI):** Terminal yerine modern ve şık bir grafik arayüz (GUI) tercih edenler için masaüstü sürümü geliştirilme aşamasındadır.

---

## Lisans

Bu proje MIT lisansı altında sunulmaktadır.


---

## Yasal Uyarı ve Sorumluluk Reddi

- **İçerik Barındırılmamaktadır:** AnyClient, kendi sunucularında hiçbir video, ses, yayın veya .m3u8 akış dosyası barındırmaz, saklamaz ya da dağıtmaz.
- **Yalnızca Arayüz İstemcisidir:** Bu yazılım, yalnızca internet üzerinde halka açık olarak bulunan üçüncü taraf kaynakları ve API'leri komut satırı üzerinden yerel medya oynatıcısına (MPV) ileten bir köprü/istemci aracıdır.
- **Telif Hakları ve Sorumluluk:** Uygulama üzerinden erişilen tüm medya içeriklerinin, logoların ve yayınların telif hakları ilgili hak sahiplerine ve yayın sağlayıcılarına aittir. AnyClient geliştiricileri, üçüncü taraf kaynakların sunduğu içeriklerin doğruluğu, yasallığı veya telif uygunluğu konusunda hiçbir sorumluluk kabul etmez. Yazılım yalnızca eğitim ve kişisel kullanım amacıyla sunulmaktadır.