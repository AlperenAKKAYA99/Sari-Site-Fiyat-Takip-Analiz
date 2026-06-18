// ============================================
// Sarı Site Hover Bilgi Paneli - Content Script
// Chrome Extension Version (Manifest V3)
// Anlık Ayar Güncelleme Destekli
// ============================================

(function () {
    'use strict';

    const targetDomain = atob('c2FoaWJpbmRlbi5jb20=');
    if (!window.location.hostname.includes(targetDomain)) {
        return;
    }

    const SAVE_API_URL = 'https://sarisite.alperenakkaya.dev/index.php';

    // ========================
    // SETTINGS (loaded from chrome.storage)
    // ========================
    let SETTINGS = {
        enabled: true,
        delay: 800,
        hideDelay: 400,
        highlightWords: true,
        showDamage: true
    };

    let popupHideTimer = null;
    let _toastTimer = null;
    let _mutationObserver = null;
    let _activeRow = null;

    // ========================
    // LOAD & WATCH SETTINGS
    // ========================

    // Load settings from chrome.storage.sync directly (no background needed)
    function loadSettings() {
        return new Promise((resolve) => {
            chrome.storage.sync.get('settings', (data) => {
                if (data.settings) {
                    SETTINGS = { ...SETTINGS, ...data.settings };
                }
                resolve(SETTINGS);
            });
        });
    }

    // CORE: Listen for storage changes — works even if background is asleep
    // This fires instantly when popup writes to chrome.storage.sync
    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'sync' || !changes.settings) return;

        const oldSettings = { ...SETTINGS };
        const newSettings = changes.settings.newValue;

        if (newSettings) {
            SETTINGS = { ...SETTINGS, ...newSettings };
        }

        // Handle enabled/disabled toggle
        if (oldSettings.enabled && !SETTINGS.enabled) {
            onDisabled();
        } else if (!oldSettings.enabled && SETTINGS.enabled) {
            onEnabled();
        }

        // If popup is currently visible and a visual setting changed, refresh it
        if (SETTINGS.enabled) {
            const visualChanged = (
                oldSettings.showDamage !== SETTINGS.showDamage ||
                oldSettings.highlightWords !== SETTINGS.highlightWords
            );
            if (visualChanged) {
                refreshActivePopup();
            }
        }

        // Show a toast on the page so user sees instant feedback
        showSettingsToast(oldSettings, SETTINGS);
    });

    // Also listen for message-based updates (backup for edge cases)
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'SETTINGS_UPDATED') {
            const oldSettings = { ...SETTINGS };
            SETTINGS = { ...SETTINGS, ...message.settings };

            if (oldSettings.enabled && !SETTINGS.enabled) {
                onDisabled();
            } else if (!oldSettings.enabled && SETTINGS.enabled) {
                onEnabled();
            }

            if (SETTINGS.enabled) {
                const visualChanged = (
                    oldSettings.showDamage !== SETTINGS.showDamage ||
                    oldSettings.highlightWords !== SETTINGS.highlightWords
                );
                if (visualChanged) {
                    refreshActivePopup();
                }
            }
        }
    });

    // ========================
    // ENABLE / DISABLE HANDLERS
    // ========================

    function onDisabled() {
        // Remove any existing popup
        const existing = document.querySelector('.sahipanel-popup');
        if (existing) {
            existing.classList.remove('sahipanel-visible');
            setTimeout(() => existing.remove(), 250);
        }
        // Clear any pending timers
        if (popupHideTimer) {
            clearTimeout(popupHideTimer);
            popupHideTimer = null;
        }
    }

    function onEnabled() {
        // Re-initialize panel bindings on existing DOM elements
        initPanel();
    }

    // ========================
    // REFRESH ACTIVE POPUP
    // ========================

    // If a popup is open, find the hovered row and re-render
    function refreshActivePopup() {
        const popup = document.querySelector('.sahipanel-popup');
        if (!popup || !_activeRow) return;

        // Get the content container and re-load
        const contentDiv = popup.querySelector('.sahipanel-content');
        if (contentDiv) {
            loadDetails(contentDiv, _activeRow);
        }
    }

    // ========================
    // SETTINGS TOAST NOTIFICATION
    // ========================

    function showSettingsToast(oldSettings, newSettings) {
        // Build change description
        const changes = [];

        if (oldSettings.enabled !== newSettings.enabled) {
            changes.push(newSettings.enabled ? '✅ Panel aktif' : '⏸️ Panel devre dışı');
        }
        if (oldSettings.highlightWords !== newSettings.highlightWords) {
            changes.push(newSettings.highlightWords ? '🔍 Vurgulama açık' : '🔍 Vurgulama kapalı');
        }
        if (oldSettings.showDamage !== newSettings.showDamage) {
            changes.push(newSettings.showDamage ? '🚗 Hasar görseli açık' : '🚗 Hasar görseli kapalı');
        }
        if (oldSettings.delay !== newSettings.delay) {
            changes.push(`⏱️ Açılma: ${newSettings.delay}ms`);
        }
        if (oldSettings.hideDelay !== newSettings.hideDelay) {
            changes.push(`⏱️ Kapanma: ${newSettings.hideDelay}ms`);
        }

        if (changes.length === 0) return;

        // Remove existing toast
        const existingToast = document.getElementById('sahipanel-settings-toast');
        if (existingToast) existingToast.remove();
        if (_toastTimer) clearTimeout(_toastTimer);

        // Create toast
        const toast = document.createElement('div');
        toast.id = 'sahipanel-settings-toast';
        toast.style.cssText = `
            position: fixed;
            bottom: 24px;
            left: 24px;
            z-index: 99999;
            background: linear-gradient(135deg, #1e1b4b, #312e81);
            color: #e0e7ff;
            padding: 14px 20px;
            border-radius: 12px;
            font-family: 'Segoe UI', -apple-system, sans-serif;
            font-size: 13px;
            line-height: 1.6;
            box-shadow: 0 8px 32px rgba(99, 102, 241, 0.3), 0 0 0 1px rgba(99, 102, 241, 0.2);
            opacity: 0;
            transform: translateY(16px) scale(0.95);
            transition: opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1), transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
            pointer-events: none;
            max-width: 320px;
            backdrop-filter: blur(12px);
        `;

        const title = document.createElement('div');
        title.style.cssText = 'font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #a5b4fc; margin-bottom: 6px;';
        title.textContent = 'Ayarlar Güncellendi';

        const body = document.createElement('div');
        body.innerHTML = changes.join('<br>');

        toast.appendChild(title);
        toast.appendChild(body);
        document.body.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                toast.style.opacity = '1';
                toast.style.transform = 'translateY(0) scale(1)';
            });
        });

        // Animate out after 2.5s
        _toastTimer = setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(16px) scale(0.95)';
            setTimeout(() => toast.remove(), 350);
        }, 2500);
    }

    // ========================
    // CATEGORY CHECK
    // ========================
    function isValidVehicleCategory() {
        const validCategories = [
            'Otomobil',
            'Arazi, SUV & Pickup',
            'Hasarlı Araçlar',
            'Klasik Araçlar',
            'Elektrikli Araçlar',
            'Motosiklet',
            'Karavan',
            'Minivan & Panelvan',
            'Ticari Araçlar',
            'ATV',
            'UTV',
            'Engelli Plakalı Araçlar'
        ];

        const validPaths = [
            '/otomobil',
            '/arazi-suv-pickup',
            '/hasarli-araclar',
            '/klasik-araclar',
            '/elektrikli-araclar',
            '/motosiklet',
            '/karavan',
            '/minivan-panelvan',
            '/ticari-araclar',
            '/atv',
            '/utv',
            '/engelli-plakali-araclar'
        ];

        // 1. Check hidden category name input
        const categoryNameInput = document.getElementById('categoryName');
        if (categoryNameInput && validCategories.includes(categoryNameInput.value.trim())) {
            return true;
        }

        // 2. Check breadcrumbs for any valid category title
        const breadcrumbs = document.querySelectorAll('.search-result-bc li.bc-item > a');
        for (let bc of breadcrumbs) {
            if (validCategories.includes(bc.getAttribute('title'))) {
                return true;
            }
        }

        // 3. Check URL path
        const path = window.location.pathname;
        for (let validPath of validPaths) {
            if (path === validPath || path.startsWith(validPath + '/')) {
                return true;
            }
        }

        return false;
    }

    // ========================
    // UTILITIES
    // ========================
    function normalizeTR(text) {
        return text.toLowerCase()
            .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u')
            .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/İ/g, 'i');
    }

    function extractCleanTextFromHTML(html) {
        let text = html;
        text = text.replace(/<br\s*[\/]?>/gi, '\n');
        text = text.replace(/<\/p>/gi, '\n\n');
        text = text.replace(/<\/h[1-6]>/gi, '\n\n');
        text = text.replace(/<\/div>/gi, '\n');
        text = text.replace(/<\/li>/gi, '\n');
        text = text.replace(/<li>/gi, '• ');
        text = text.replace(/<[^>]+>/g, '');

        const txt = document.createElement('textarea');
        txt.innerHTML = text;
        text = txt.value;

        text = text.replace(/[ \t]+/g, ' ');
        text = text.replace(/\n{3,}/g, '\n\n');

        return text.trim();
    }

    function highlightKeywords(text, keywords) {
        let wordsArr = text.split(/([\s.,:;!?\n\(\)\[\]]+)/);
        let sortedKeywords = keywords.slice().sort((a, b) => b.length - a.length);

        for (let i = 0; i < wordsArr.length; i++) {
            if (i % 2 === 1) continue;

            let normWord = normalizeTR(wordsArr[i]);
            if (!normWord) continue;

            let matched = sortedKeywords.find(k => normWord.includes(normalizeTR(k)));
            if (matched) {
                wordsArr[i] = `<span class="sahipanel-highlight">${wordsArr[i]}</span>`;
            }
        }
        return wordsArr.join('');
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

    // ========================
    // PRICE HISTORY API HELPERS
    // ========================
    function getListingHistory(ilanNo, callback) {
        if (!ilanNo) return callback([]);

        const payload = {
            action: 'get',
            ilan_numarasi: parseInt(ilanNo, 10)
        };

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
                    callback(list);
                } else {
                    console.warn('Geçmiş verisi alınamadı:', response ? response.error : 'Bilinmeyen hata');
                    callback([]);
                }
            }
        );
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

    function formatDateLabel(dateStr) {
        let dateLabel = dateStr || '';
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
        return dateLabel;
    }

    // ========================
    // FETCH CACHE
    // ========================
    const _fetchCache = new Map();
    const CACHE_MAX = 30;
    const CACHE_TTL = 5 * 60 * 1000;

    async function fetchWithCache(url) {
        const now = Date.now();
        const cached = _fetchCache.get(url);
        if (cached && (now - cached.timestamp) < CACHE_TTL) return cached;

        const response = await fetch(url, { credentials: 'include' });
        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const entry = { html, doc, timestamp: now };

        if (_fetchCache.size >= CACHE_MAX) {
            const oldestKey = [..._fetchCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
            _fetchCache.delete(oldestKey);
        }
        _fetchCache.set(url, entry);
        return entry;
    }

    // ========================
    // PREFETCH
    // ========================
    const _prefetchQueue = [];
    let _prefetchBusy = false;
    let _prefetchCount = 0;
    const MAX_PREFETCH = 5;

    function enqueuePrefetch(url) {
        if (_fetchCache.has(url) || _prefetchQueue.includes(url) || _prefetchCount >= MAX_PREFETCH) return;
        _prefetchQueue.push(url);
        processPrefetchQueue();
    }

    async function processPrefetchQueue() {
        if (_prefetchBusy || _prefetchQueue.length === 0) return;
        _prefetchBusy = true;
        const url = _prefetchQueue.shift();
        if (!_fetchCache.has(url)) {
            try {
                await fetchWithCache(url);
                _prefetchCount++;
            } catch (e) { }
        }
        setTimeout(() => {
            _prefetchBusy = false;
            processPrefetchQueue();
        }, 3000 + Math.random() * 4000);
    }

    function setupPrefetchObserver() {
        if (!SETTINGS.enabled || !isValidVehicleCategory()) return;
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                const link = entry.target.querySelector('td.searchResultsTitleValue a.classifiedTitle')?.href;
                if (link) enqueuePrefetch(link);
                observer.unobserve(entry.target);
            });
        }, { rootMargin: '200px' });
        document.querySelectorAll('tr.searchResultsItem').forEach(item => observer.observe(item));
    }

    // ========================
    // CREATE POPUP
    // ========================
    function createPopup(event, row) {
        const existing = document.querySelector('.sahipanel-popup');
        if (existing) existing.remove();

        const pop = document.createElement('div');
        pop.className = 'sahipanel-popup';

        const rect = row.getBoundingClientRect();
        const rowCenterY = rect.top + (rect.height / 2);
        let arrowTop = rowCenterY - 12;
        arrowTop = Math.max(20, Math.min(arrowTop, window.innerHeight - 40));

        const arrowDiv = document.createElement('div');
        arrowDiv.className = 'sahipanel-arrow right';
        arrowDiv.style.top = arrowTop + 'px';
        pop.appendChild(arrowDiv);

        const contentDiv = document.createElement('div');
        contentDiv.className = 'sahipanel-content';
        pop.appendChild(contentDiv);

        // Skeleton loading
        contentDiv.innerHTML = `
            <div style="display:flex; width:100%; height:100%; box-sizing:border-box;">
                <div style="width:360px; border-right:1px solid #e5e7eb; padding:20px; display:flex; flex-direction:column; gap:20px;">
                    <div class="sahipanel-skeleton-box" style="width:100%; height:340px; border-radius:8px;"></div>
                    <div class="sahipanel-skeleton-box" style="width:40%; height:20px;"></div>
                    <div class="sahipanel-skeleton-box" style="width:100%; height:60px;"></div>
                </div>
                <div style="flex:1; padding:20px; display:flex; flex-direction:column; gap:16px;">
                    <div class="sahipanel-skeleton-box" style="width:40%; height:18px;"></div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                        <div class="sahipanel-skeleton-box" style="height:32px;"></div>
                        <div class="sahipanel-skeleton-box" style="height:32px;"></div>
                        <div class="sahipanel-skeleton-box" style="height:32px;"></div>
                        <div class="sahipanel-skeleton-box" style="height:32px;"></div>
                        <div class="sahipanel-skeleton-box" style="height:32px;"></div>
                        <div class="sahipanel-skeleton-box" style="height:32px;"></div>
                    </div>
                    <div class="sahipanel-skeleton-box" style="width:30%; height:18px; margin-top:16px;"></div>
                    <div style="display:flex; flex-direction:column; gap:6px;">
                        <div class="sahipanel-skeleton-box" style="width:100%; height:14px;"></div>
                        <div class="sahipanel-skeleton-box" style="width:100%; height:14px;"></div>
                        <div class="sahipanel-skeleton-box" style="width:80%; height:14px;"></div>
                        <div class="sahipanel-skeleton-box" style="width:90%; height:14px;"></div>
                        <div class="sahipanel-skeleton-box" style="width:60%; height:14px;"></div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(pop);

        // Trigger entrance animation
        requestAnimationFrame(() => {
            pop.classList.add('sahipanel-visible');
        });

        pop.addEventListener('mouseenter', () => {
            if (popupHideTimer) clearTimeout(popupHideTimer);
        });

        pop.addEventListener('mouseleave', () => {
            popupHideTimer = setTimeout(() => {
                pop.classList.remove('sahipanel-visible');
                setTimeout(() => pop.remove(), 250);
            }, SETTINGS.hideDelay);
        });

        return { popup: pop, contentDiv };
    }

    // ========================
    // LOAD DETAILS
    // ========================
    async function loadDetails(container, row, historyPromise) {
        const link = row.querySelector('td.searchResultsTitleValue a.classifiedTitle')?.href;
        if (!link) { container.closest('.sahipanel-popup')?.remove(); return; }

        try {
            const { doc } = await fetchWithCache(link);

            // Extract current price from the fetched detail page doc
            let rawPrice = '';
            const priceEl = doc.querySelector('.classified-price-wrapper') ||
              doc.querySelector('.classifiedInfo h3') ||
              doc.querySelector('.classified-price') ||
              doc.querySelector('.price') ||
              doc.querySelector('.classifiedInfoValue [data-price]') ||
              doc.querySelector('.classifiedInfoList .classifiedInfoValue');
            
            if (priceEl) {
              const clone = priceEl.cloneNode(true);
              clone.querySelectorAll('script, style, .classifiedId, [style*="display:none"], [style*="display: none"]').forEach(el => el.remove());
              rawPrice = clone.textContent.trim();
            }
            if (!rawPrice) {
              const metaPrice = doc.querySelector('meta[property="og:price:amount"]') ||
                doc.querySelector('meta[property="product:price:amount"]');
              if (metaPrice) {
                rawPrice = metaPrice.getAttribute('content') || metaPrice.getAttribute('value');
              }
            }
            if (!rawPrice) {
              const twitterPrice = doc.querySelector('meta[name="twitter:data1"]');
              if (twitterPrice) {
                const content = twitterPrice.getAttribute('content') || twitterPrice.getAttribute('value');
                if (content && (content.includes('TL') || content.includes('₺') || content.includes('$') || content.includes('€') || content.includes('GBP'))) {
                  rawPrice = content;
                }
              }
            }

            let currentPriceVal = null;
            let paraBirimi = 'TRY';
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
                const metaCurrency = doc.querySelector('meta[property="og:price:currency"]') ||
                  doc.querySelector('meta[property="product:price:currency"]');
                if (metaCurrency) {
                  const content = metaCurrency.getAttribute('content');
                  if (content) paraBirimi = content.trim().toUpperCase();
                }
              }
              const digits = rawPrice.replace(/[^0-9]/g, '');
              if (digits) {
                currentPriceVal = parseFloat(digits);
              }
            }

            let damageArea = doc.querySelector('.damage-area') || doc.querySelector('[class*="damage"]');
            const propertySections = doc.querySelectorAll('.classifiedInfo');

            const descriptionEl = doc.getElementById('classifiedDescription');
            let descriptionText = '';
            if (descriptionEl) {
                descriptionText = extractCleanTextFromHTML(descriptionEl.innerHTML);
            }

            container.innerHTML = '';

            const contentRow = document.createElement('div');
            contentRow.className = 'sahipanel-content-row';
            container.appendChild(contentRow);

            const locEl = row.querySelector('.searchResultsLocationValue');
            const location = locEl ? locEl.innerText.trim() : '';

            let leftCol = null;
            let rightCol = document.createElement('div');

            const priceHistoryContainer = document.createElement('div');
            priceHistoryContainer.className = 'sahipanel-price-history';
            priceHistoryContainer.innerHTML = `
                <div class="sahipanel-section-title">Fiyat Geçmişi</div>
                <div class="sahipanel-price-history-placeholder"></div>
            `;

            // LEFT SIDE: DAMAGE VISUAL
            if (damageArea && SETTINGS.showDamage) {
                leftCol = document.createElement('div');
                leftCol.className = 'sahipanel-left-col';
                contentRow.appendChild(leftCol);

                const iframe = document.createElement('iframe');
                iframe.className = 'sahipanel-damage-iframe';
                leftCol.appendChild(iframe);

                const styles = Array.from(doc.querySelectorAll('style, link[rel="stylesheet"]')).map(el => el.outerHTML).join('\n');
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                iframeDoc.open();

                iframeDoc.write(`
                    <html>
                    <head>
                        ${styles}
                        <style>
                            body::-webkit-scrollbar { display: none; }
                            body {
                                margin: 0; padding: 0; background: transparent;
                                display: flex; justify-content: center; align-items: flex-start;
                                overflow: hidden !important;
                            }
                            .damage-area, .car-parts, [class*="damage"] {
                                transform: scale(0.80) !important;
                                transform-origin: top center !important;
                                margin-top: 10px !important;
                            }
                        </style>
                    </head>
                    <body>${damageArea.outerHTML}</body>
                    </html>
                `);
                iframeDoc.close();

                leftCol.appendChild(priceHistoryContainer);

                rightCol.className = 'sahipanel-right-col';
            } else {
                rightCol.className = 'sahipanel-right-col-full';
            }
            contentRow.appendChild(rightCol);

            // RIGHT SIDE: PROPERTIES
            const propsDiv = document.createElement('div');
            propsDiv.className = 'sahipanel-props';
            rightCol.appendChild(propsDiv);

            const orderedFields = [
                'Marka', 'Seri', 'Model', 'Yıl', 'KM', 'Vites', 'Yakıt Tipi',
                'Kasa Tipi', 'Renk', 'Motor Gücü', 'Motor Hacmi', 'Çekiş',
                'Araç Durumu', 'Ağır Hasar Kayıtlı', 'Takas', 'Plaka / Uyruk',
                'İlan No', 'İlan Tarihi'
            ];

            const specsContainer = document.createElement('div');
            specsContainer.style.marginBottom = leftCol ? '0' : '20px';
            specsContainer.innerHTML = `<div class="sahipanel-section-title">İlan Bilgileri</div>`;

            const listDiv = document.createElement('div');
            listDiv.className = 'sahipanel-specs-grid';

            if (location) {
                listDiv.innerHTML += `
                    <div class="sahipanel-location-item">
                        📍 ${location}
                    </div>
                `;
            }

            let extractedData = {};
            const firstSection = propertySections[0];
            if (firstSection) {
                firstSection.querySelectorAll('ul li').forEach(li => {
                    const keyEl = li.querySelector('strong');
                    const valEl = li.querySelector('span');

                    if (keyEl && valEl) {
                        let keyText = keyEl.innerText.trim().replace(/:/g, '');
                        let valText = valEl.innerText.trim();
                        extractedData[keyText] = valText;
                    }
                });

                orderedFields.forEach(field => {
                    if (extractedData[field]) {
                        let valText = extractedData[field];

                        if (field === 'Plaka / Uyruk') {
                            const match = valText.match(/\(([^)]+)\)/);
                            if (match) {
                                valText = match[1];
                            }
                        }

                        listDiv.innerHTML += `
                            <div class="sahipanel-spec-item">
                                <span class="sahipanel-spec-label">${field}</span>
                                <span class="sahipanel-spec-value">${valText}</span>
                            </div>
                        `;
                    }
                });
            }
            specsContainer.appendChild(listDiv);
            propsDiv.appendChild(specsContainer);

            if (!leftCol) {
                priceHistoryContainer.style.marginTop = '20px';
                propsDiv.appendChild(priceHistoryContainer);
            }

            // Fetch and render price history from API
            const ilanNo = extractedData['İlan No'] || (link.match(/[\-/](\d{9,11})\/detay/)?.[1]);
            const historyPlaceholder = priceHistoryContainer.querySelector('.sahipanel-price-history-placeholder');
            if (ilanNo && historyPlaceholder) {
                historyPlaceholder.innerHTML = '<span class="sahipanel-skeleton-box" style="display:inline-block; width:100%; height:20px;"></span>';
                
                const handleHistoryList = (historyList) => {
                    // Inject current price to history list if it's not already present
                    const currentPriceFloat = currentPriceVal;
                    const rawDate = extractedData['İlan Tarihi'] || '';
                    const currentFormattedDate = formatDateTime(rawDate).split(' ')[0];

                    const alreadyExists = historyList && historyList.some(item => {
                      const itemPriceFloat = parseFloat(item.fiyat);
                      const itemDate = (item.kayit_zamani || '').split(' ')[0];
                      return Math.abs(itemPriceFloat - currentPriceFloat) < 0.01 && itemDate === currentFormattedDate;
                    });

                    if (!alreadyExists && !isNaN(currentPriceFloat) && currentPriceFloat !== null) {
                      if (!historyList) historyList = [];
                      historyList.push({
                        ilan_numarasi: ilanNo,
                        kayit_zamani: formatDateTime(rawDate),
                        fiyat: currentPriceFloat,
                        para_birimi: paraBirimi,
                        ilan_durumu: 'ACIK'
                      });
                    }

                    if (!historyList || historyList.length === 0) {
                        historyPlaceholder.innerHTML = '<div style="font-size:11.5px; color:#888;">Fiyat geçmişi kaydı bulunamadı.</div>';
                        return;
                    }

                    // Sort descending by registration time
                    historyList.sort((a, b) => new Date(b.kayit_zamani) - new Date(a.kayit_zamani));

                    const getFloatVal = (val) => {
                        const parsed = parseFloat(val);
                        return isNaN(parsed) ? 0 : parsed;
                    };

                    // Filter consecutive duplicates
                    const filteredHistory = [];
                    for (let i = 0; i < historyList.length; i++) {
                        const current = historyList[i];
                        const next = historyList[i + 1];
                        if (!next || Math.abs(getFloatVal(current.fiyat) - getFloatVal(next.fiyat)) > 0.01) {
                            filteredHistory.push(current);
                        }
                    }

                    if (filteredHistory.length === 0) {
                        historyPlaceholder.innerHTML = '<div style="font-size:11.5px; color:#888;">Fiyat geçmişi kaydı bulunamadı.</div>';
                        return;
                    }

                    historyPlaceholder.style.border = 'none';
                    historyPlaceholder.style.background = 'transparent';
                    historyPlaceholder.style.padding = '0';

                    let html = '<div style="display:flex; flex-direction:column; gap:6px;">';
                    filteredHistory.forEach((item, index) => {
                        const dateLabel = formatDateLabel(item.kayit_zamani);
                        
                        // Compare against baseline (oldest)
                        const firstItem = filteredHistory[filteredHistory.length - 1];
                        const firstPrice = getFloatVal(firstItem.fiyat);
                        const currentPrice = getFloatVal(item.fiyat);
                        const diff = currentPrice - firstPrice;
                        
                        let indicator = '';
                        let indicatorColor = '#94a3b8';
                        if (index !== filteredHistory.length - 1 && Math.abs(diff) >= 0.01) {
                            if (diff < 0) {
                                indicator = ' ▼';
                                indicatorColor = '#10b981';
                            } else {
                                indicator = ' ▲';
                                indicatorColor = '#ef4444';
                            }
                        }
                        
                        const formattedPrice = formatPrice(currentPrice, item.para_birimi);
                        
                        html += `
                            <div style="display:flex; justify-content:space-between; align-items:center; font-size:11.5px; padding:6px 8px; border:1px solid #e5e7eb; border-radius:4px; background:#fff;">
                                <span style="color:#64748b;">${dateLabel}</span>
                                <span style="font-weight:700; color:#1e293b;">
                                    ${formattedPrice}
                                    <span style="color:${indicatorColor}; font-weight:800;">${indicator}</span>
                                </span>
                            </div>
                        `;
                    });
                    html += '</div>';
                    historyPlaceholder.innerHTML = html;
                };

                if (historyPromise) {
                    historyPromise.then(handleHistoryList);
                } else {
                    getListingHistory(ilanNo, handleHistoryList);
                }
            }

            // RIGHT SIDE BOTTOM: DESCRIPTION
            const descDiv = document.createElement('div');
            descDiv.className = 'sahipanel-description';
            rightCol.appendChild(descDiv);

            const keywords = ['tramer', 'hasar kaydı', 'pert', 'şase', 'podye', 'direk', 'airbag', 'değişen', 'boyalı', 'lokal boya', 'kaza', 'ağır hasar', 'işlem', 'orijinal', 'hatasız', 'expertiz', 'ekspertiz'];

            if (descriptionText) {
                let finalDescHTML = SETTINGS.highlightWords ? highlightKeywords(descriptionText, keywords) : descriptionText;
                descDiv.innerHTML = `<div class="sahipanel-section-title">İlan Açıklaması</div>${finalDescHTML}`;
            } else {
                descDiv.innerHTML = '<div class="sahipanel-no-desc">Açıklama yok</div>';
            }

        } catch (error) {
            container.closest('.sahipanel-popup')?.remove();
        }
    }

    // ========================
    // INIT PANEL
    // ========================
    function initPanel() {
        if (!SETTINGS.enabled) return;

        document.querySelectorAll('tr.searchResultsItem').forEach(item => {
            if (item.dataset.panelInitialized) return;
            item.dataset.panelInitialized = 'true';

            let timerId = null;

            item.addEventListener('mouseenter', e => {
                if (!SETTINGS.enabled) return;
                if (popupHideTimer) clearTimeout(popupHideTimer);

                _activeRow = item;

                const oldPopup = document.querySelector('.sahipanel-popup');
                if (oldPopup) oldPopup.remove();

                const popupObj = createPopup(e, item);
                const link = item.querySelector('td.searchResultsTitleValue a.classifiedTitle')?.href;

                // Pre-fetch price history from API immediately on hover start (parallel execution)
                let historyPromise = null;
                if (link) {
                    const match = link.match(/[\-/](\d{9,11})\/detay/);
                    if (match) {
                        const ilanNo = match[1];
                        historyPromise = new Promise((resolve) => {
                            getListingHistory(ilanNo, (list) => {
                                resolve(list || []);
                            });
                        });
                    }
                }

                const effectiveDelay = (link && _fetchCache.has(link)) ? 50 : SETTINGS.delay;

                timerId = setTimeout(() => loadDetails(popupObj.contentDiv, item, historyPromise), effectiveDelay);
            });

            item.addEventListener('mouseleave', () => {
                if (timerId) clearTimeout(timerId);

                popupHideTimer = setTimeout(() => {
                    const popup = document.querySelector('.sahipanel-popup');
                    if (popup && !popup.matches(':hover')) {
                        popup.classList.remove('sahipanel-visible');
                        setTimeout(() => popup.remove(), 250);
                    }
                }, SETTINGS.hideDelay);
            });
        });
        setTimeout(setupPrefetchObserver, 2000);
    }

    // ========================
    // BOOTSTRAP
    // ========================
    async function bootstrap() {
        await loadSettings();

        // Watch for DOM changes
        _mutationObserver = new MutationObserver(() => {
            if (isValidVehicleCategory()) {
                initPanel();
            }
        });
        _mutationObserver.observe(document.body, { childList: true, subtree: true });

        // Initial run
        initPanel();
    }

    bootstrap();

})();
