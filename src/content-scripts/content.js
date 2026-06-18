const ADS_API_URL = 'https://ads.alperenakkaya.dev/url_ads/index.php';
const SAVE_API_URL = 'https://sarisite.alperenakkaya.dev/index.php';
const TARGET_SELECTOR = '.classifiedOtherBoxesContainer, .classifiedOtherBoxes';
const CONTAINER_WAIT_MS = 10000;

function removeExistingAdSlots() {
  const selectors = [
    'div[id^="div-gpt-ad"]',
    'div[id*="google_ads_iframe"]',
    'iframe[id^="google_ads_iframe_"]',
    'div[data-google-query-id]',
    'div[id^="google_ad"]',
    'ins[class*="adsbygoogle"]'
  ];

  const items = document.querySelectorAll(selectors.join(','));
  items.forEach((item) => {
    item.remove();
  });
}

async function fetchAds() {
  try {
    const response = await fetch(ADS_API_URL, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Ad fetch failed: ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data.ads) ? data.ads : [];
  } catch (error) {
    console.warn('Ad request failed:', error);
    return [];
  }
}

function pickRandomAd(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function formatPrice(value, currency) {
  if (typeof value !== 'number') {
    return String(value || '');
  }

  try {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: currency || 'TRY',
      maximumFractionDigits: 0
    }).format(value);
  } catch (error) {
    return `${value} ${currency || ''}`.trim();
  }
}

function createAdMetaBlock(ad) {
  const rows = [];

  if (ad.ilan_numarasi != null) {
    rows.push({ label: 'İlan No', value: ad.ilan_numarasi });
  }
  if (ad.kayit_zamani) {
    rows.push({ label: 'Kayıt Zamanı', value: ad.kayit_zamani });
  }
  if (ad.fiyat != null) {
    rows.push({ label: 'Fiyat', value: formatPrice(ad.fiyat, ad.para_birimi) });
  }
  if (ad.para_birimi && ad.fiyat == null) {
    rows.push({ label: 'Para Birimi', value: ad.para_birimi });
  }
  if (ad.ilan_durumu) {
    rows.push({ label: 'İlan Durumu', value: ad.ilan_durumu });
  }

  if (!rows.length) {
    return null;
  }

  const meta = document.createElement('div');
  meta.style.cssText = [
    'display:flex',
    'flex-wrap:wrap',
    'gap:8px',
    'margin:12px 0',
    'font-size:13px',
    'color:#4f4f4f'
  ].join(';');

  rows.forEach((row) => {
    const item = document.createElement('div');
    item.style.cssText = [
      'flex:1 1 calc(50% - 8px)',
      'min-width:120px',
      'padding:8px',
      'background:rgba(0,0,0,.03)',
      'border-radius:6px'
    ].join(';');

    const label = document.createElement('div');
    label.textContent = row.label;
    label.style.cssText = [
      'font-size:11px',
      'font-weight:700',
      'text-transform:uppercase',
      'margin-bottom:4px',
      'color:#6b6b6b'
    ].join(';');

    const value = document.createElement('div');
    value.textContent = row.value;
    value.style.cssText = 'font-size:14px; color:#232323;';

    item.appendChild(label);
    item.appendChild(value);
    meta.appendChild(item);
  });

  return meta;
}

function createAdCard(ad) {
  const card = document.createElement('div');
  card.className = 'injected-ad-card';
  card.style.cssText = [
    'box-sizing:border-box',
    'border:1px solid rgba(0,0,0,.12)',
    'box-shadow:0 5px 18px rgba(0,0,0,.08)',
    'padding:16px',
    'margin:12px 0',
    'background:#fafafa',
    'font-family:Arial,Helvetica,sans-serif',
    'color:#232323',
    'max-width:100%'
  ].join(';');
  card.dataset.adId = ad.id || '';

  const sponsorLink = document.createElement('a');
  sponsorLink.href = ad.url || '#';
  sponsorLink.target = '_blank';
  sponsorLink.rel = 'noopener noreferrer';
  sponsorLink.textContent = 'Sponsorlu';
  sponsorLink.style.cssText = [
    'display:inline-block',
    'margin-bottom:10px',
    'padding:4px 8px',
    'font-size:12px',
    'font-weight:700',
    'color:#1a73e8',
    'background:rgba(26,115,232,.08)',
    'border-radius:4px',
    'text-decoration:none'
  ].join(';');
  card.appendChild(sponsorLink);

  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  header.style.gap = '10px';

  const title = document.createElement('h3');
  title.textContent = ad.title || 'Reklam';
  title.style.margin = '0';
  title.style.fontSize = '16px';
  title.style.lineHeight = '1.2';
  title.style.fontWeight = '700';
  header.appendChild(title);

  card.appendChild(header);

  const metaBlock = createAdMetaBlock(ad);
  if (metaBlock) {
    card.appendChild(metaBlock);
  }

  if (ad.type === 'image' && ad.img) {
    const imageAnchor = document.createElement('a');
    imageAnchor.href = ad.url || '#';
    imageAnchor.target = '_blank';
    imageAnchor.rel = 'noopener noreferrer';

    const image = document.createElement('img');
    image.src = ad.img;
    image.alt = ad.title || 'Reklam görseli';
    image.style.cssText = [
      'display:block',
      'width:100%',
      'max-height:260px',
      'object-fit:cover',
      'border-radius:6px',
      'margin:10px 0'
    ].join(';');

    imageAnchor.appendChild(image);
    card.appendChild(imageAnchor);
  }

  if (ad.description) {
    const description = document.createElement('p');
    description.textContent = ad.description;
    description.style.margin = '10px 0 0';
    description.style.fontSize = '14px';
    description.style.lineHeight = '1.5';
    card.appendChild(description);
  }

  const ctaUrl = ad.url || '#';
  const ctaText = ad.cta || 'Detaylar';

  const footer = document.createElement('div');
  footer.style.display = 'flex';
  footer.style.justifyContent = 'flex-end';
  footer.style.marginTop = '14px';

  const button = document.createElement('a');
  button.href = ctaUrl;
  button.target = '_blank';
  button.rel = 'noopener noreferrer';
  button.textContent = ctaText;
  button.style.cssText = [
    'display:inline-block',
    'padding:10px 16px',
    'border-radius:6px',
    'background:#1a73e8',
    'color:#fff',
    'text-decoration:none',
    'font-size:14px',
    'font-weight:600'
  ].join(';');

  footer.appendChild(button);
  card.appendChild(footer);

  return card;
}

function insertAdIntoContainer(container, ad) {
  const adCard = createAdCard(ad);
  container.prepend(adCard);
}

function waitForContainer(timeoutMs) {
  const existing = document.querySelector(TARGET_SELECTOR);
  if (existing) {
    return Promise.resolve(existing);
  }

  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const found = document.querySelector(TARGET_SELECTOR);
      if (found) {
        observer.disconnect();
        resolve(found);
      }
    });

    observer.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true
    });

    setTimeout(() => {
      observer.disconnect();
      resolve(document.querySelector(TARGET_SELECTOR));
    }, timeoutMs);
  });
}

function extractListingData(container) {
  let box = container;
  if (!box.classList.contains('classifiedOtherBoxes')) {
    box = container.querySelector('.classifiedOtherBoxes') || container;
  }

  // 1. Try to read from data attributes first (if they exist)
  if (box && box.dataset && box.dataset.ilanNumarasi) {
    return {
      ilan_numarasi: box.dataset.ilanNumarasi,
      kayit_zamani: box.dataset.kayitZamani || "",
      fiyat: box.dataset.fiyat || "",
      para_birimi: box.dataset.paraBirimi || "",
      ilan_durumu: box.dataset.ilanDurumu || "ACIK"
    };
  }

  // 2. Otherwise, scrape directly from the page HTML (for standard listing pages or realistic simulations)
  let ilanNo = '';
  let kayitZamani = '';
  let fiyat = '';
  let paraBirimi = 'TRY';
  let ilanDurumu = 'ACIK';

  // Find İlan No from URL (highly reliable fallback)
  const urlMatch = window.location.href.match(/[\-/](\d{9,11})\/detay/);
  if (urlMatch) {
    ilanNo = urlMatch[1];
  }

  // Find İlan No from page elements if not found from URL
  if (!ilanNo) {
    const idEl = document.querySelector('#classifiedId') ||
      document.querySelector('.classifiedId') ||
      document.querySelector('[data-classified-id]');
    if (idEl) {
      ilanNo = idEl.textContent.trim().replace('#', '');
    } else {
      const listItems = document.querySelectorAll('.classifiedInfoList li, .classifiedInfoTable tr, table td');
      for (const item of listItems) {
        const text = item.textContent;
        if (text.includes('İlan No') || text.includes('İlan Numarası')) {
          const valEl = item.querySelector('span, td, .classifiedInfoValue') || item.nextElementSibling;
          if (valEl) {
            ilanNo = valEl.textContent.trim();
          } else {
            const match = text.match(/(?:İlan No|İlan Numarası)\s*[:\-]?\s*(\d+)/i);
            if (match) ilanNo = match[1];
          }
          break;
        }
      }
    }
  }

  // Clean ilanNo to only digits
  if (ilanNo) {
    ilanNo = ilanNo.replace(/[^0-9]/g, '');
  }

  // Find İlan Tarihi / Kayıt Zamanı
  const listItemsForDate = document.querySelectorAll('.classifiedInfoList li, .classifiedInfoTable tr, table td');
  for (const item of listItemsForDate) {
    const text = item.textContent;
    if (text.includes('İlan Tarihi') || text.includes('Kayıt Tarihi') || text.includes('Kayıt Zamanı')) {
      const valEl = item.querySelector('span, td, .classifiedInfoValue') || item.nextElementSibling;
      if (valEl) {
        kayitZamani = valEl.textContent.trim();
      } else {
        const match = text.match(/(?:İlan Tarihi|Kayıt Tarihi|Kayıt Zamanı)\s*[:\-]?\s*([0-9a-zA-Z\s\.\:]+)/i);
        if (match) kayitZamani = match[1].trim();
      }
      break;
    }
  }

  // Find Fiyat & Para Birimi
  let rawPrice = '';

  // 1. Try specific DOM selectors first (prioritizing the most clean wrappers)
  const priceEl = document.querySelector('.classified-price-wrapper') ||
    document.querySelector('.classifiedInfo h3') ||
    document.querySelector('.classified-price') ||
    document.querySelector('.price') ||
    document.querySelector('.classifiedInfoValue [data-price]') ||
    document.querySelector('.classifiedInfoList .classifiedInfoValue');

  if (priceEl) {
    const clone = priceEl.cloneNode(true);
    // Remove any nested scripts or styles or hidden tracking elements if they exist to avoid getting extra numbers
    clone.querySelectorAll('script, style, .classifiedId, [style*="display:none"], [style*="display: none"]').forEach(el => el.remove());
    rawPrice = clone.textContent.trim();
  }

  // 2. Fallback to Meta tags if DOM selector didn't work
  if (!rawPrice) {
    const metaPrice = document.querySelector('meta[property="og:price:amount"]') ||
      document.querySelector('meta[property="product:price:amount"]');
    if (metaPrice) {
      rawPrice = metaPrice.getAttribute('content') || metaPrice.getAttribute('value');
    }
  }

  // 3. Fallback to twitter card if DOM and OG tags didn't work
  if (!rawPrice) {
    const twitterPrice = document.querySelector('meta[name="twitter:data1"]');
    if (twitterPrice) {
      const content = twitterPrice.getAttribute('content') || twitterPrice.getAttribute('value');
      if (content && (content.includes('TL') || content.includes('₺') || content.includes('$') || content.includes('€') || content.includes('GBP'))) {
        rawPrice = content;
      }
    }
  }

  if (rawPrice) {
    if (rawPrice.includes('TL') || rawPrice.includes('₺')) {
      paraBirimi = 'TRY';
    } else if (rawPrice.includes('USD') || rawPrice.includes('$')) {
      paraBirimi = 'USD';
    } else if (rawPrice.includes('EUR') || rawPrice.includes('€')) {
      paraBirimi = 'EUR';
    } else if (rawPrice.includes('GBP') || rawPrice.includes('£')) {
      paraBirimi = 'GBP';
    } else {
      // Check meta tags for currency if not found in text
      const metaCurrency = document.querySelector('meta[property="og:price:currency"]') ||
        document.querySelector('meta[property="product:price:currency"]');
      if (metaCurrency) {
        const content = metaCurrency.getAttribute('content');
        if (content) paraBirimi = content.trim().toUpperCase();
      }
    }

    const digits = rawPrice.replace(/[^0-9]/g, '');
    if (digits) {
      fiyat = digits;
    }
  }

  // If we couldn't find the listing ID or price, return null (do not write corrupt/fake data to database)
  if (!ilanNo || !fiyat) {
    console.warn('[sarısite Fiyat Takip] İlan numarası veya fiyat bulunamadı, işlem iptal edildi.');
    return null;
  }

  return {
    ilan_numarasi: ilanNo,
    kayit_zamani: kayitZamani || new Date().toISOString().slice(0, 19).replace('T', ' '),
    fiyat: fiyat,
    para_birimi: paraBirimi === 'TL' ? 'TRY' : paraBirimi,
    ilan_durumu: ilanDurumu
  };
}

function formatDateTime(dateStr) {
  if (!dateStr) return new Date().toISOString().slice(0, 19).replace('T', ' ');

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  const months = {
    'ocak': '01', 'şubat': '02', 'mart': '03', 'nisan': '04',
    'mayıs': '05', 'haziran': '06', 'temmuz': '07', 'ağustos': '08',
    'eylül': '09', 'ekim': '10', 'kasım': '11', 'aralık': '12'
  };

  const cleanStr = dateStr.toLowerCase().replace(/\s+/g, ' ').trim();
  const parts = cleanStr.split(' ');

  if (parts.length >= 3) {
    const day = parts[0].padStart(2, '0');
    const monthName = parts[1];
    const year = parts[2];
    const month = months[monthName] || '01';

    let time = '00:00:00';
    if (parts[3] && /^\d{2}:\d{2}(:\d{2})?$/.test(parts[3])) {
      time = parts[3];
      if (time.length === 5) time += ':00';
    } else {
      const now = new Date();
      time = now.toTimeString().split(' ')[0];
    }

    return `${year}-${month}-${day} ${time}`;
  }

  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

async function sendListingData(data, onComplete) {
  if (!data || !data.ilan_numarasi) {
    if (onComplete) onComplete();
    return;
  }

  try {
    const payload = {
      ilan_numarasi: parseInt(data.ilan_numarasi, 10) || data.ilan_numarasi,
      kayit_zamani: formatDateTime(data.kayit_zamani),
      fiyat: parseFloat(data.fiyat) || data.fiyat,
      para_birimi: data.para_birimi === 'TL' ? 'TRY' : data.para_birimi,
      ilan_durumu: data.ilan_durumu
    };

    console.log(
      '%c[sarısite Fiyat Takip] Veri arka plana iletiliyor...',
      'color: #3b82f6; font-weight: bold; font-size: 12px; background: rgba(59, 130, 246, 0.1); padding: 4px 8px; border-radius: 4px;',
      payload
    );

    chrome.runtime.sendMessage(
      {
        action: 'sendListingData',
        url: SAVE_API_URL,
        payload: payload
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error(
            '%c[sarısite Fiyat Takip] İletişim Hatası:',
            'color: #ef4444; font-weight: bold; font-size: 12px; background: rgba(239, 68, 68, 0.1); padding: 4px 8px; border-radius: 4px;',
            chrome.runtime.lastError.message
          );
          if (onComplete) onComplete();
          return;
        }

        if (response && response.success) {
          console.log(
            '%c[sarısite Fiyat Takip] Veri sunucuya başarıyla kaydedildi! Cevap:',
            'color: #10b981; font-weight: bold; font-size: 12px; background: rgba(16, 185, 129, 0.1); padding: 4px 8px; border-radius: 4px;',
            response.data
          );
        } else {
          console.error(
            '%c[sarısite Fiyat Takip] Kayıt Başarısız:',
            'color: #ef4444; font-weight: bold; font-size: 12px; background: rgba(239, 68, 68, 0.1); padding: 4px 8px; border-radius: 4px;',
            response ? response.error : 'Bilinmeyen sunucu hatası'
          );
        }
        if (onComplete) onComplete();
      }
    );
  } catch (error) {
    console.error(
      '%c[sarısite Fiyat Takip] Veri hazırlanırken hata oluştu:',
      'color: #ef4444; font-weight: bold; font-size: 12px; background: rgba(239, 68, 68, 0.1); padding: 4px 8px; border-radius: 4px;',
      error
    );
    if (onComplete) onComplete();
  }
}

function getListingHistory(ilanNo, callback) {
  if (!ilanNo) return callback([]);

  const payload = {
    action: 'get',
    ilan_numarasi: parseInt(ilanNo, 10)
  };

  console.log(
    '%c[sarısite Fiyat Takip] Fiyat geçmişi talep ediliyor...',
    'color: #3b82f6; font-weight: bold; font-size: 11px;',
    payload
  );

  chrome.runtime.sendMessage(
    {
      action: 'getListingHistory',
      url: SAVE_API_URL,
      payload: payload
    },
    (response) => {
      if (chrome.runtime.lastError) {
        console.warn('Geçmiş verisi alma hatası:', chrome.runtime.lastError.message);
        callback([]);
        return;
      }

      if (response && response.success) {
        let list = [];
        const resData = response.data;
        if (resData && Array.isArray(resData.records)) {
          list = resData.records;
        } else if (response.records && Array.isArray(response.records)) {
          list = response.records;
        } else if (Array.isArray(resData)) {
          list = resData;
        } else if (resData && Array.isArray(resData.history)) {
          list = resData.history;
        } else if (resData && Array.isArray(resData.data)) {
          list = resData.data;
        } else if (response.history && Array.isArray(response.history)) {
          list = response.history;
        } else if (Array.isArray(response)) {
          list = response;
        }

        console.log(
          '%c[sarısite Fiyat Takip] Fiyat geçmişi başarıyla alındı:',
          'color: #10b981; font-weight: bold; font-size: 11px;',
          list
        );
        callback(list);
      } else {
        console.warn('Geçmiş verisi alınamadı:', response ? response.error : 'Bilinmeyen hata');
        callback([]);
      }
    }
  );
}

function injectAnalysisBox(container, data) {
  if (!data || !data.ilan_numarasi) {
    return null;
  }

  let targetBox = container;
  if (!targetBox.classList.contains('classifiedOtherBoxes')) {
    targetBox = container.querySelector('.classifiedOtherBoxes') || container;
  }
  if (!targetBox) return null;

  const existingBox = targetBox.querySelector('.injected-analysis-box');
  if (existingBox) {
    return existingBox;
  }

  const isDarkMode = window.getComputedStyle(document.body).backgroundColor.includes('rgba(0, 0, 0') ||
    window.getComputedStyle(document.body).backgroundColor.includes('rgb(10') ||
    window.getComputedStyle(document.body).backgroundColor.includes('rgb(24') ||
    window.getComputedStyle(document.body).color.includes('243') ||
    window.getComputedStyle(document.body).color.includes('255');

  const textColor = isDarkMode ? '#f3f4f6' : '#232323';
  const labelColor = isDarkMode ? '#9ca3af' : '#6b7280';
  const borderColor = isDarkMode ? 'rgba(59, 130, 246, 0.4)' : '#3b82f6';
  const bgColor = isDarkMode ? 'rgba(59, 130, 246, 0.08)' : 'rgba(59, 130, 246, 0.04)';

  const box = document.createElement('div');
  box.className = 'injected-analysis-box';
  box.style.cssText = [
    'box-sizing:border-box',
    `border:1px solid ${borderColor}`,
    'padding:16px',
    `background:${bgColor}`,
    'backdrop-filter:blur(8px)',
    'font-family:inherit',
    `color:${textColor}`,
    'max-width:100%',
  ].join(';');

  const headerContainer = document.createElement('div');
  headerContainer.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;';

  const header = document.createElement('h4');
  header.textContent = 'Fiyat Değişim Geçmişi';
  header.style.cssText = 'margin:0; font-size:12px; font-weight:700; color:#3b82f6; text-transform:uppercase; letter-spacing:1px;';
  headerContainer.appendChild(header);

  const favBtn = document.createElement('button');
  favBtn.type = 'button';
  favBtn.className = 'history-fav-btn';
  favBtn.style.cssText = [
    'background:none',
    'border:none',
    'color:#3b82f6',
    'font-size:14px',
    'cursor:pointer',
    'padding:4px 8px',
    'border-radius:4px',
    'display:flex',
    'align-items:center',
    'gap:4px',
    'font-weight:600',
    'transition:background 0.2s, transform 0.1s',
    'font-family:inherit'
  ].join(';');

  const ilanId = String(data.ilan_numarasi);

  const updateFavBtnState = (isFav) => {
    if (isFav) {
      favBtn.innerHTML = '★ <span style="font-size:10px; font-weight:700;">Takibi Bırak</span>';
      favBtn.style.color = '#f59e0b'; // Gold yellow color for active tracking
    } else {
      favBtn.innerHTML = '☆ <span style="font-size:10px; font-weight:700;">Takip Et</span>';
      favBtn.style.color = isDarkMode ? '#9ca3af' : '#6b7280';
    }
  };

  chrome.storage.local.get({ userFavorites: {} }, (result) => {
    const userFavorites = result.userFavorites || {};
    const isFav = !!userFavorites[ilanId];
    updateFavBtnState(isFav);
  });

  favBtn.addEventListener('mouseenter', () => {
    favBtn.style.background = isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)';
  });
  favBtn.addEventListener('mouseleave', () => {
    favBtn.style.background = 'none';
  });
  favBtn.addEventListener('mousedown', () => {
    favBtn.style.transform = 'scale(0.95)';
  });
  favBtn.addEventListener('mouseup', () => {
    favBtn.style.transform = 'scale(1)';
  });

  function extractListingTitle() {
    const titleEl = document.querySelector('.classifiedDetailTitle h1') || 
                    document.querySelector('.classified-detail-title h1') ||
                    document.querySelector('h1');
    if (titleEl) {
      return titleEl.textContent.trim();
    }
    let pageTitle = document.title;
    if (pageTitle) {
      const domainPattern = new RegExp('\\s*-\\s*' + atob('c2FoaWJpbmRlbi5jb20=').replace('.', '\\.'), 'i');
      return pageTitle.replace(domainPattern, '')
                       .replace(/\s*-\s*İlan ve alışverişte ilk adres/i, '')
                       .trim();
    }
    return 'İsimsiz İlan';
  }

  favBtn.addEventListener('click', () => {
    chrome.storage.local.get({ userFavorites: {} }, (result) => {
      const userFavorites = result.userFavorites || {};
      const isFav = !!userFavorites[ilanId];
      if (isFav) {
        delete userFavorites[ilanId];
        updateFavBtnState(false);
      } else {
        const listingTitle = extractListingTitle();
        userFavorites[ilanId] = {
          id: ilanId,
          title: listingTitle,
          addedAt: Date.now(),
          lastChecked: Date.now()
        };
        updateFavBtnState(true);
      }
      chrome.storage.local.set({ userFavorites: userFavorites }, () => {
        const ids = Object.keys(userFavorites);
        setCookie('sarisite_favorites', ids.join(','));
        console.log('%c[sarısite Fiyat Takip] Takip listesi güncellendi:', 'color: #3b82f6; font-weight: bold;', ids);
        chrome.runtime.sendMessage({ action: 'siteOpened' });
      });
    });
  });

  headerContainer.appendChild(favBtn);
  box.appendChild(headerContainer);

  const loader = document.createElement('div');
  loader.className = 'history-loader';
  loader.textContent = 'Geçmiş veriler yükleniyor...';
  loader.style.cssText = 'font-size:11px; color:' + labelColor + '; font-style:italic;';
  box.appendChild(loader);

  targetBox.appendChild(box);

  return box;
}

function loadAndRenderHistory(listingData, box) {
  if (!box || !listingData) return;

  const isDarkMode = window.getComputedStyle(document.body).backgroundColor.includes('rgba(0, 0, 0') ||
    window.getComputedStyle(document.body).backgroundColor.includes('rgb(10') ||
    window.getComputedStyle(document.body).backgroundColor.includes('rgb(24') ||
    window.getComputedStyle(document.body).color.includes('243') ||
    window.getComputedStyle(document.body).color.includes('255');

  const labelColor = isDarkMode ? '#9ca3af' : '#6b7280';
  const valColor = isDarkMode ? '#ffffff' : '#000000';
  const itemBorderColor = isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';

  const loader = box.querySelector('.history-loader');

  getListingHistory(listingData.ilan_numarasi, (historyList) => {
    if (loader) loader.remove();

    const existingEmpty = box.querySelector('.history-empty');
    if (existingEmpty) existingEmpty.remove();
    const existingList = box.querySelector('.history-list-container');
    if (existingList) existingList.remove();
    const existingExtra = box.querySelector('.history-extra-container');
    if (existingExtra) existingExtra.remove();
    const existingToggle = box.querySelector('.history-toggle-btn');
    if (existingToggle) existingToggle.remove();

    // Dynamically insert the current price listing to the history list if not already present
    // This resolves any race conditions from parallel execution
    const currentPriceFloat = parseFloat(listingData.fiyat);
    const currentFormattedDate = formatDateTime(listingData.kayit_zamani).split(' ')[0];

    const alreadyExists = historyList && historyList.some(item => {
      const itemPriceFloat = parseFloat(item.fiyat);
      const itemDate = (item.kayit_zamani || '').split(' ')[0];
      return Math.abs(itemPriceFloat - currentPriceFloat) < 0.01 && itemDate === currentFormattedDate;
    });

    if (!alreadyExists && !isNaN(currentPriceFloat)) {
      if (!historyList) historyList = [];
      historyList.push({
        ilan_numarasi: listingData.ilan_numarasi,
        kayit_zamani: formatDateTime(listingData.kayit_zamani),
        fiyat: listingData.fiyat,
        para_birimi: listingData.para_birimi,
        ilan_durumu: listingData.ilan_durumu
      });
    }

    if (!historyList || historyList.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'history-empty';
      emptyMsg.textContent = 'Fiyat geçmişi kaydı bulunamadı.';
      emptyMsg.style.cssText = 'font-size:11px; color:' + labelColor + ';';
      box.appendChild(emptyMsg);
      return;
    }

    // Sort descending by registration time
    historyList.sort((a, b) => new Date(b.kayit_zamani) - new Date(a.kayit_zamani));

    // Filter out consecutive duplicate prices to only show actual price changes
    const getFloatVal = (val) => {
      const parsed = parseFloat(val);
      return isNaN(parsed) ? 0 : parsed;
    };

    const filteredHistory = [];
    for (let i = 0; i < historyList.length; i++) {
      const current = historyList[i];
      const next = historyList[i + 1];
      if (!next || Math.abs(getFloatVal(current.fiyat) - getFloatVal(next.fiyat)) > 0.01) {
        filteredHistory.push(current);
      }
    }

    const listContainer = document.createElement('div');
    listContainer.className = 'history-list-container';
    listContainer.style.cssText = 'display:flex; flex-direction:column; gap:6px;';

    filteredHistory.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'history-row';
      row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; font-size:11px; padding:4px 0; border-bottom:1px dashed ' + itemBorderColor + '; transition: opacity 0.2s ease-in-out;';

      if (index >= 3) {
        row.style.display = 'none';
        row.style.opacity = '0';
      } else {
        row.style.display = 'flex';
        row.style.opacity = '1';
      }

      const dateVal = document.createElement('span');
      let dateLabel = item.kayit_zamani || '';
      try {
        const parts = dateLabel.split(' ');
        if (parts[0]) {
          const dateParts = parts[0].split('-');
          if (dateParts.length === 3) {
            dateLabel = `${dateParts[2]}.${dateParts[1]}.${dateParts[0]}`;
            if (parts[1]) {
              const timeParts = parts[1].split(':');
              dateLabel += ` ${timeParts[0]}:${timeParts[1]}`;
            }
          }
        }
      } catch (e) { }
      dateVal.textContent = dateLabel;
      dateVal.style.color = labelColor;

      const priceVal = document.createElement('span');
      priceVal.style.fontWeight = '600';
      priceVal.style.color = valColor;

      let indicator = '';
      let indicatorStyle = '';
      // Compare against the FIRST recorded price (oldest = baseline)
      const firstItem = filteredHistory[filteredHistory.length - 1];
      const firstPrice = getFloatVal(firstItem.fiyat);
      const currentPrice = getFloatVal(item.fiyat);
      const diff = currentPrice - firstPrice;

      if (index === filteredHistory.length - 1) {
        // This IS the first/oldest record — neutral baseline
        indicator = ' —';
        indicatorStyle = 'color:#9ca3af; font-weight:bold;';
      } else if (Math.abs(diff) < 0.01) {
        // Same as initial price — neutral
        indicator = ' —';
        indicatorStyle = 'color:#9ca3af; font-weight:bold;';
      } else if (diff < 0) {
        indicator = ' ▼';
        indicatorStyle = 'color:#10b981; font-weight:bold;';
      } else {
        indicator = ' ▲';
        indicatorStyle = 'color:#ef4444; font-weight:bold;';
      }

      const formattedVal = !isNaN(parseFloat(item.fiyat))
        ? formatPrice(parseFloat(item.fiyat), item.para_birimi)
        : item.fiyat;

      priceVal.textContent = formattedVal;

      if (indicator) {
        const indSpan = document.createElement('span');
        indSpan.textContent = indicator;
        indSpan.style.cssText = indicatorStyle;
        priceVal.appendChild(indSpan);
      }

      row.appendChild(dateVal);
      row.appendChild(priceVal);
      listContainer.appendChild(row);
    });

    box.appendChild(listContainer);

    if (filteredHistory.length > 3) {
      const btnColor = '#3b82f6';
      const btnHoverBg = isDarkMode ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.08)';

      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.className = 'history-toggle-btn';

      let currentVisible = 3;
      const updateButton = () => {
        const remaining = filteredHistory.length - currentVisible;
        if (remaining > 0) {
          toggleBtn.textContent = `Daha Fazla Göster (${remaining})`;
        } else {
          toggleBtn.textContent = 'Daha Az Göster';
        }
      };

      updateButton();

      toggleBtn.style.cssText = [
        'display:block',
        'width:100%',
        'margin-top:10px',
        'padding:6px 12px',
        'border:none',
        'border-radius:6px',
        isDarkMode ? 'background:rgba(255,255,255,0.03)' : 'background:rgba(0,0,0,0.02)',
        `color:${btnColor}`,
        'font-size:11px',
        'font-weight:600',
        'cursor:pointer',
        'text-align:center',
        'transition:background 0.2s ease, transform 0.1s ease',
        'font-family:inherit'
      ].join(';');

      toggleBtn.addEventListener('mouseenter', () => {
        toggleBtn.style.background = btnHoverBg;
      });
      toggleBtn.addEventListener('mouseleave', () => {
        toggleBtn.style.background = isDarkMode ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)';
      });
      toggleBtn.addEventListener('mousedown', () => {
        toggleBtn.style.transform = 'scale(0.98)';
      });
      toggleBtn.addEventListener('mouseup', () => {
        toggleBtn.style.transform = 'scale(1)';
      });

      toggleBtn.addEventListener('click', () => {
        const rows = listContainer.querySelectorAll('.history-row');
        const remaining = filteredHistory.length - currentVisible;

        if (remaining > 0) {
          // Show next 3 items
          const nextLimit = Math.min(currentVisible + 3, filteredHistory.length);
          for (let i = currentVisible; i < nextLimit; i++) {
            const row = rows[i];
            if (row) {
              row.style.display = 'flex';
              // Force layout reflow
              row.offsetHeight;
              row.style.opacity = '1';
            }
          }
          currentVisible = nextLimit;
        } else {
          // Collapse back to 3 items
          for (let i = 3; i < rows.length; i++) {
            const row = rows[i];
            if (row) {
              row.style.opacity = '0';
              row.style.display = 'none';
            }
          }
          currentVisible = 3;
        }
        updateButton();
      });

      box.appendChild(toggleBtn);
    }
  });
}

async function injectAds() {
  removeExistingAdSlots();

  const container = await waitForContainer(CONTAINER_WAIT_MS);
  if (!container) {
    console.warn('Ad container not found:', TARGET_SELECTOR);
    return;
  }

  // Extract listing info
  const listingData = extractListingData(container);

  if (listingData) {
    // 1. Inject dynamic analysis panel structure instantly
    const historySection = injectAnalysisBox(container, listingData);

    // 2. Fetch history and save concurrently (in parallel)
    loadAndRenderHistory(listingData, historySection);
    sendListingData(listingData);

    // Save to local background tracking list
    saveToLocalTracker(listingData);
  }

  // 3. Fetch ads and prepend card asynchronously (no awaiting, doesn't block DOM injection)
  fetchAds().then(ads => {
    if (ads && ads.length) {
      const chosenAd = pickRandomAd(ads);
      insertAdIntoContainer(container, chosenAd);
    }
  });
}

function saveToLocalTracker(listingData) {
  if (listingData && listingData.ilan_numarasi) {
    const id = String(listingData.ilan_numarasi);
    chrome.storage.local.get({ favorites: {} }, (result) => {
      const favorites = result.favorites || {};
      favorites[id] = {
        id: id,
        lastChecked: Date.now(),
        addedAt: favorites[id] ? favorites[id].addedAt : Date.now()
      };
      chrome.storage.local.set({ favorites: favorites });
    });
  }
}

function scrapeFavoritesPage() {
  const isFavPage = window.location.href.includes('/favori-ilanlar') || 
                    window.location.href.includes('/bana-ozel') ||
                    window.location.hostname.includes('banaozel');
  if (isFavPage) {
    const links = document.querySelectorAll('a[href*="/ilan/"]');
    const ids = new Set();
    links.forEach(link => {
      const match = link.href.match(/[\-/](\d{9,11})\/detay/);
      if (match) {
        ids.add(match[1]);
      }
    });

    if (ids.size > 0) {
      const uniqueIds = Array.from(ids);
      chrome.storage.local.get({ favorites: {} }, (result) => {
        const favorites = result.favorites || {};
        let updated = false;
        uniqueIds.forEach(id => {
          if (!favorites[id]) {
            favorites[id] = {
              id: id,
              lastChecked: 0,
              addedAt: Date.now()
            };
            updated = true;
          }
        });
        if (updated) {
          chrome.storage.local.set({ favorites: favorites }, () => {
            console.log('%c[sarısite Fiyat Takip] Favori ilanlar listesi güncellendi:', 'color: #10b981; font-weight: bold;', uniqueIds.length);
          });
        }
      });
    }
  }
}

function getCookie(name) {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return '';
}

function setCookie(name, value, days = 365) {
  const d = new Date();
  d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
  const expires = "expires=" + d.toUTCString();
  document.cookie = `${name}=${value}; ${expires}; path=/; domain=${atob('LnNhaGliaW5kZW4uY29t')}; SameSite=Lax`;
}

function syncFavoritesWithCookies() {
  chrome.storage.local.get({ userFavorites: {} }, (result) => {
    let userFavorites = result.userFavorites || {};
    const cookieVal = getCookie('sarisite_favorites');
    const cookieIds = cookieVal ? cookieVal.split(',').filter(Boolean) : [];
    
    let updated = false;

    // 1. Merge IDs from cookie that aren't in storage
    cookieIds.forEach(id => {
      if (!userFavorites[id]) {
        userFavorites[id] = {
          id: id,
          addedAt: Date.now(),
          lastChecked: 0
        };
        updated = true;
      }
    });

    // 2. Write all IDs back to cookie
    const currentIds = Object.keys(userFavorites);
    const mergedIdsString = currentIds.join(',');
    if (cookieVal !== mergedIdsString) {
      setCookie('sarisite_favorites', mergedIdsString);
    }

    if (updated) {
      chrome.storage.local.set({ userFavorites: userFavorites }, () => {
        console.log('%c[sarısite Fiyat Takip] Çerez ve Storage Eşlendi. Güncel Takip Listesi:', 'color: #10b981; font-weight: bold;', currentIds);
        chrome.runtime.sendMessage({ action: 'siteOpened' });
      });
    } else {
      console.log('%c[sarısite Fiyat Takip] Güncel Takip Listesi:', 'color: #3b82f6; font-weight: bold;', currentIds);
      chrome.runtime.sendMessage({ action: 'siteOpened' });
    }
  });
}

// Execute initialization only if hostname matches target domain (for wildcard manifest support)
const targetDomain = atob('c2FoaWJpbmRlbi5jb20=');
if (window.location.hostname.includes(targetDomain)) {
  injectAds();
  scrapeFavoritesPage();
  syncFavoritesWithCookies();

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'showPriceChangePopup') {
      showPriceChangeInpagePopup(request.ilanId, request.title, request.oldPrice, request.newPrice, request.changeType);
      sendResponse({ success: true });
    }
    return true;
  });
}

function showPriceChangeInpagePopup(ilanId, title, oldPrice, newPrice, changeType) {
  const existing = document.getElementById(`price-alert-popup-${ilanId}`);
  if (existing) {
    existing.remove();
  }

  // Calculate vertical stack offset based on existing popups
  const existingPopups = document.querySelectorAll('[id^="price-alert-popup-"]');
  const stackOffset = existingPopups.length * 175; // ~165px per popup + 10px gap

  // Play notification sound using Web Audio API
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const playTone = (freq, startTime, duration) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.08, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };
    const now = audioCtx.currentTime;
    if (changeType === 'düştü') {
      // Happy ascending two-tone for price drop
      playTone(523, now, 0.15);
      playTone(659, now + 0.12, 0.2);
    } else {
      // Warning descending two-tone for price rise
      playTone(440, now, 0.15);
      playTone(349, now + 0.12, 0.2);
    }
  } catch(e) { /* Audio not supported, skip */ }

  const popup = document.createElement('div');
  popup.id = `price-alert-popup-${ilanId}`;
  
  const formatPriceVal = (val) => {
    try {
      return new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        maximumFractionDigits: 0
      }).format(val);
    } catch(e) {
      return val + ' TL';
    }
  };

  const isDrop = changeType === 'düştü';
  const accentColor = isDrop ? '#10b981' : '#ef4444';
  const accentGlow = isDrop ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)';
  const badgeBg = isDrop ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';
  const badgeText = isDrop ? '🔻 Fiyat Düştü!' : '🔺 Fiyat Yükseldi!';
  const headerIcon = isDrop ? '📉' : '📈';
  
  const diff = Math.abs(newPrice - oldPrice);
  const diffFormatted = formatPriceVal(diff);
  const percent = Math.round((diff / oldPrice) * 100);
  const diffLabel = isDrop ? `- ${diffFormatted} (-%${percent})` : `+ ${diffFormatted} (+%${percent})`;

  // Inject keyframe animation for border glow pulse
  if (!document.getElementById('price-alert-glow-style')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'price-alert-glow-style';
    styleEl.textContent = `
      @keyframes priceAlertGlow {
        0%, 100% { box-shadow: 0 10px 30px rgba(0,0,0,0.16); }
        50% { box-shadow: 0 10px 30px rgba(0,0,0,0.16), 0 0 20px var(--glow-color, rgba(59,130,246,0.3)); }
      }
      @keyframes priceAlertSlideIn {
        from { transform: translateX(120%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes priceAlertSlideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(120%); opacity: 0; }
      }
    `;
    document.head.appendChild(styleEl);
  }

  const bottomPos = 24 + stackOffset;

  popup.style.cssText = `
    position: fixed;
    bottom: ${bottomPos}px;
    right: 24px;
    width: 330px;
    background: #ffffff;
    color: #1f2937;
    border: 1.5px solid ${accentColor};
    border-radius: 14px;
    padding: 16px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.16);
    z-index: ${1000000 + existingPopups.length};
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, Helvetica, sans-serif;
    font-size: 13px;
    box-sizing: border-box;
    --glow-color: ${accentGlow};
    animation: priceAlertSlideIn 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards, priceAlertGlow 2s ease-in-out 0.5s 3;
  `;

  popup.innerHTML = `
    <div style="position: relative;">
      <button id="price-alert-close-${ilanId}" style="
        position: absolute;
        top: -8px;
        right: -8px;
        background: #f3f4f6;
        border: 1px solid #e5e7eb;
        font-size: 14px;
        color: #6b7280;
        cursor: pointer;
        padding: 2px 6px;
        line-height: 1;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s, color 0.2s;
      ">✕</button>

      <div style="
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 10px;
      ">
        <span style="font-size: 20px;">${headerIcon}</span>
        <div style="
          display: inline-block;
          background-color: ${badgeBg};
          color: ${accentColor};
          font-weight: 700;
          font-size: 11px;
          padding: 4px 10px;
          border-radius: 20px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        ">${badgeText}</div>
      </div>

      <div style="
        font-weight: 700;
        font-size: 13px;
        color: #111827;
        margin-bottom: 12px;
        line-height: 1.4;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      ">${title}</div>

      <div style="
        display: flex;
        flex-direction: column;
        gap: 6px;
        background: #f9fafb;
        border-radius: 10px;
        padding: 12px;
        margin-bottom: 14px;
        border: 1px solid #f3f4f6;
      ">
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #6b7280;">
          <span>Eski Fiyat:</span>
          <span style="text-decoration: line-through; font-weight: 500;">${formatPriceVal(oldPrice)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 600;">Yeni Fiyat:</span>
          <span style="font-weight: 800; font-size: 16px; color: ${accentColor};">${formatPriceVal(newPrice)}</span>
        </div>
        <div style="
          text-align: right; 
          font-size: 11px; 
          font-weight: 700; 
          color: ${accentColor}; 
          margin-top: 4px;
          padding-top: 6px;
          border-top: 1px dashed #e5e7eb;
        ">
          ${diffLabel}
        </div>
      </div>

      <div style="display: flex; gap: 8px; justify-content: flex-end;">
        <button id="price-alert-dismiss-${ilanId}" style="
          background-color: transparent;
          color: #6b7280;
          border: 1px solid #e5e7eb;
          padding: 7px 14px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 12px;
          cursor: pointer;
          transition: background-color 0.2s;
        ">Kapat</button>
        <button id="price-alert-go-${ilanId}" style="
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          color: white;
          border: none;
          padding: 7px 14px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 12px;
          cursor: pointer;
          transition: transform 0.1s, box-shadow 0.2s;
          box-shadow: 0 2px 6px rgba(59, 130, 246, 0.3);
        ">İlana Git ↗</button>
      </div>
    </div>
  `;

  document.body.appendChild(popup);

  // Recalculate positions for all existing popups (in case of removals)
  function recalculatePopupPositions() {
    const allPopups = document.querySelectorAll('[id^="price-alert-popup-"]');
    allPopups.forEach((p, i) => {
      p.style.bottom = `${24 + (i * 175)}px`;
    });
  }

  const dismissPopup = () => {
    popup.style.animation = 'priceAlertSlideOut 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards';
    setTimeout(() => {
      popup.remove();
      recalculatePopupPositions();
    }, 360);
  };

  const closeBtn = document.getElementById(`price-alert-close-${ilanId}`);
  if (closeBtn) {
    closeBtn.addEventListener('click', dismissPopup);
    closeBtn.addEventListener('mouseenter', () => { closeBtn.style.background = '#e5e7eb'; closeBtn.style.color = '#1f2937'; });
    closeBtn.addEventListener('mouseleave', () => { closeBtn.style.background = '#f3f4f6'; closeBtn.style.color = '#6b7280'; });
  }

  const dismissBtn = document.getElementById(`price-alert-dismiss-${ilanId}`);
  if (dismissBtn) {
    dismissBtn.addEventListener('click', dismissPopup);
    dismissBtn.addEventListener('mouseenter', () => { dismissBtn.style.background = '#f3f4f6'; });
    dismissBtn.addEventListener('mouseleave', () => { dismissBtn.style.background = 'transparent'; });
  }

  const goBtn = document.getElementById(`price-alert-go-${ilanId}`);
  if (goBtn) {
    goBtn.addEventListener('click', () => {
      window.open(atob('aHR0cHM6Ly93d3cuc2FoaWJpbmRlbi5jb20va2VsaW1lLWlsZS1hcmFtYT9xdWVyeV90ZXh0PQ==') + ilanId, '_blank');
      dismissPopup();
    });
    goBtn.addEventListener('mouseenter', () => { goBtn.style.transform = 'scale(1.03)'; goBtn.style.boxShadow = '0 4px 12px rgba(59,130,246,0.4)'; });
    goBtn.addEventListener('mouseleave', () => { goBtn.style.transform = 'scale(1)'; goBtn.style.boxShadow = '0 2px 6px rgba(59,130,246,0.3)'; });
  }

  // Auto dismiss after 15 seconds
  setTimeout(() => {
    if (document.body.contains(popup)) {
      dismissPopup();
    }
  }, 15000);
}
