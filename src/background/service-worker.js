const DONATION_URL = 'https://pay.alperenakkaya.dev/ads';
const SAVE_API_URL = 'https://sarisite.alperenakkaya.dev/index.php';

// Listener to handle requests from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'sendListingData' || request.action === 'getListingHistory') {
    (async () => {
      try {
        console.log(`[Background] Action: ${request.action} | Request URL: ${request.url} | Payload:`, request.payload);

        const response = await fetch(request.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(request.payload)
        });

        const text = await response.text();
        console.log(`[Background] Response Status: ${response.status} | Raw Body:`, text);

        let data = {};
        try {
          data = JSON.parse(text);
        } catch (e) {
          data = { rawResponse: text };
        }

        if (!response.ok) {
          sendResponse({ success: false, error: `HTTP ${response.status}: ${data.error || 'Server error'}` });
        } else {
          sendResponse({ success: true, data });
        }
      } catch (error) {
        console.error('[Background] Error handling message:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();

    return true; // Keep message channel open
  } else if (request.action === 'siteOpened') {
    triggerQueueProcessing(request.force, request.targetId);
    sendResponse({ success: true });
    return true;
  }
});

// --- Automatic Background Crawler ---
// Checks pending favorites sequentially with security wait times
// only when the user is actively browsing or has a Sarı Site tab open.

// Resume queue processing if it was interrupted (e.g. extension reload or service worker restart)
chrome.storage.local.get({ crawlerState: {} }, (result) => {
  const state = result.crawlerState || {};
  if (state.isProcessing) {
    console.log('[sarısite Fiyat Takip] Yarım kalan tarama işlemi tespit edildi, kaldığı yerden devam ediliyor...');
    if (state.nextCheckTime) {
      const rem = state.nextCheckTime - Date.now();
      if (rem <= 0) {
        processNextInQueue();
      } else {
        chrome.alarms.create('processNextQueueItemAlarm', { when: state.nextCheckTime });
      }
    } else {
      processNextInQueue();
    }
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('checkFavoritesAlarm', { periodInMinutes: 5 });
  // Set initial idle state
  chrome.storage.local.set({
    crawlerState: {
      isProcessing: false,
      currentItem: null,
      queue: [],
      remainingQueueCount: 0,
      totalQueueCount: 0,
      nextCheckTime: null,
      currentWaitTime: null,
      isForcedRun: false,
      nextAlarmTime: Date.now() + 5 * 60 * 1000,
      lastMessage: 'Tarama beklemede.',
      lastScanTime: null
    }
  });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create('checkFavoritesAlarm', { periodInMinutes: 5 });
  // Set nextAlarmTime on startup
  chrome.storage.local.get({ crawlerState: {} }, (result) => {
    const currentState = result.crawlerState || {};
    chrome.storage.local.set({
      crawlerState: {
        ...currentState,
        nextAlarmTime: Date.now() + 5 * 60 * 1000
      }
    });
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkFavoritesAlarm') {
    // Before triggering, set the nextAlarmTime to 5 minutes in the future
    chrome.storage.local.get({ crawlerState: {} }, (result) => {
      const currentState = result.crawlerState || {};
      chrome.storage.local.set({
        crawlerState: {
          ...currentState,
          nextAlarmTime: Date.now() + 5 * 60 * 1000
        }
      }, () => {
        triggerQueueProcessing();
      });
    });
  } else if (alarm.name === 'processNextQueueItemAlarm') {
    processNextInQueue();
  }
});

// Trigger check when a Sarı Site page is opened or updated
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes(atob('c2FoaWJpbmRlbi5jb20='))) {
    triggerQueueProcessing();
  }
});

// --- Persisted State Helper ---
function updateCrawlerState(stateUpdate, callback) {
  chrome.storage.local.get({ crawlerState: {} }, (result) => {
    const currentState = result.crawlerState || {};
    const newState = { ...currentState, ...stateUpdate };
    chrome.storage.local.set({ crawlerState: newState }, () => {
      if (callback) callback(newState);
    });
  });
}

let isFetching = false;

function triggerQueueProcessing(force = false, targetId = null) {
  chrome.storage.local.get({ userFavorites: {}, autoScanEnabled: true, crawlerState: {} }, (result) => {
    // Abort automatic scans if disabled by the user and this is not a manual (forced) scan
    if (!result.autoScanEnabled && !force && !targetId) {
      return;
    }

    const userFavorites = result.userFavorites || {};
    const list = Object.values(userFavorites);
    if (list.length === 0) return;

    let candidates = [];
    if (targetId) {
      const item = userFavorites[targetId];
      if (!item) return;
      candidates = [item];
    } else if (force) {
      candidates = list;
    } else {
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      candidates = list.filter(item => !item.lastChecked || item.lastChecked < oneHourAgo);
      // Shuffle candidates to randomize indexing order and mimic human activity
      candidates.sort(() => Math.random() - 0.5);
      // Limit to at most 3 candidates in a single indexing run for background scans
      candidates = candidates.slice(0, 3);
    }

    if (candidates.length === 0) return;

    const crawlerState = result.crawlerState || {};
    let currentQueue = crawlerState.queue || [];
    let isForced = crawlerState.isForcedRun || false;
    let currentItem = crawlerState.currentItem || null;

    if (force || targetId) {
      // Cancel any existing alarm for next item
      chrome.alarms.clear('processNextQueueItemAlarm');
      isForced = true;
      
      let newQueue = [];
      if (targetId) {
        newQueue = [targetId];
      } else {
        candidates.sort(() => Math.random() - 0.5);
        newQueue = candidates.map(c => c.id);
      }

      // If we are currently fetching an item, remove it from queue to avoid duplicate/overlapping fetches
      if (currentItem) {
        newQueue = newQueue.filter(id => id !== currentItem);
      }
      currentQueue = newQueue;
    } else {
      // For background scans, append if not already in queue and not currently scanning
      candidates.forEach(cand => {
        if (!currentQueue.includes(cand.id) && cand.id !== currentItem) {
          currentQueue.push(cand.id);
        }
      });
    }

    if (currentQueue.length === 0) return;

    // Update state
    updateCrawlerState({
      isProcessing: true,
      queue: currentQueue,
      remainingQueueCount: currentQueue.length,
      totalQueueCount: (force || targetId) ? currentQueue.length : Math.max(currentQueue.length, crawlerState.totalQueueCount || 3),
      isForcedRun: isForced,
      currentItem: currentItem,
      nextItem: currentQueue[0],
      lastMessage: targetId 
        ? `İlan #${targetId} için manuel tarama başlatıldı...` 
        : (force ? 'Manuel tarama anlık olarak başlatıldı...' : 'Sıradaki ilanlar kuyruğa alındı...')
    }, () => {
      // Start processing if not currently doing so
      if (!currentItem) {
        chrome.alarms.get('processNextQueueItemAlarm', (alarm) => {
          if (!alarm) {
            processNextInQueue();
          }
        });
      }
    });
  });
}

function processNextInQueue() {
  if (isFetching) return;
  isFetching = true;

  chrome.storage.local.get({ crawlerState: {} }, (result) => {
    const crawlerState = result.crawlerState || {};
    let queue = crawlerState.queue || [];
    let isForcedRun = crawlerState.isForcedRun || false;

    if (queue.length === 0) {
      // Done processing
      updateCrawlerState({
        isProcessing: false,
        currentItem: null,
        nextItem: null,
        queue: [],
        remainingQueueCount: 0,
        totalQueueCount: 0,
        nextCheckTime: null,
        currentWaitTime: null,
        isForcedRun: false,
        nextAlarmTime: Date.now() + 5 * 60 * 1000,
        lastMessage: 'Tüm takip listesi güncel.',
        lastScanTime: Date.now()
      }, () => {
        isFetching = false;
      });
      return;
    }

    const targetId = queue.shift();
    const url = atob('aHR0cHM6Ly93d3cuc2FoaWJpbmRlbi5jb20va2VsaW1lLWlsZS1hcmFtYT9xdWVyeV90ZXh0PQ==') + targetId;

    console.log(`[sarısite Fiyat Takip] Arka planda sıradaki ilan sorgulanıyor (Kelime Arama): ${targetId}`);

    updateCrawlerState({
      isProcessing: true,
      currentItem: targetId,
      nextItem: queue.length > 0 ? queue[0] : null,
      queue: queue,
      remainingQueueCount: queue.length,
      nextCheckTime: null,
      currentWaitTime: null,
      isForcedRun: isForcedRun,
      lastMessage: `İlan #${targetId} sorgulanıyor...`
    }, () => {
      const controller = new AbortController();
      const fetchTimeout = setTimeout(() => {
        controller.abort();
        console.warn(`[sarısite Fiyat Takip] İlan #${targetId} sorgusu zaman aşımına uğradı (15sn).`);
      }, 15000);

      fetch(url, { signal: controller.signal })
        .then(res => {
          clearTimeout(fetchTimeout);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.text();
        })
        .then(htmlText => {
          const data = parseHTMLWithRegex(htmlText, targetId);
          if (data) {
            saveListingData(data);
          }
          
          chrome.storage.local.get({ userFavorites: {} }, (result) => {
            const userFavorites = result.userFavorites || {};
            if (userFavorites[targetId]) {
              userFavorites[targetId].lastChecked = Date.now();
              
              if (data) {
                const oldPrice = parseFloat(userFavorites[targetId].price);
                const newPrice = parseFloat(data.fiyat);
                
                const currentTitle = userFavorites[targetId].title;
                const isFallback = !currentTitle || 
                                   currentTitle.startsWith('İlan No:') || 
                                   currentTitle === 'İsimsiz İlan';
                
                if (data.baslik && isFallback) {
                  userFavorites[targetId].title = data.baslik;
                }

                if (oldPrice && newPrice && oldPrice !== newPrice) {
                  const changeType = newPrice < oldPrice ? 'düştü' : 'yükseldi';
                  notifyPriceChange(targetId, userFavorites[targetId].title || `İlan #${targetId}`, oldPrice, newPrice, changeType);
                }

                userFavorites[targetId].price = newPrice;
              }
              
              chrome.storage.local.set({ userFavorites: userFavorites });
            }
          });
        })
        .catch(err => {
          clearTimeout(fetchTimeout);
          console.warn(`[sarısite Fiyat Takip] Arka plan favori sorgusu başarısız (${targetId}):`, err);
          chrome.storage.local.get({ userFavorites: {} }, (result) => {
            const userFavorites = result.userFavorites || {};
            if (userFavorites[targetId]) {
              userFavorites[targetId].lastChecked = Date.now();
              chrome.storage.local.set({ userFavorites: userFavorites });
            }
          });
        })
        .finally(() => {
          isFetching = false;
          
          chrome.storage.local.get({ crawlerState: {} }, (resultState) => {
            const latestState = resultState.crawlerState || {};
            const updatedQueue = latestState.queue || [];
            
            if (updatedQueue.length > 0) {
              let minSec = 60;   // 1 minute
              let maxSec = 2100; // 35 minutes
              if (latestState.isForcedRun) {
                minSec = 60;   // 1 minute
                maxSec = 300;  // 5 minutes
              }
              
              const waitMs = Math.floor(Math.random() * (maxSec - minSec + 1) + minSec) * 1000;
              const nextTime = Date.now() + waitMs;

              updateCrawlerState({
                isProcessing: true,
                currentItem: null,
                nextItem: updatedQueue[0],
                queue: updatedQueue,
                remainingQueueCount: updatedQueue.length,
                nextCheckTime: nextTime,
                currentWaitTime: waitMs,
                lastMessage: latestState.isForcedRun 
                  ? `Hızlı güvenlik beklemesi: Sıradaki ilana geçiliyor...`
                  : `Güvenlik bekleme süresi: Sıradaki ilana geçiliyor...`
              }, () => {
                chrome.alarms.create('processNextQueueItemAlarm', { when: nextTime });
              });
            } else {
              updateCrawlerState({
                isProcessing: false,
                currentItem: null,
                nextItem: null,
                queue: [],
                remainingQueueCount: 0,
                totalQueueCount: 0,
                nextCheckTime: null,
                currentWaitTime: null,
                isForcedRun: false,
                nextAlarmTime: Date.now() + 5 * 60 * 1000,
                lastMessage: 'Tüm takip listesi güncel.',
                lastScanTime: Date.now()
              });
            }
          });
        });
    });
  });
}

function parseHTMLWithRegex(htmlText, ilanId) {
  let fiyat = '';
  let paraBirimi = 'TRY';
  
  // Scrape price
  const priceWrapperMatch = htmlText.match(/class="classified-price-wrapper"\s*>\s*([^<]+)/);
  let rawPrice = '';
  if (priceWrapperMatch) {
    rawPrice = priceWrapperMatch[1].trim();
  } else {
    const priceClassMatch = htmlText.match(/class="classified-price"\s*>\s*([^<]+)/) ||
                            htmlText.match(/class="price"\s*>\s*([^<]+)/);
    if (priceClassMatch) rawPrice = priceClassMatch[1].trim();
  }

  if (!rawPrice) {
    const ogPriceMatch = htmlText.match(/property="og:price:amount"\s*content="([^"]+)"/) ||
                         htmlText.match(/property="product:price:amount"\s*content="([^"]+)"/);
    if (ogPriceMatch) rawPrice = ogPriceMatch[1];
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
      const ogCurrencyMatch = htmlText.match(/property="og:price:currency"\s*content="([^"]+)"/) ||
                              htmlText.match(/property="product:price:currency"\s*content="([^"]+)"/);
      if (ogCurrencyMatch) paraBirimi = ogCurrencyMatch[1].trim().toUpperCase();
    }

    fiyat = rawPrice.replace(/[^0-9]/g, '');
  }

  if (!fiyat) return null;

  // Scrape date
  let kayitZamani = '';
  const dateLabelMatch = htmlText.match(/İlan Tarihi[\s\S]*?class="classifiedInfoValue"\s*>\s*([^<]+)/i);
  if (dateLabelMatch) {
    kayitZamani = dateLabelMatch[1].trim();
  }

  const formattedDate = formatDateTimeBackground(kayitZamani);

  // Scrape title
  let baslik = '';
  // 1. Try to find the h1 inside classifiedDetailTitle (detail page)
  const detailTitleMatch = htmlText.match(/class="classifiedDetailTitle"[\s\S]*?<h1>([\s\S]*?)<\/h1>/i) ||
                           htmlText.match(/class="classified-detail-title"[\s\S]*?<h1>([\s\S]*?)<\/h1>/i);
  
  if (detailTitleMatch) {
    baslik = detailTitleMatch[1];
  } else {
    // 2. Try to find the title link matching the ilanId in search results
    const regex1 = new RegExp(`class="[^"]*classifiedTitle[^"]*"[^>]*href="[^"]*${ilanId}[%2f\/_d\\d-]*"[^>]*>([\\s\\S]*?)<\/a>`, 'i');
    const regex2 = new RegExp(`href="[^"]*${ilanId}[%2f\/_d\\d-]*"[^>]*class="[^"]*classifiedTitle[^"]*"[^>]*>([\\s\\S]*?)<\/a>`, 'i');
    const searchTitleMatch = htmlText.match(regex1) || htmlText.match(regex2);
    
    if (searchTitleMatch) {
      baslik = searchTitleMatch[1];
    } else {
      // 3. Fallback to <title> tag
      const titleMatch = htmlText.match(/<title>([\s\S]*?)<\/title>/i);
      if (titleMatch) {
        baslik = titleMatch[1];
      }
    }
  }

  if (baslik) {
    baslik = baslik.replace(/<[^>]*>/g, '') // remove HTML tags
                   .replace(/&amp;/g, '&')
                   .replace(/&lt;/g, '<')
                   .replace(/&gt;/g, '>')
                   .replace(/&quot;/g, '"')
                   .replace(/&#039;/g, "'")
                   .replace(/\s+/g, ' ') // collapse multiple spaces/newlines
                   .trim();
                   
    // If the title fallback-ed to the search results page title like "Kelime ile Arama - XXXXXXX", ignore it
    if (baslik.includes('Kelime ile Arama') || baslik.includes('Arama Sonuçları') || baslik.includes(atob('c2FoaWJpbmRlbi5jb20='))) {
      baslik = '';
    }
  }

  return {
    ilan_numarasi: ilanId,
    kayit_zamani: formattedDate,
    fiyat: fiyat,
    para_birimi: paraBirimi === 'TL' ? 'TRY' : paraBirimi,
    ilan_durumu: 'ACIK',
    baslik: baslik
  };
}

function formatDateTimeBackground(dateStr) {
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

function saveListingData(payload) {
  fetch(SAVE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })
  .then(res => res.json())
  .then(data => {
    console.log('[sarısite Fiyat Takip] Background auto-save success:', data);
  })
  .catch(err => {
    console.warn('[sarısite Fiyat Takip] Background auto-save failed:', err);
  });
}

function notifyPriceChange(ilanId, title, oldPrice, newPrice, changeType) {
  const payload = {
    action: 'showPriceChangePopup',
    ilanId: ilanId,
    title: title,
    oldPrice: oldPrice,
    newPrice: newPrice,
    changeType: changeType
  };

  // Notify all open target tabs dynamically
  chrome.tabs.query({}, (tabs) => {
    if (tabs && tabs.length > 0) {
      const targetDomain = atob('c2FoaWJpbmRlbi5jb20=');
      tabs.forEach((tab) => {
        if (tab.url && tab.url.includes(targetDomain)) {
          chrome.tabs.sendMessage(tab.id, payload).catch(err => {
            // ignore tabs not fully loaded or active
          });
        }
      });
    }
  });

  // Also notify the extension popup (if open)
  chrome.runtime.sendMessage(payload).catch(err => {
    // popup not open, ignore
  });
}

