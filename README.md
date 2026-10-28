<div align="center">

#  AnyClient
### *Hepsi Bir Arada Minimalist Terminal Medya Merkezi*
**Reklamsız • Ultra Hızlı • 4K & 1080p • MPV Tabanlı**

<p align="center">
  <a href="#-neler-izleyebilirsiniz">Neler İzleyebilirsiniz?</a> •
  <a href="#-kurulum--çalıştırma">Kurulum</a> •
  <a href="#-mpv-oynatıcı-kontrolleri--kısayolları">Kısayollar</a> •
  <a href="#-proje-mimarisi">Mimari</a>
</p>

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-22c55e?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![MPV](https://img.shields.io/badge/Player-MPV-a855f7?style=for-the-badge&logo=mpv&logoColor=white)](https://mpv.io/)
[![Quality](https://img.shields.io/badge/Quality-4K%20%7C%201080p-f97316?style=for-the-badge)](https://github.com/grkmdev/anyclient)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS-3b82f6?style=for-the-badge)](https://github.com/grkmdev/anyclient)
[![License](https://img.shields.io/badge/License-MIT-ef4444?style=for-the-badge)](LICENSE)

<br/>

> **Tarayıcı reklamlarına, açılır pencerelere ve yavaş oynatıcılara son.**  
> Canlı TV, 4K Animeler, Yerli & Yabancı Diziler ve Filmleri doğrudan terminalinizden en yüksek kalitede, donmadan ve reklamsız izleyin.

</div>

---

## 🌟 AnyClient Nedir?

**AnyClient**, web tarayıcılarındaki ağır reklamlar, açılır pencereler (pop-up) ve yönlendirmelerle uğraşmadan; tek bir komut satırından Türkiye'nin ve dünyanın en popüler dizi, film, anime ve canlı spor yayınlarına ulaşmanızı sağlayan **modern, hafif ve hepsi bir arada terminal medya istemcisidir.**

Tüm içerikler doğrudan ham HLS (`.m3u8`) veya doğrudan video akışları (`.mp4`) üzerinden **MPV oynatıcı** ile kayıpsız, donmasız ve en yüksek bitrateli kalitede açılır.

---

## ✨ Neler İzleyebilirsiniz?

### ⚽ 1. Canlı Spor & TV Kanalları (50+ Kanal)
- **Ulusal Kanallar:** TRT Spor, TRT Spor Yıldız, A Spor, TV8.5, TRT 1 vb.
- **Uluslararası Kanallar:** Eurosport 1, Eurosport 2, NBA TV, CBC Sport, İdman TV vb.
- **Akıllı Çözümleme Motoru:** Çoklu kaynak üzerinden dinamik HLS akışları taranarak en hızlı ve kaliteli yayın otomatik yakalanır.

### 🎌 2. Anime & 4K Fansub Arşivi
- **Anizium:** 4K UHD (2160p / 1080p 60fps) ultra yüksek bitrate doğrudan MP4 akışları.
- **Anizm & AnimeciX:** Güncel Türkçe altyazılı anime arşivleri.
- **OpenAnime:** Hızlı CDN altyapısıyla kesintisiz anime keyfi.
- **AniSkip Entegrasyonu:** Açılış (`OP`) ve kapanış (`ED`) jeneriklerini tek tuşla (`Tab` / `i`) otomatik atlama.

### 🎬 3. Film & Yabancı Dizi Arşivi
- **HDFilmCehennemi (`.nl` & `.land`):** 1080p Dual (Türkçe Dublaj & Altyazılı) sinema filmleri ve yabancı diziler.
- **Film Makinesi (`filmmakinesi.to`):** OynatLo & Versene CDN doğrudan HLS akışları, Türkçe ses / orijinal dil desteği.
- **DiziBOX (`ddizibox.com`):** Pilavyer HLS yüksek hızlı dizi sunucuları.
- **YabancıDizi (`yabancidizi.news`):** Tüm popüler yabancı diziler.

### 🇹🇷 4. Yerli Türk Dizileri (TRDiziİzle)
- 1000'den fazla nostaljik ve güncel yerli Türk dizisi (*Kurtlar Vadisi, Ezel, Avrupa Yakası, Behzat Ç., Kızılcık Şerbeti vb.*) tek parça 1080p HD.

### 🎎 5. Kore & Asya Dizileri (K-Drama / C-Drama)
- **DiziKorea, DiziAsya ve WebDramaTurkey:** Güncel Kore dizileri, BL ve Asya yapımları.

---

## 🚀 Kurulum & Çalıştırma

### Gereksinimler
- [Node.js](https://nodejs.org/) (v18 veya üzeri önerilir)
- [MPV Player](https://mpv.io/) (Windows için `winget install mpv.mpv` veya uygulama içinden otomatik kurulum)

### Hızlı Kurulum

```bash
# Projeyi klonlayın
git clone https://github.com/grkmdev/anyclient.git
cd anyclient

# Bağımlılıkları yükleyin
npm install

# Global komut olarak bağlayın (isteğe bağlı)
npm link
```

### Başlatma

Herhangi bir terminalden doğrudan şu komutla başlatabilirsiniz:
```bash
anyclient
# veya kısa takma adıyla:
any
```

Veya proje dizini içerisinden:
```bash
npm start
```

### 📌 Masaüstü Kısayolu Oluşturma (Tek Tıkla Başlat)
Masaüstünüze doğrudan tıklanabilir **AnyClient** kısayolu oluşturmak için:
```bash
npm run shortcut
```
*(veya proje klasöründeki `Kisayol_Olustur.bat` dosyasına çift tıklayabilirsiniz)*

### 📦 Tek Dosya Taşınabilir EXE Oluşturma (Node.js Gerektirmez)
Node.js kurulu olmayan herhangi bir bilgisayarda da tek tıkla çalıştırmak için:
```bash
npm run build:exe
```
*(veya proje klasöründeki `EXE_Olustur.bat` dosyasına çift tıklayabilirsiniz)*
Üretilen `dist/AnyClient.exe` dosyasını istediğiniz bilgisayara veya USB belleğe taşıyıp doğrudan çalıştırabilirsiniz.

---

## 🎮 Doğrudan CLI Kısayolları

Menüye girmeden doğrudan arama veya indirme yapmak için kısayol parametreleri:

```bash
any -s "Matrix"              # Evrensel Arama (Tüm kaynaklarda eşzamanlı ara)
any -d "Solo Leveling"       # Doğrudan İndir (1080p MP4 olarak bilgisayara kaydet)
any -a "Solo Leveling"       # Doğrudan Anime Ara (4K Anizium, Anizm, OpenAnime)
any -m "Avatar"              # Film & Yabancı Dizi Ara (HDFilm, Film Makinesi, DiziBOX)
any -t "Kurtlar Vadisi"      # Yerli Türk Dizisi Ara (TRDizi)
any -k "Queen of Tears"      # Kore / Asya Dizisi Ara (DiziKorea, DiziAsya)
any -c "spor"                # Canlı Spor & TV Kanalı Ara
```

---

## ⌨️ MPV Oynatıcı Kontrolleri & Kısayolları

| Tuş | İşlev |
| :---: | :--- |
| `[Tab / i]` | ⚡ **AniSkip:** Anime Açılış (OP) / Kapanış (ED) Jeneriğini Anında Atla |
| `[n]` | Sıradaki bölüme geç |
| `[p]` | Önceki bölüme dön |
| `[Boşluk]` | Videoyu duraklat / devam ettir |
| `[f]` | Tam ekran moduna geç / çık |
| `[← / →]` | 5 saniye geri / ileri sar |
| `[↓ / ↑]` | 1 dakika geri / ileri sar |
| `[9 / 0]` | Sesi kıs / arttır |
| `[m]` | Sesi tamamen kapat (Mute) |
| `[[ / ]]` | Oynatma hızını %10 yavaşlat / hızlandır |
| `[Backspace]` | Normal hıza geri dön (1.0x) |
| `[s]` | Anlık ekran görüntüsü yakala |
| `[v]` | Altyazıyı aç / gizle |
| `[q / ESC]` | Oynatmayı sonlandırıp menüye dön |

---

## 🏷️ Kaynak ve Rozet Gösterimi

Arama sonuçları terminalde göz yormayan, temiz ve modern rozetlerle listelenir:

```text
[ CANLI TV │ Spor │ Canlı ]  TRT Spor HD [1080p FHD]
[ ANİZİUM  │ 4K   │ Ultra ]  Solo Leveling: Arise
[ FILMMAK  │ 2024 │ 1080p ]  Avatar: Fire and Ash
[ HDFİLM.L │ 2024 │ ★8.6  ]  The Matrix Resurrections
[ DDİZİBOX │ Dizi │ ★9.5  ]  Breaking Bad (Sezon 1-5)
[ TRDİZİ   │ Yerli│ 1080p ]  Kurtlar Vadisi (1-97 Bölüm)
```

---

## 📁 Proje Mimarisi

```
anyclient/
├── bin/
│   └── anyclient.js            # Ana CLI başlangıç noktası (anyclient / any)
├── src/
│   ├── app.js                  # İnteraktif TUI menüleri, akışlar ve evrensel arama
│   ├── sport.js                # Canlı spor kanalları yöneticisi
│   ├── lib/
│   │   └── anthology_spor.cjs  # Çoklu kaynak spor akış motoru
│   ├── anizium.js              # Anizium 4K UHD anime sağlayıcısı
│   ├── filmmakinesi.js         # Film Makinesi OynatLo/Versene HLS sağlayıcısı
│   ├── ddizibox.js             # DiziBOX Pilavyer HLS sağlayıcısı
│   ├── hdfilmland.js           # HDFilmcehennemi.land REST API & SetPlay/FastPlay çözücü
│   ├── hdfilm.js               # HDFilmcehennemi.nl sağlayıcısı
│   ├── trdizi.js               # Yerli Türk dizileri sağlayıcısı
│   ├── dizikorea.js            # DiziKorea Asya dizileri sağlayıcısı
│   ├── diziasya.js             # DiziAsya sağlayıcısı
│   ├── webdramaturkey.js       # WebDramaTurkey sağlayıcısı
│   ├── api.js                  # OpenAnime, AnimeciX & Anizm birleşik anime API
│   ├── player.js               # MPV ve geometri entegrasyonu, HTTP header yönetimi
│   ├── storage.js              # Yapılandırma ve izleme geçmişi
│   ├── downloader.js           # Yerel video / bölüm indirme yöneticisi
│   └── ui.js                   # Terminal başlıkları, kartlar, rozetler ve banner
├── scripts/
│   ├── build_exe.js            # Bağımsız .exe ve taşınabilir paket üretici
│   └── create_shortcut.js      # Masaüstü kısayolu oluşturucu
├── data/
│   └── dizibox-catalog.json    # Hızlı arama kataloğu
├── package.json
└── README.md
```

---

## 🙏 Teşekkürler & Krediler (Credits & Special Thanks)

Bu projenin zenginleşmesinde ve gelişmesinde açık kaynak dünyasından ilham ve destek aldığımız harika projelere içtenlikle teşekkür ederiz:

- 🌟 **[Anthology](https://github.com/falsisdev/anthology) (falsisdev & Anthology Ekibi):**
  Canlı TV ve spor yayın motorunun mimarisi, dinamik HLS akış yakalayıcıları ve 4K Anizium API çözücü mantığındaki değerli çalışmaları ve açık kaynak katkıları için **Anthology** projesine ve geliştiricisi **falsisdev**'e çok teşekkür ederiz.
- 🌸 **[anitr-cli](https://github.com/axrona/anitr-cli) (axrona):**
  Terminal üzerinden Türkçe anime ve medya izleme konseptindeki öncü fikirleri ve değerli ilhamı için **axrona**'ya ve **anitr-cli** projesine içtenlikle teşekkür ederiz.
- 🎬 **[MPV](https://mpv.io/):** Hafif ve yetenekli video oynatıcı motoru.
- ⏩ **AniSkip:** Anime izleme deneyimini jeneriksiz kusursuz kılan açık kaynak API.

---

## ⚖️ Yasal Uyarı (Disclaimer)

*AnyClient, herhangi bir video, ses veya yayın içeriğini kendi sunucularında barındırmaz. Bu yazılım yalnızca internet üzerinde kamuya açık olarak yayın yapan üçüncü taraf kaynakları indeksleyen ve terminal üzerinden oynatıcıya yönlendiren açık kaynaklı bir istemcidir. Tüm telif hakları ilgili içerik sahiplerine ve yapımcılarına aittir.*

---

<p align="center">
  Geliştirici: <b><a href="https://github.com/grkmdev">grkmdev</a></b> (Görkem) • MIT Lisansı ile sunulmaktadır 🖤
</p>
