// ============================================
// Sarı Site Açık Sayfa Tarayıcı (API POST)
// Chrome Extension Version (Manifest V3)
// ============================================

(function () {
    'use strict';

    const targetDomain = atob('c2FoaWJpbmRlbi5jb20=');
    if (!window.location.hostname.includes(targetDomain)) {
        return;
    }

    const SAVE_API_URL = 'https://sarisite.alperenakkaya.dev/index.php';

    let scanRunId = 0;
    let isScanning = false;
    let lastScannedKey = '';
    let lastUrl = window.location.href;
    let scanTimeout = null;

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const sendDataToServer = (payload) => {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                action: 'sendListingData',
                url: SAVE_API_URL,
                payload: payload
            }, (response) => {
                if (chrome.runtime.lastError) {
                    return reject(chrome.runtime.lastError.message);
                }
                if (response && response.success) {
                    const apiData = response.data;
                    if (apiData && apiData.success) {
                        resolve(apiData);
                    } else {
                        reject(apiData ? (apiData.error || apiData.message || 'API Hatası') : 'Sunucu kaydetmedi');
                    }
                } else {
                    reject(response ? response.error : 'Bağlantı hatası');
                }
            });
        });
    };

    const getTimestamp = () => {
        const now = new Date();
        const pad = n => String(n).padStart(2, '0');
        return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    };

    const extractDataFromDocument = (doc) => {
        const pageData = [];
        const rows = doc.querySelectorAll('tr.searchResultsItem:not(.nativeAd)');

        rows.forEach(row => {
            const id = row.getAttribute('data-id');
            const priceEl = row.querySelector('.searchResultsPriceValue span');

            if (!id || !priceEl) return;

            const priceText = priceEl.textContent.trim();

            let fiyat = 0;
            let para_birimi = 'TRY';

            const match = priceText.match(/([\d\.]+)\s*(TL|TRY|USD|EUR|GBP)?/i);

            if (match) {
                fiyat = parseInt(match[1].replace(/\./g, ''), 10) || 0;

                if (match[2]) {
                    const currency = match[2].toUpperCase();
                    if (currency === 'TL') {
                        para_birimi = 'TRY';
                    } else {
                        para_birimi = currency;
                    }
                }
            }

            pageData.push({
                action: 'save',
                ilan_numarasi: parseInt(id, 10),
                kayit_zamani: getTimestamp(),
                fiyat,
                para_birimi,
                ilan_durumu: 'ACIK'
            });
        });

        return pageData;
    };

    const getAdsCount = () => {
        return document.querySelectorAll('tr.searchResultsItem:not(.nativeAd)').length;
    };

    const isListingPage = () => {
        return !!(
            document.getElementById('searchResultsTable') ||
            document.querySelector('.searchResultsTable') ||
            document.querySelector('.searchResultsRowClass') ||
            document.querySelector('tr.searchResultsItem')
        );
    };

    const checkAndScan = async () => {
        if (!isListingPage()) return;

        const ads = extractDataFromDocument(document);
        if (ads.length === 0) return;

        // Key is based purely on listing IDs to prevent redundant scans on static pages
        const currentKey = ads.map(ad => ad.ilan_numarasi).sort().join(',');
        if (currentKey === lastScannedKey) return;

        lastScannedKey = currentKey;
        
        // Increment run ID to abort any previous running scans
        const runId = ++scanRunId;
        isScanning = true;

        let sentCount = 0;
        console.log(`%c[sarısite Otomatik Tarayıcı] Yeni sayfa/içerik algılandı. Tarama başlatılıyor... (İlan Sayısı: ${ads.length})`, 'color: #00339f; font-weight: bold;');

        try {
            const promises = ads.map(async (ad) => {
                if (runId !== scanRunId) return;

                try {
                    await sendDataToServer(ad);
                    if (runId !== scanRunId) return;
                    
                    sentCount++;
                    console.log(`[${sentCount}/${ads.length}] Gönderildi`, ad.ilan_numarasi);
                } catch (err) {
                    console.error(`İlan gönderilemedi: ${ad.ilan_numarasi}`, err);
                }
            });

            await Promise.all(promises);
            
            if (runId === scanRunId) {
                console.log(`%c[sarısite Otomatik Tarayıcı] Tarama tamamlandı. Gönderilen: ${sentCount}/${ads.length}`, 'color: #10b981; font-weight: bold;');
                isScanning = false;
            }
        } catch (err) {
            console.error('[sarısite Otomatik Tarayıcı] Hata:', err);
            if (runId === scanRunId) {
                isScanning = false;
            }
        }
    };

    const triggerAutoScan = () => {
        if (scanTimeout) clearTimeout(scanTimeout);
        scanTimeout = setTimeout(checkAndScan, 1000); // 1s delay is optimal for dynamic content stability
    };

    const initScanner = () => {
        // Run immediately if listings exist
        if (isListingPage() && getAdsCount() > 0) {
            triggerAutoScan();
        }

        // SPA dynamically checks the listing status via MutationObserver
        const observer = new MutationObserver(() => {
            // Check if URL changed
            if (window.location.href !== lastUrl) {
                lastUrl = window.location.href;
                console.log('%c[sarısite Otomatik Tarayıcı] Sayfa geçişi algılandı:', 'color: #f59e0b; font-weight: bold;', lastUrl);
                lastScannedKey = ''; // Clear scan key to force rescan
                triggerAutoScan();
            } else if (isListingPage() && getAdsCount() > 0) {
                triggerAutoScan();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    };

    // Trigger initialization
    if (document.body) {
        initScanner();
    } else {
        window.addEventListener('DOMContentLoaded', initScanner);
    }

})();

