const SAVE_API_URL = 'https://sarisite.alperenakkaya.dev/index.php';
const HOVER_DEFAULT_SETTINGS = {
  enabled: true,
  delay: 800,
  hideDelay: 400,
  highlightWords: true,
  showDamage: true
};
const openPanelIds = new Set();
let countdownInterval = null;

document.addEventListener('DOMContentLoaded', () => {
  console.log('[Dashboard] Yüklendi');
  try {
    loadDashboard();
    initCrawlerStatus();
    initHoverSettingsUI();

  const btnScanAll = document.getElementById('btn-scan-all');
  if (btnScanAll) {
    btnScanAll.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'siteOpened', force: true });
    });
  }

  const btnRefresh = document.getElementById('btn-refresh');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      loadDashboard();
    });
  }

  const autoScanCheckbox = document.getElementById('toggle-auto-scan');
  if (autoScanCheckbox) {
    chrome.storage.local.get({ autoScanEnabled: true }, (result) => {
      autoScanCheckbox.checked = result.autoScanEnabled !== false;
    });

    autoScanCheckbox.addEventListener('change', () => {
      chrome.storage.local.set({ autoScanEnabled: autoScanCheckbox.checked }, () => {
        console.log(`[Dashboard] Otomatik arka plan taraması: ${autoScanCheckbox.checked ? 'Açık' : 'Kapalı'}`);
      });
    });
  }

  initHoverSettingsControls();

  const hoverSettingsBtn = document.getElementById('btn-hover-settings');
  const settingsModal = document.getElementById('settings-modal');
  const settingsModalClose = document.getElementById('settings-modal-close');
  const settingsModalBackdrop = settingsModal ? settingsModal.querySelector('.modal-backdrop') : null;

  if (hoverSettingsBtn && settingsModal) {
    hoverSettingsBtn.addEventListener('click', (event) => {
      initHoverSettingsUI();
      settingsModal.classList.add('open');
    });

    if (settingsModalClose) {
      settingsModalClose.addEventListener('click', () => {
        settingsModal.classList.remove('open');
      });
    }

    if (settingsModalBackdrop) {
      settingsModalBackdrop.addEventListener('click', () => {
        settingsModal.classList.remove('open');
      });
    }
  }

  // Initialize view mode
  const btnList = document.getElementById('btn-view-list');
  const btnGallery = document.getElementById('btn-view-gallery');
  const grid = document.getElementById('listings-grid');

  function applyViewMode(mode) {
    if (!btnList || !btnGallery || !grid) return;
    if (mode === 'gallery') {
      btnList.classList.remove('active');
      btnGallery.classList.add('active');
      grid.classList.add('gallery');
    } else {
      btnGallery.classList.remove('active');
      btnList.classList.add('active');
      grid.classList.remove('gallery');
    }
  }

  chrome.storage.local.get({ dashboardViewMode: 'list' }, (result) => {
    applyViewMode(result.dashboardViewMode);
  });

  if (btnList) {
    btnList.addEventListener('click', () => {
      chrome.storage.local.set({ dashboardViewMode: 'list' }, () => {
        applyViewMode('list');
      });
    });
  }

  if (btnGallery) {
    btnGallery.addEventListener('click', () => {
      chrome.storage.local.set({ dashboardViewMode: 'gallery' }, () => {
        applyViewMode('gallery');
      });
    });
  }

  if (grid) {
    setupDragAndDrop(grid, 'listing-card');
  }

  // Modal Close Listeners
  const histModal = document.getElementById('history-modal');
  const modalClose = document.getElementById('modal-close');
  const modalBackdrop = histModal ? histModal.querySelector('.modal-backdrop') : null;

  if (modalClose && histModal) {
    modalClose.addEventListener('click', () => {
      histModal.classList.remove('open');
    });
  }
  if (modalBackdrop && histModal) {
    modalBackdrop.addEventListener('click', () => {
      histModal.classList.remove('open');
    });
  }
  } catch(e) {
    console.error('[Dashboard] Hata:', e);
  }
});

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    if (changes.userFavorites || (changes.favoritesOrder && !isInternalOrderChange)) {
      loadDashboard();
    }
    if (changes.crawlerState) {
      renderCrawlerStatus(changes.crawlerState.newValue);
    }
    if (changes.autoScanEnabled) {
      const checkbox = document.getElementById('toggle-auto-scan');
      if (checkbox) {
        checkbox.checked = changes.autoScanEnabled.newValue !== false;
      }
      chrome.storage.local.get({ crawlerState: {} }, (result) => {
        renderCrawlerStatus(result.crawlerState);
      });
    }
  }

  if (namespace === 'sync' && changes.settings) {
    initHoverSettingsUI();
  }
});

function initHoverSettingsUI() {
  chrome.storage.sync.get({ settings: HOVER_DEFAULT_SETTINGS }, (result) => {
    const settings = result.settings || HOVER_DEFAULT_SETTINGS;
    const enabled = document.getElementById('hover-enabled');
    const showDamage = document.getElementById('hover-show-damage');
    const highlightWords = document.getElementById('hover-highlight-words');
    const delay = document.getElementById('hover-delay');
    const hideDelay = document.getElementById('hover-hide-delay');

    if (enabled) enabled.checked = settings.enabled;
    if (showDamage) showDamage.checked = settings.showDamage;
    if (highlightWords) highlightWords.checked = settings.highlightWords;
    if (delay) delay.value = settings.delay;
    if (hideDelay) hideDelay.value = settings.hideDelay;
  });
}

function saveHoverSettings(update) {
  chrome.storage.sync.get({ settings: HOVER_DEFAULT_SETTINGS }, (result) => {
    const settings = { ...HOVER_DEFAULT_SETTINGS, ...result.settings, ...update };
    chrome.storage.sync.set({ settings });
  });
}

function initHoverSettingsControls() {
  const enabled = document.getElementById('hover-enabled');
  const showDamage = document.getElementById('hover-show-damage');
  const highlightWords = document.getElementById('hover-highlight-words');
  const delay = document.getElementById('hover-delay');
  const hideDelay = document.getElementById('hover-hide-delay');

  if (enabled) {
    enabled.addEventListener('change', () => saveHoverSettings({ enabled: enabled.checked }));
  }
  if (showDamage) {
    showDamage.addEventListener('change', () => saveHoverSettings({ showDamage: showDamage.checked }));
  }
  if (highlightWords) {
    highlightWords.addEventListener('change', () => saveHoverSettings({ highlightWords: highlightWords.checked }));
  }
  if (delay) {
    delay.addEventListener('change', () => {
      const value = parseInt(delay.value, 10);
      saveHoverSettings({ delay: Number.isNaN(value) ? HOVER_DEFAULT_SETTINGS.delay : value });
    });
  }
  if (hideDelay) {
    hideDelay.addEventListener('change', () => {
      const value = parseInt(hideDelay.value, 10);
      saveHoverSettings({ hideDelay: Number.isNaN(value) ? HOVER_DEFAULT_SETTINGS.hideDelay : value });
    });
  }
}

function formatPrice(val, currency) {
  try {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: currency || 'TRY',
      maximumFractionDigits: 0
    }).format(val);
  } catch (e) {
    return `${val} ${currency || 'TL'}`;
  }
}

function formatLastChecked(ts) {
  if (!ts) return 'Hiç taranmadı';
  try {
    const date = new Date(ts);
    if (isNaN(date.getTime())) return 'Hiç taranmadı';
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return `Bugün ${hours}:${minutes}`;
    }
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return `Dün ${hours}:${minutes}`;
    }
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}.${month} ${hours}:${minutes}`;
  } catch (e) {
    return 'Hiç taranmadı';
  }
}

function formatHistoryDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const parts = dateStr.split(' ');
    if (parts[0]) {
      const dateParts = parts[0].split('-');
      if (dateParts.length === 3) {
        let label = `${dateParts[2]}.${dateParts[1]}.${dateParts[0]}`;
        if (parts[1]) {
          const timeParts = parts[1].split(':');
          label += ` ${timeParts[0]}:${timeParts[1]}`;
        }
        return label;
      }
    }
  } catch (e) { }
  return dateStr;
}

function loadDashboard() {
  chrome.storage.local.get({ userFavorites: {}, crawlerState: {}, favoritesOrder: [] }, (result) => {
    const userFavorites = result.userFavorites || {};
    let favoritesOrder = result.favoritesOrder || [];
    const favIds = Object.keys(userFavorites);

    favoritesOrder = favoritesOrder.filter(id => favIds.includes(id));
    favIds.forEach(id => {
      if (!favoritesOrder.includes(id)) {
        favoritesOrder.unshift(id);
      }
    });

    const favItems = favoritesOrder.map(id => userFavorites[id]).filter(Boolean);

    document.getElementById('stat-total').textContent = favItems.length;

    const grid = document.getElementById('listings-grid');

    if (favItems.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <div class="empty-state-title">Henüz takip edilen ilan yok</div>
          <div>Sarı Site ilan detay sayfasındaki "Takip Et" butonunu kullanarak ilan ekleyebilirsiniz.</div>
        </div>
      `;
      document.getElementById('stat-drops').textContent = '0';
      document.getElementById('stat-rises').textContent = '0';
      document.getElementById('stat-neutral').textContent = '0';
      return;
    }

    // Show loading skeletons first
    grid.innerHTML = favItems.map((item, i) => `
      <div class="listing-card" id="card-${item.id}" data-id="${item.id}" draggable="true">
        <div class="listing-card-header">
          <div class="listing-info">
            <div class="listing-title">
              <a href="${atob('aHR0cHM6Ly93d3cuc2FoaWJpbmRlbi5jb20va2VsaW1lLWlsZS1hcmFtYT9xdWVyeV90ZXh0PQ==')}${item.id}" target="_blank">
                ${item.title || `İlan No: ${item.id}`}
              </a>
              <div class="listing-actions">
                <button class="btn btn-outline btn-action" data-action="rename" data-id="${item.id}" title="Yeniden Adlandır">✏️</button>
                <button class="btn btn-outline btn-action" data-action="scan" data-id="${item.id}" title="Bu İlanı Tara">🔄</button>
                <button class="btn btn-outline btn-action btn-action-danger" data-action="delete" data-id="${item.id}" title="Takibi Bırak">🗑️</button>
              </div>
            </div>
            <div class="listing-meta">
              <span class="listing-meta-item">🏷️ ${item.id}</span>
              <span class="listing-meta-item">🕐 ${formatLastChecked(item.lastChecked)}</span>
            </div>
          </div>
          <div class="listing-price-area">
            <div class="listing-current-price" id="dash-price-${item.id}">
              <div class="skeleton" style="width: 120px; height: 28px;"></div>
            </div>
            <div class="listing-price-change" id="dash-change-${item.id}"></div>
          </div>
        </div>
        <div class="listing-stats" id="dash-stats-${item.id}">
          <div class="listing-stat"><div class="listing-stat-label">İlk Fiyat</div><div class="listing-stat-value" id="dash-first-${item.id}">—</div></div>
          <div class="listing-stat"><div class="listing-stat-label">En Düşük</div><div class="listing-stat-value" id="dash-min-${item.id}">—</div></div>
          <div class="listing-stat"><div class="listing-stat-label">En Yüksek</div><div class="listing-stat-value" id="dash-max-${item.id}">—</div></div>
          <div class="listing-stat"><div class="listing-stat-label">Ortalama</div><div class="listing-stat-value" id="dash-avg-${item.id}">—</div></div>
          <div class="listing-stat"><div class="listing-stat-label">Kayıt Sayısı</div><div class="listing-stat-value" id="dash-count-${item.id}">—</div></div>
          <div class="listing-stat"><div class="listing-stat-label">Toplam Değişim</div><div class="listing-stat-value" id="dash-total-change-${item.id}">—</div></div>
        </div>
        <button class="listing-history-toggle" id="dash-toggle-${item.id}" data-id="${item.id}">
          ▾ Fiyat Geçmişini Göster
        </button>
        <div class="history-panel" id="dash-history-${item.id}"></div>
      </div>
    `).join('');

    // Bind toggle buttons
    favItems.forEach(item => {
      const toggleBtn = document.getElementById(`dash-toggle-${item.id}`);
      const panel = document.getElementById(`dash-history-${item.id}`);

      if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
          openHistoryModal(item, panel ? panel.innerHTML : '');
        });
      }
    });

    // Bind action buttons (rename, scan, delete)
    grid.querySelectorAll('.btn-action').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        if (action === 'rename') {
          const currentItem = favItems.find(f => f.id === id);
          const currentTitle = currentItem ? currentItem.title : `İlan No: ${id}`;
          const newTitle = prompt('İlan için yeni bir isim girin:', currentTitle);
          if (newTitle !== null && newTitle.trim()) {
            renameListing(id, newTitle.trim());
          }
        } else if (action === 'scan') {
          chrome.runtime.sendMessage({ action: 'siteOpened', force: true, targetId: id });
        } else if (action === 'delete') {
          if (confirm(`${id} numaralı ilanı takipten çıkarmak istiyor musunuz?`)) {
            removeListing(id);
          }
        }
      });
    });

    // Fetch price data for each listing
    let statsDrops = 0;
    let statsRises = 0;
    let statsNeutral = 0;
    let loadedCount = 0;

    favItems.forEach(item => {
      fetchListingHistory(item.id, (historyList) => {
        loadedCount++;
        const result = renderListingData(item, historyList);
        if (result === 'drop') statsDrops++;
        else if (result === 'rise') statsRises++;
        else statsNeutral++;

        if (loadedCount === favItems.length) {
          document.getElementById('stat-drops').textContent = statsDrops;
          document.getElementById('stat-rises').textContent = statsRises;
          document.getElementById('stat-neutral').textContent = statsNeutral;

          // Re-apply active scanning highlights after cards are rendered
          initCrawlerStatus();
        }
      });
    });
  });
}

function fetchListingHistory(ilanNo, callback) {
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
      if (response && response.success) {
        let list = [];
        const resData = response.data;
        if (resData && Array.isArray(resData.records)) list = resData.records;
        else if (response.records && Array.isArray(response.records)) list = response.records;
        else if (Array.isArray(resData)) list = resData;
        else if (resData && Array.isArray(resData.history)) list = resData.history;
        else if (resData && Array.isArray(resData.data)) list = resData.data;
        callback(list);
      } else {
        callback([]);
      }
    }
  );
}

function renderListingData(item, historyList) {
  const priceEl = document.getElementById(`dash-price-${item.id}`);
  const changeEl = document.getElementById(`dash-change-${item.id}`);
  const firstEl = document.getElementById(`dash-first-${item.id}`);
  const minEl = document.getElementById(`dash-min-${item.id}`);
  const maxEl = document.getElementById(`dash-max-${item.id}`);
  const avgEl = document.getElementById(`dash-avg-${item.id}`);
  const countEl = document.getElementById(`dash-count-${item.id}`);
  const totalChangeEl = document.getElementById(`dash-total-change-${item.id}`);
  const historyPanel = document.getElementById(`dash-history-${item.id}`);

  if (!historyList || historyList.length === 0) {
    if (priceEl) priceEl.textContent = 'Veri Yok';
    return 'neutral';
  }

  // Sort descending
  historyList.sort((a, b) => new Date(b.kayit_zamani) - new Date(a.kayit_zamani));

  const prices = historyList.map(h => parseFloat(h.fiyat)).filter(p => !isNaN(p));
  if (prices.length === 0) {
    if (priceEl) priceEl.textContent = 'Veri Yok';
    return 'neutral';
  }

  const latestPrice = prices[0];
  const firstPrice = prices[prices.length - 1];
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
  const currency = historyList[0].para_birimi || 'TRY';

  // Current price
  if (priceEl) {
    priceEl.textContent = formatPrice(latestPrice, currency);
  }

  // Price change vs first
  let trend = 'neutral';
  const diff = latestPrice - firstPrice;

  if (Math.abs(diff) > 0.01) {
    const percent = Math.round((Math.abs(diff) / firstPrice) * 100);
    if (diff < 0) {
      trend = 'drop';
      if (priceEl) priceEl.style.color = 'var(--success)';
      if (changeEl) {
        changeEl.className = 'listing-price-change drop';
        changeEl.textContent = `▼ ${formatPrice(Math.abs(diff), currency)} (-%${percent}) ilk fiyattan`;
      }
    } else {
      trend = 'rise';
      if (priceEl) priceEl.style.color = 'var(--danger)';
      if (changeEl) {
        changeEl.className = 'listing-price-change rise';
        changeEl.textContent = `▲ +${formatPrice(diff, currency)} (+%${percent}) ilk fiyattan`;
      }
    }
  } else {
    if (changeEl) {
      changeEl.className = 'listing-price-change neutral';
      changeEl.textContent = '— Değişiklik yok';
    }
  }

  // Stats
  if (firstEl) firstEl.textContent = formatPrice(firstPrice, currency);
  if (minEl) {
    minEl.textContent = formatPrice(minPrice, currency);
    if (minPrice < firstPrice) minEl.style.color = 'var(--success)';
  }
  if (maxEl) {
    maxEl.textContent = formatPrice(maxPrice, currency);
    if (maxPrice > firstPrice) maxEl.style.color = 'var(--danger)';
  }
  if (avgEl) avgEl.textContent = formatPrice(avgPrice, currency);
  if (countEl) countEl.textContent = historyList.length;

  // Total change
  if (totalChangeEl) {
    if (Math.abs(diff) > 0.01) {
      const percent = Math.round((Math.abs(diff) / firstPrice) * 100);
      if (diff < 0) {
        totalChangeEl.textContent = `-%${percent}`;
        totalChangeEl.style.color = 'var(--success)';
      } else {
        totalChangeEl.textContent = `+%${percent}`;
        totalChangeEl.style.color = 'var(--danger)';
      }
    } else {
      totalChangeEl.textContent = '%0';
    }
  }

  // History table
  if (historyPanel) {
    // Filter to show only price changes (deduplicate consecutive same prices)
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

    let tableHTML = `
      <table class="history-table">
        <thead>
          <tr>
            <th>Tarih</th>
            <th>Fiyat</th>
            <th>İlk Fiyata Göre</th>
            <th>Fark</th>
          </tr>
        </thead>
        <tbody>
    `;

    filteredHistory.forEach((record, index) => {
      const recordPrice = parseFloat(record.fiyat);
      const recordDiff = recordPrice - firstPrice;
      const recordPercent = firstPrice > 0 ? Math.round((Math.abs(recordDiff) / firstPrice) * 100) : 0;

      let trendClass = 'neutral';
      let trendIcon = '—';
      let diffText = '—';

      if (index === filteredHistory.length - 1) {
        // First record (baseline)
        trendClass = 'neutral';
        trendIcon = '—';
        diffText = 'Baz Fiyat';
      } else if (Math.abs(recordDiff) < 0.01) {
        trendClass = 'neutral';
        trendIcon = '—';
        diffText = 'Değişiklik yok';
      } else if (recordDiff < 0) {
        trendClass = 'drop';
        trendIcon = '▼';
        diffText = `- ${formatPrice(Math.abs(recordDiff), currency)} (-%${recordPercent})`;
      } else {
        trendClass = 'rise';
        trendIcon = '▲';
        diffText = `+ ${formatPrice(recordDiff, currency)} (+%${recordPercent})`;
      }

      tableHTML += `
        <tr>
          <td>${formatHistoryDate(record.kayit_zamani)}</td>
          <td style="font-weight: 700;">${formatPrice(recordPrice, currency)}</td>
          <td><span class="trend-indicator ${trendClass}">${trendIcon}</span></td>
          <td><span class="trend-indicator ${trendClass}">${diffText}</span></td>
        </tr>
      `;
    });

    tableHTML += '</tbody></table>';
    historyPanel.innerHTML = tableHTML;
  }

  return trend;
}

function renameListing(id, newTitle) {
  chrome.storage.local.get({ userFavorites: {} }, (result) => {
    const userFavorites = result.userFavorites || {};
    if (userFavorites[id]) {
      userFavorites[id].title = newTitle;
      chrome.storage.local.set({ userFavorites: userFavorites }, () => {
        console.log(`[Dashboard] İlan #${id} yeniden adlandırıldı: ${newTitle}`);
        loadDashboard();
      });
    }
  });
}

function removeListing(id) {
  chrome.storage.local.get({ userFavorites: {} }, (result) => {
    const userFavorites = result.userFavorites || {};
    if (userFavorites[id]) {
      delete userFavorites[id];
      chrome.storage.local.set({ userFavorites: userFavorites }, () => {
        const ids = Object.keys(userFavorites);
        chrome.cookies.set({
          url: atob('aHR0cHM6Ly93d3cuc2FoaWJpbmRlbi5jb20='),
          name: 'sarisite_favorites',
          value: ids.join(','),
          domain: atob('LnNhaGliaW5kZW4uY29t'),
          path: '/',
          expirationDate: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60)
        }, () => {
          console.log(`[Dashboard] İlan #${id} takipten çıkarıldı.`);
          loadDashboard();
        });
      });
    }
  });
}

function initCrawlerStatus() {
  chrome.storage.local.get({ crawlerState: {} }, (result) => {
    renderCrawlerStatus(result.crawlerState);
  });
}

function renderCrawlerStatus(state) {
  // Update card highlights based on crawler state
  const currentScanningId = state && state.isProcessing ? String(state.currentItem) : null;
  const nextScanningId = state && state.isProcessing ? String(state.nextItem) : null;

  document.querySelectorAll('.listing-card').forEach(card => {
    card.classList.remove('scanning-active', 'scanning-next');
  });

  if (currentScanningId) {
    const activeCard = document.getElementById(`card-${currentScanningId}`);
    if (activeCard) activeCard.classList.add('scanning-active');
  }
  if (nextScanningId) {
    const nextCard = document.getElementById(`card-${nextScanningId}`);
    if (nextCard) nextCard.classList.add('scanning-next');
  }

  chrome.storage.local.get({ autoScanEnabled: true }, (result) => {
    const autoScanEnabled = result.autoScanEnabled !== false;

    const card = document.getElementById('crawler-status-card');
    const dot = document.getElementById('status-dot');
    const badge = document.getElementById('status-badge');
    const message = document.getElementById('status-message');
    const queueInfo = document.getElementById('status-queue-info');
    const autoScanMode = document.getElementById('status-auto-scan-mode');
    const lastScan = document.getElementById('status-last-scan');
    const timerContainer = document.getElementById('status-timer-container');
    const progressBar = document.getElementById('status-progress-bar');
    const scanBtn = document.getElementById('btn-scan-all');

    if (!card || !dot || !badge || !message || !queueInfo || !autoScanMode || !lastScan || !timerContainer || !progressBar) return;

    clearInterval(countdownInterval);

    if (autoScanEnabled) {
      autoScanMode.textContent = 'Otomatik Tarama: Aktif';
      autoScanMode.style.color = 'var(--success)';
    } else {
      autoScanMode.textContent = 'Otomatik Tarama: Kapalı';
      autoScanMode.style.color = 'var(--text-muted)';
    }

    const formatTime = (ts) => {
      if (!ts) return 'Yok';
      try {
        const date = new Date(ts);
        if (isNaN(date.getTime())) return 'Yok';
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
      } catch (e) {
        return 'Yok';
      }
    };

    const isProcessing = state && state.isProcessing;
    const currentItem = state && state.currentItem;
    const nextCheckTime = state && state.nextCheckTime;
    const remaining = state && state.remainingQueueCount;
    const total = state && state.totalQueueCount;
    const lastScanTime = state && state.lastScanTime;
    const lastMsg = state && state.lastMessage;

    lastScan.textContent = `Son Güncelleme: ${formatTime(lastScanTime)}`;

    if (isProcessing) {
      if (scanBtn) {
        scanBtn.disabled = true;
        scanBtn.style.opacity = '0.5';
        scanBtn.style.cursor = 'not-allowed';
      }

      if (nextCheckTime) {
        badge.textContent = 'Beklemede';
        badge.className = 'status-badge waiting';
        dot.className = 'status-dot waiting';

        timerContainer.style.display = 'block';
        progressBar.className = 'progress-bar waiting';

        const totalWait = state.currentWaitTime || 5000;

        const updateTimer = () => {
          const remTime = nextCheckTime - Date.now();
          if (remTime <= 0) {
            const elapsed = Math.floor((Date.now() - nextCheckTime) / 1000);
            const done = (total || 0) - (remaining || 0);
            const progressText = total > 0 ? `${done}/${total}` : '';

            progressBar.style.width = '100%';
            progressBar.className = 'progress-bar complete';

            if (elapsed > 30) {
              badge.textContent = 'Bekliyor';
              badge.className = 'status-badge waiting';
              message.textContent = progressText
                ? `⏳ ${progressText} ilan tarandı — Arka plan işlemi yanıt bekleniyor...`
                : `⏳ Arka plan işlemi yanıt bekleniyor...`;
            } else {
              message.textContent = progressText
                ? `✅ ${progressText} ilan tarandı — Sıradaki ilana geçiliyor...`
                : '✅ Bekleme tamamlandı — Sıradaki ilana geçiliyor...';
              clearInterval(countdownInterval);
            }
          } else {
            const percent = Math.max(0, Math.min(100, ((totalWait - remTime) / totalWait) * 100));
            progressBar.style.width = `${percent}%`;

            const totalSeconds = Math.ceil(remTime / 1000);
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            let timeLabel = '';
            if (minutes > 0) {
              timeLabel = `${minutes} dk ${seconds} sn`;
            } else {
              timeLabel = `${seconds} sn`;
            }
            const waitTypeLabel = state.isForcedRun ? 'Hızlı güvenlik beklemesi' : 'Güvenlik beklemesi';
            message.textContent = `⏳ ${waitTypeLabel}: ${timeLabel} kaldı`;
          }
        };

        updateTimer();
        countdownInterval = setInterval(updateTimer, 200);

        const queueCountText = remaining > 0 ? `${remaining} ilan kaldı` : 'Son ilan';
        queueInfo.textContent = `Kuyrukta: ${queueCountText}`;
      } else if (currentItem) {
        badge.textContent = 'Taranıyor';
        badge.className = 'status-badge scanning';
        dot.className = 'status-dot scanning';

        timerContainer.style.display = 'none';
        const done = (total || 0) - (remaining || 0);
        const progressLabel = total > 0 ? ` (${done}/${total})` : '';
        message.textContent = `🔍 İlan #${currentItem} taranıyor...${progressLabel}`;

        const queueCountText = remaining > 0 ? `${remaining} ilan kaldı` : 'Son ilan';
        queueInfo.textContent = `Kuyrukta: ${queueCountText}`;
      } else {
        badge.textContent = 'Taranıyor';
        badge.className = 'status-badge scanning';
        dot.className = 'status-dot scanning';

        timerContainer.style.display = 'none';
        message.textContent = lastMsg || '⏳ Tarama başlatılıyor, ilanlar kuyruğa alınıyor...';

        const queueCountText = remaining > 0 ? `${remaining} ilan kaldı` : 'Hesaplanıyor...';
        queueInfo.textContent = `Kuyrukta: ${queueCountText}`;
      }
    } else {
      if (!autoScanEnabled) {
        badge.textContent = 'Pasif';
        badge.className = 'status-badge disabled';
        dot.className = 'status-dot disabled';
        timerContainer.style.display = 'none';
        message.textContent = 'Otomatik tarama kapalı. "🔄 Hepsini Tara" butonu ile manuel başlatabilirsiniz.';
      } else {
        badge.textContent = 'Hazır';
        badge.className = 'status-badge idle';
        dot.className = 'status-dot idle';

        const nextAlarmTime = state && state.nextAlarmTime;
        if (nextAlarmTime && nextAlarmTime > Date.now()) {
          timerContainer.style.display = 'block';
          progressBar.className = 'progress-bar idle';

          const totalAlarmWait = 5 * 60 * 1000; // 5 minutes

          const updateAlarmTimer = () => {
            const remTime = nextAlarmTime - Date.now();
            if (remTime <= 0) {
              message.textContent = '⏳ Otomatik tarama başlatılıyor...';
              progressBar.style.width = '100%';
              clearInterval(countdownInterval);
            } else {
              const percent = Math.max(0, Math.min(100, ((totalAlarmWait - remTime) / totalAlarmWait) * 100));
              progressBar.style.width = `${percent}%`;

              const totalSeconds = Math.ceil(remTime / 1000);
              const minutes = Math.floor(totalSeconds / 60);
              const seconds = totalSeconds % 60;
              const timeLabel = minutes > 0 ? `${minutes} dk ${seconds} sn` : `${seconds} sn`;
              message.textContent = `⏳ Sıradaki otomatik tarama: ${timeLabel} kaldı`;
            }
          };

          updateAlarmTimer();
          countdownInterval = setInterval(updateAlarmTimer, 200);
        } else {
          timerContainer.style.display = 'none';
          message.textContent = lastMsg || 'Tüm ilanlar güncel. Yeni tarama için hazır.';
        }
      }

      if (scanBtn) {
        scanBtn.disabled = false;
        scanBtn.style.opacity = '1';
        scanBtn.style.cursor = 'pointer';
      }

      queueInfo.textContent = 'Kuyruk: Boş — Taranacak ilan yok';
    }
  });
}

// Listen for price change notifications from background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'showPriceChangePopup') {
    showPopupPriceToast(request.ilanId, request.title, request.oldPrice, request.newPrice, request.changeType);
    sendResponse({ success: true });
  }
  return true;
});

function showPopupPriceToast(ilanId, title, oldPrice, newPrice, changeType) {
  // Remove existing toast for the same listing
  const existing = document.getElementById(`popup-toast-${ilanId}`);
  if (existing) existing.remove();

  const formatPriceVal = (val) => {
    try {
      return new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        maximumFractionDigits: 0
      }).format(val);
    } catch (e) {
      return val + ' TL';
    }
  };

  const isDrop = changeType === 'düştü';
  const accentColor = isDrop ? 'var(--success)' : 'var(--danger)';
  const bgColor = isDrop ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';
  const borderColor = isDrop ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)';
  const icon = isDrop ? '📉' : '📈';
  const label = isDrop ? 'Fiyat Düştü!' : 'Fiyat Yükseldi!';

  const diff = Math.abs(newPrice - oldPrice);
  const percent = Math.round((diff / oldPrice) * 100);
  const diffLabel = isDrop
    ? `- ${formatPriceVal(diff)} (-%${percent})`
    : `+ ${formatPriceVal(diff)} (+%${percent})`;

  const displayTitle = title && title.length > 50 ? title.substring(0, 48) + '...' : (title || `İlan #${ilanId}`);

  const toast = document.createElement('div');
  toast.id = `popup-toast-${ilanId}`;
  toast.style.cssText = `
    position: fixed;
    top: 24px;
    right: 24px;
    width: 360px;
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-left: 4px solid ${accentColor};
    border-radius: var(--radius);
    padding: 16px;
    z-index: 10000;
    font-family: inherit;
    font-size: 13px;
    color: var(--text);
    box-shadow: var(--shadow-lg);
    transform: translateX(120%);
    opacity: 0;
    transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease;
    box-sizing: border-box;
  `;

  toast.innerHTML = `
    <div style="display: flex; align-items: flex-start; gap: 12px;">
      <span style="font-size: 22px; line-height: 1;">${icon}</span>
      <div style="flex: 1; min-width: 0;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
          <span style="font-weight: 700; font-size: 11px; color: ${accentColor}; text-transform: uppercase; letter-spacing: 0.5px;">${label}</span>
          <button id="popup-toast-close-${ilanId}" style="
            background: none; border: none; color: var(--text-muted); 
            cursor: pointer; font-size: 16px; padding: 0 4px; line-height: 1;
            transition: color 0.2s;
          ">✕</button>
        </div>
        <div style="font-weight: 700; font-size: 13px; margin-bottom: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${title}">${displayTitle}</div>
        <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; margin-bottom: 8px;">
          <span style="text-decoration: line-through; color: var(--text-muted);">${formatPriceVal(oldPrice)}</span>
          <span style="color: var(--text-muted);">→</span>
          <span style="font-weight: 800; color: ${accentColor}; font-size: 14px;">${formatPriceVal(newPrice)}</span>
          <span style="font-weight: 700; color: ${accentColor}; font-size: 11px; margin-left: auto; background: ${bgColor}; padding: 2px 6px; border-radius: 4px;">${diffLabel}</span>
        </div>
        <div style="display: flex; justify-content: flex-end; border-top: 1px solid var(--border); padding-top: 8px;">
          <a href="${atob('aHR0cHM6Ly93d3cuc2FoaWJpbmRlbi5jb20va2VsaW1lLWlsZS1hcmFtYT9xdWVyeV90ZXh0PQ==')}${ilanId}" target="_blank" 
             id="popup-toast-link-${ilanId}"
             style="font-size: 12px; font-weight: 600; color: var(--primary); text-decoration: none; display: inline-flex; align-items: center; gap: 3px;">
            İlana Git ↗
          </a>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(toast);

  // Trigger slide-in
  requestAnimationFrame(() => {
    toast.style.transform = 'translateX(0)';
    toast.style.opacity = '1';
  });

  const dismissToast = () => {
    toast.style.transform = 'translateX(120%)';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 400);
  };

  const closeBtn = document.getElementById(`popup-toast-close-${ilanId}`);
  if (closeBtn) {
    closeBtn.addEventListener('click', dismissToast);
    closeBtn.addEventListener('mouseenter', () => { closeBtn.style.color = 'var(--text)'; });
    closeBtn.addEventListener('mouseleave', () => { closeBtn.style.color = 'var(--text-muted)'; });
  }

  const linkEl = document.getElementById(`popup-toast-link-${ilanId}`);
  if (linkEl) {
    linkEl.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: linkEl.href });
    });
  }

  // Auto dismiss after 10 seconds
  setTimeout(() => {
    if (document.body.contains(toast)) dismissToast();
  }, 10000);
}

let isInternalOrderChange = false;

function setupDragAndDrop(container, itemClassName) {
  container.addEventListener('dragstart', (e) => {
    const item = e.target.closest(`.${itemClassName}`);
    if (!item) return;
    item.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.dataset.id);
  });

  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    const dragging = container.querySelector('.dragging');
    if (!dragging) return;

    const nextSibling = getDragAfterElement(container, e.clientX, e.clientY, itemClassName);
    if (nextSibling == null) {
      const targetContainer = container.querySelector('ul') || container;
      targetContainer.appendChild(dragging);
    } else {
      nextSibling.parentNode.insertBefore(dragging, nextSibling);
    }
  });

  container.addEventListener('dragend', (e) => {
    const item = e.target.closest(`.${itemClassName}`);
    if (item) {
      item.classList.remove('dragging');
    }

    // Save the new order to storage
    const newOrder = [...container.querySelectorAll(`.${itemClassName}`)].map(el => el.dataset.id);
    isInternalOrderChange = true;
    chrome.storage.local.set({ favoritesOrder: newOrder }, () => {
      setTimeout(() => { isInternalOrderChange = false; }, 100);
    });
  });

  function getDragAfterElement(container, x, y, itemClassName) {
    const draggableElements = [...container.querySelectorAll(`.${itemClassName}:not(.dragging)`)];

    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();

      const boxCenterX = box.left + box.width / 2;
      const boxCenterY = box.top + box.height / 2;

      const distanceX = x - boxCenterX;
      const distanceY = y - boxCenterY;

      const isGallery = container.classList.contains('gallery') || container.tagName.toLowerCase() === 'ul';

      let isAfter = false;
      if (isGallery) {
        if (y < box.top) {
          isAfter = true;
        } else if (y >= box.top && y <= box.bottom) {
          isAfter = x < boxCenterX;
        }
      } else {
        isAfter = y < boxCenterY;
      }

      if (isAfter) {
        const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
        if (distance < closest.distance) {
          return { distance: distance, element: child };
        }
      }

      return closest;
    }, { distance: Infinity }).element;
  }
}

function openHistoryModal(item, htmlContent) {
  const modal = document.getElementById('history-modal');
  const modalTitle = document.getElementById('modal-title');
  const modalContent = document.getElementById('modal-history-content');
  if (!modal || !modalTitle || !modalContent) return;

  modalTitle.textContent = `${item.title || `İlan No: ${item.id}`} — Fiyat Değişim Geçmişi`;

  if (!htmlContent || htmlContent.trim() === '') {
    modalContent.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted);">Yükleniyor veya fiyat geçmişi bulunamadı.</div>';
  } else {
    modalContent.innerHTML = htmlContent;
  }

  modal.classList.add('open');
}
