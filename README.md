# 🌟 Sarı Site Fiyat Takip & Analiz (Chrome Extension)

[![Manifest V3](https://img.shields.io/badge/Chrome_Extension-Manifest_V3-blue.svg?style=for-the-badge&logo=google-chrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/)
[![Vanilla JS](https://img.shields.io/badge/JS-Vanilla_ES6+-yellow.svg?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

Sarı site ilanlarında fiyat hareketlerini anlık ve geçmişe dönük olarak takip etmenizi sağlayan, gelişmiş güvenlik (WAF) bypass protokollerine sahip, modern arayüz barındıran ve gelişmiş analiz araçları sunan **Manifest V3** tabanlı bir Chrome eklentisidir. Eklenti, sayfa içerisine analiz panelleri enjekte eder, arka planda çerez senkronizasyonu yapar ve ilan verilerini API üzerinden uzak bir sunucuya asenkron olarak kaydeder.

---

## 🚀 Öne Çıkan Özellikler

### 1. ⚡ Tam Otomatik Liste Sayfası Tarayıcısı (Açık Sayfa Tarayıcı)
* **Butonsuz & Otomatik Çalışma:** Arama sonuçları veya kategori listesi sayfaları algılandığında, kullanıcı etkileşimine gerek duymadan arka planda otomatik olarak tetiklenir.
* **Eş Zamanlı (Concurrently) Gönderim:** Listelenen tüm ilanların verilerini `Promise.all` kullanarak sunucuya paralel isteklerle gönderir. İstekler sıralı değil, eş zamanlı olarak iletilerek tarama süresini milisaniyeler seviyesine indirir.
* **Dinamik Yükleme Filtresi (Debounce):** Hedef sitenin dinamik/AJAX içerik yüklemelerinin tamamlanmasını beklemek için 1 saniyelik akıllı bekleme (debounce) süresi uygular. DOM mutasyonları bittiğinde tarama başlar.
* **Sayfa Geçiş Algılama (SPA Navigation) & Yarıda Kesme (Cancellation):** 
  - Sayfa URL'sinin değiştiğini (`window.location.href`) anlık olarak izler.
  - Yeni bir sayfaya geçildiğinde veya filtre uygulandığında, **eski sayfanın asenkron gönderim işlemleri anında iptal edilir** (`scanRunId` ile kesme).
  - Eski işlem sonlandırıldıktan sonra yeni sayfanın ilanları için temiz bir tarama süreci başlatılır.
* **Tekilleştirme Filtresi:** Sayfadaki ilan numaralarından oluşturulan özel bir benzersiz imza (`lastScannedKey`) ile aynı ilanların tekrar tekrar gönderilmesini (sonsuz döngüleri) engeller.

### 2. 📊 Fiyat Değişim Geçmişi Analiz Paneli
* İlan detay sayfalarına otomatik olarak yerleşen şık, modern ve yarı saydam (blur efektli) analiz kutusu.
* Koyu (Dark) ve Açık (Light) tema algılama özelliği ile sayfa tasarımına otomatik uyum.
* Fiyat değişimlerini tarih sırasına göre gösteren sıralı liste.
* Fiyat düşüşlerini yeşil (▼), yükselişlerini ise kırmızı (▲) ile gösteren anlık indikatörler.
* **Katlanabilir Tasarım:** Sayfa düzenini bozmamak adına ilk yüklemede yalnızca en güncel fiyat değişimlerini gösterir; daha fazla kayıt varsa "Daha Fazla Göster" butonu ile akıcı animasyonlar eşliğinde açılır.

### 3. ⭐️ Gelişmiş Favori & Takip Sistemi
* Analiz kutusu başlığındaki **Takip Et / Takibi Bırak** butonuyla ilanları manuel takibe ekleme.
* **Çerez Senkronizasyonu (`sarisite_favorites`):** Takip listesini uzantı hafızasının yanı sıra tarayıcı çerezlerinde tutar. Bu sayede çerezler üzerinden sayfa düzeyinde ve arka planda kolay okuma/yazma sağlanır.
* Tüm ilanlar için geçmiş fiyat kayıtları, ilk fiyat, en düşük, en yüksek ve ortalama fiyat gibi istatistiklerin hesaplanması.

### 4. 📱 Premium Popup Kontrol Paneli
* Uzantı simgesine tıklandığında açılan, modern ve dinamik mini kontrol paneli (Popup):
  - **Takip Listesi Özeti:** Takip edilen ilanların toplam sayısı.
  - **Tarama Durumu (Crawler Status):** Arka plan tarayıcısının durumunu (Beklemede, Taranıyor, Pasif) anlık ve detaylı olarak gösterir. Geri sayım sayacı içerir.
  - **Hemen Tara Butonu (🔄):** Tek tıkla takipteki ilanları asenkron ve sıralı olarak manuel taratır.
  - **Gelişmiş Dashboard'a Geçiş:** Daha detaylı analizler için tam sayfa dashboard paneline hızlı erişim.

### 5. 🎛️ Gelişmiş Dashboard Paneli
* Takip edilen tüm ilanların tam sayfa yönetildiği özel kontrol merkezi:
  - **Detaylı İstatistikler:** Her ilan için İlk Fiyat, En Düşük, En Yüksek, Ortalama, Kayıt Sayısı ve Toplam Değişim Yüzdesi verileri.
  - **İlan Yönetimi:** İlanları özel isimlendirme ile yeniden adlandırma (✏️), anında tekli tarama (🔄) ve takipten çıkarma (🗑️) işlemleri.
  - **Fiyat Geçmişi Paneli:** Her ilanın geçmiş fiyat hareketlerini açılır kapanır panel veya modal (galeri görünümünde) üzerinden inceleme.
  - **Sürükle-Bırak Sıralama:** İlanları sürükle bırak mantığıyla istenilen sıraya koyabilme ve bu sırayı kaydedebilme.

### 6. 🔔 Anlık Bildirim Sistemi (Toast Notifications)
* Arka planda veya manuel tarama sırasında bir ilanın fiyatı değiştiğinde (düştüğünde veya yükseldiğinde) aktif hedef site sekmelerinde ve uzantı sayfalarında şık ve animasyonlu anlık bildirimler (Toast) gösterilir.

### 7. 📢 Entegre Reklam & Sponsor Sistemi
* İlan sayfalarındaki mevcut reklam alanları temizlenir ve proje iş birliği ağı (`ads.alperenakkaya.dev`) üzerinden dinamik, sponsorlu reklam kartları ilan blokları arasına enjekte edilir.

---

## 🛡️ WAF & Güvenlik Engellerini Aşma Protokolleri

İlan sitelerinin güvenlik duvarlarına (WAF/Anti-Bot) takılmamak ve IP engellemesi (ban) yememek için arka plan tarayıcısı özel algoritmalarla donatılmıştır:

1. **Sıralı Tarama Kuyruğu (Sequential Queue):** Arka plan otomatik taramalarında tüm ilanlar aynı anda sorgulanmaz. İlanlar kuyruğa alınır ve her seferinde sadece tek bir ilan taranır. (Açık olan liste sayfası taraması ise kullanıcının zaten yüklemiş olduğu verileri okuduğundan eş zamanlı olarak paralel gönderilir).
2. **Kuyruk Karıştırma (Shuffle):** Tarama sırası otomatik olarak her tetiklendiğinde ilan kuyruğu rastgele karıştırılır. Böylece robotik ve sıralı tarama desenleri kırılmış olur.
3. **Rastgele ve Uzun Bekleme Süreleri (1-35 Dakika):** Her bir ilan sorgulandıktan sonra, bir sonraki ilana geçmeden önce sistem arka planda **1 ile 35 dakika arasında rastgele bir süre** bekler. Hızlı/manuel taramalarda bu süre 1-5 dakikaya iner. Bu değişken aralık, tarayıcının insan davranışını taklit etmesini sağlar.
4. **Tarama Limiti (Max 3 İlan):** Her otomatik arka plan taraması tetiklendiğinde, güvenlik açısından **tek seferde en fazla 3 ilan** kuyruğa alınır.
5. **Arama Yönlendirmeli Fetch (Kelime Arama Trick):** Arka plan fetch istekleri doğrudan ilan detay linklerine atılmaz. `kelime-ile-arama?query_text={ID}` formatı kullanılarak arama motoru üzerinden sorgulama yapılır; bu istek güvenli şekilde detaylı veriye ulaşır.
6. **Kullanıcı Kontrollü Otomatik Tarama:** Popup veya Dashboard üzerinden **Otomatik Arka Plan Taraması** anahtarı tamamen kapatılabilir.

---

## 🛠️ Teknik Altyapı & Teknolojiler

* **Core:** HTML5, Vanilla CSS3 (CSS Variables, Flexbox, Gradients, Dark Mode desteği), Modern JavaScript (ES6+).
* **Extension API:** Manifest V3, `chrome.storage.local`, `chrome.alarms`, `chrome.cookies`, `chrome.runtime` mesajlaşma altyapısı.
* **CORS Bypass:** Content Script ile Background Service Worker arasındaki mesajlaşma kanalı (`chrome.runtime.sendMessage`) sayesinde CORS engelleri tamamen aşılmıştır. API istekleri güvenli bir şekilde arka planda gerçekleştirilir.
* **Service Worker Regex Parser:** MV3 arka plan servis işçisinde DOMParser bulunmadığından, gelen HTML verileri optimize edilmiş RegEx şablonları ile doğrudan parse edilir (fiyat, para birimi, başlık ve kayıt zamanı güvenli şekilde ayıklanır).

---

## 💾 API Protokolü ve Veri Şeması

Eklenti, verileri `POST` metodu ile `application/json` formatında gönderir.

### 1. Veri Kaydetme (Save API)
**Endpoint:** `https://sarisite.alperenakkaya.dev/index.php`

**Payload:**
```json
{
  "action": "save",
  "ilan_numarasi": 123456789,
  "kayit_zamani": "2026-06-17 01:45:00",
  "fiyat": 5000000,
  "para_birimi": "TRY",
  "ilan_durumu": "ACIK"
}
```

**Başarılı Yanıt:**
```json
{
  "success": true,
  "saved": true,
  "message": "success",
  "data": {
    "ilan_numarasi": 123456789,
    "fiyat": 5000000,
    "para_birimi": "TRY",
    "ilan_durumu": "ACIK"
  }
}
```

---

## 📂 Klasör Yapısı

```text
Sarı Site Eklentisi/
├── manifest.json            # Uzantı manifest ayarları (Manifest V3)
├── logo.png                 # Proje logosu
├── README.md                # Proje dokümantasyonu
├── assets/                  # İkonlar ve statik görseller
│   └── icons/
│       ├── 16.png
│       ├── 32.png
│       ├── 48.png
│       └── 128.png
└── src/
    ├── background/
    │   └── service-worker.js # Arka plan işleri, kuyruk yönetimi, API fetch işlemleri
    ├── content-scripts/
    │   ├── content.js        # Detay sayfası fiyat geçmişi enjeksiyonu & takip sistemi
    │   ├── sarisite-hover.js # İlan kartı hover detay önizleme sistemi
    │   ├── sarisite-hover.css # Hover arayüzü görsel stilleri
    │   └── sarisite-scanner.js # Otomatik ve eş zamanlı liste sayfası tarayıcısı
    ├── dashboard/
    │   ├── dashboard.html    # Tam sayfa gelişmiş kontrol merkezi HTML yapısı
    │   ├── dashboard.js      # Dashboard sürükle-bırak, grafik ve takip listesi yönetimi
    │   └── dashboard.css     # Premium Dashboard tasarım kuralları
    ├── popup/
    │   ├── popup.html        # Uzantı popup paneli
    │   ├── popup.js          # Popup istatistik güncelleme ve tarama buton tetikleyicisi
    │   └── popup.css         # Popup görsel stilleri
    └── styles/
        └── styles.css        # Ortak stil tanımlamaları
```

---

## 📦 Kurulum ve Çalıştırma

Eklentiyi tarayıcınızda çalıştırmak için aşağıdaki adımları takip edin:

1. Bu depoyu bilgisayarınıza indirin veya klonlayın.
2. Google Chrome tarayıcınızı açın ve `chrome://extensions/` adresine gidin.
3. Sağ üst köşedeki **Geliştirici Modu (Developer Mode)** seçeneğini aktif hale getirin.
4. Sol üstteki **Paketlenmemiş öğe yükle (Load unpacked)** butonuna tıklayın.
5. Bu projenin kök dizinini (`manifest.json` dosyasının bulunduğu ana klasörü) seçin ve yükleyin.
6. Eklenti simgesini tarayıcı araç çubuğunuza sabitleyerek aktif edin.
7. **Önemli Geliştirici Uyarısı:** Eklenti kodlarında (özellikle content script veya service-worker) bir güncelleme yapıldığında değişikliklerin tarayıcıya yansıması için `chrome://extensions/` sayfasındaki eklenti kartında bulunan **Yeniden Yükle (Reload)** ikonuna tıklamanız ve hedef site sayfasını yenilemeniz gerekmektedir.

---

## 🤝 İletişim ve Destek

Reklam ve iş birliği ortaklıkları için [ads.alperenakkaya.dev](https://ads.alperenakkaya.dev/) adresini ziyaret edebilir veya proje destek kanalı üzerinden [pay.alperenakkaya.dev/ads](https://pay.alperenakkaya.dev/ads) ile destek sağlayabilirsiniz.

---

## ⚠️ Önemli Yasal Uyarı ve Sorumluluk Reddi (Disclaimer)

> [!WARNING]
> **Sadece Bilgilendirme Amaçlıdır**
> Bu eklenti yalnızca piyasa araştırması süreçlerinizi hızlandırmak ve verileri daha kolay takip etmenizi sağlamak amacıyla geliştirilmiş bağımsız bir analiz asistanıdır.
> 
> **Veri Kesinliği Garantisi Yoktur**
> Sistem, hedef platformun herkese açık arayüzlerindeki verileri tarayarak çalışır. Hedef sitenin arayüzünde yapabileceği plansız değişiklikler, geçici sunucu kesintileri, API engellemeleri veya ağ gecikmeleri nedeniyle eklentinin sunduğu fiyatlarda %100 doğruluk, eksiksizlik, kesintisizlik veya anlık eşzamanlılık garantisi kesinlikle verilmez.
> 
> **Yatırım ve Ticari Tavsiye Değildir**
> Eklenti panellerinde görünen geçmiş fiyat hareketleri, istatistikler ve yönelim indikatörleri hiçbir şart altında finansal veya ticari bir yatırım tavsiyesi (yönlendirme) niteliği taşımaz. Alım, satım veya kiralama kararlarınızı yalnızca bu araca güvenerek almamanız; kendi bağımsız araştırmalarınızla teyit etmeniz tavsiye edilir.
> 
> **Sorumluluğun Sınırlandırılması**
> Eklentinin kullanımından veya verilerin gecikmeli/yanlış yansımasından doğabilecek doğrudan veya dolaylı maddi zararlardan, ticari anlaşmazlıklardan, kaçırılan fırsatlardan veya veri kayıplarından eklenti geliştiricisi (Alperen Akkaya) ve eklenti altyapısı hiçbir koşulda sorumlu tutulamaz. Bu eklentiyi tarayıcısına kuran ve kullanan her kullanıcı, tüm riskin kendisine ait olduğunu peşinen kabul etmiş sayılır.
