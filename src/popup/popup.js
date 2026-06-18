const HOVER_DEFAULT_SETTINGS = {
  enabled: true,
  delay: 800,
  hideDelay: 400,
  highlightWords: true,
  showDamage: true
};

document.addEventListener('DOMContentLoaded', () => {
  updateFavoritesCount();
  initCrawlerStatus();
  initHoverSettingsUI();
  initHoverSettingsControls();
  
  // Collapse toggle event listener for the Crawler Status Card
  const toggleHeader = document.getElementById('status-card-toggle');
  if (toggleHeader) {
    chrome.storage.local.get({ statusCardCollapsed: false }, (result) => {
      setStatusCardCollapsedState(result.statusCardCollapsed);
    });

    toggleHeader.addEventListener('click', () => {
      chrome.storage.local.get({ statusCardCollapsed: false }, (result) => {
        const newState = !result.statusCardCollapsed;
        chrome.storage.local.set({ statusCardCollapsed: newState }, () => {
          setStatusCardCollapsedState(newState);
        });
      });
    });
  }

  // Collapse toggle event listener for the Hover Settings Card
  const hoverToggleHeader = document.getElementById('hover-settings-toggle');
  if (hoverToggleHeader) {
    chrome.storage.local.get({ hoverSettingsCollapsed: false }, (result) => {
      setHoverSettingsCollapsedState(result.hoverSettingsCollapsed);
    });

    hoverToggleHeader.addEventListener('click', () => {
      chrome.storage.local.get({ hoverSettingsCollapsed: false }, (result) => {
        const newState = !result.hoverSettingsCollapsed;
        chrome.storage.local.set({ hoverSettingsCollapsed: newState }, () => {
          setHoverSettingsCollapsedState(newState);
        });
      });
    });
  }
  
  const scanBtn = document.getElementById('btn-scan-now');
  if (scanBtn) {
    scanBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'siteOpened', force: true });
    });
  }

  const dashboardBtn = document.getElementById('btn-open-dashboard');
  if (dashboardBtn) {
    dashboardBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard/dashboard.html') });
    });
  }

  const autoScanCheckbox = document.getElementById('toggle-auto-scan');
  if (autoScanCheckbox) {
    chrome.storage.local.get({ autoScanEnabled: true }, (result) => {
      autoScanCheckbox.checked = result.autoScanEnabled !== false; // defaults to true
    });

    autoScanCheckbox.addEventListener('change', () => {
      chrome.storage.local.set({ autoScanEnabled: autoScanCheckbox.checked }, () => {
        console.log(`[sarısite Fiyat Takip] Otomatik arka plan taraması: ${autoScanCheckbox.checked ? 'Açık' : 'Kapalı'}`);
      });
    });
  }
});

function updateFavoritesCount() {
  const badge = document.getElementById('fav-count');
  if (badge) {
    chrome.storage.local.get({ userFavorites: {} }, (result) => {
      const count = Object.keys(result.userFavorites || {}).length;
      badge.textContent = `${count} İlan`;
    });
  }
}

let countdownInterval = null;

function initCrawlerStatus() {
  chrome.storage.local.get({ crawlerState: {} }, (result) => {
    renderCrawlerStatus(result.crawlerState);
  });
}

function renderCrawlerStatus(state) {
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
    const scanBtn = document.getElementById('btn-scan-now');

    if (!card || !dot || !badge || !message || !queueInfo || !autoScanMode || !lastScan || !timerContainer || !progressBar) return;

    clearInterval(countdownInterval);

    // Update the auto scan mode text and color dynamically
    if (autoScanEnabled) {
      autoScanMode.textContent = 'Otomatik Tarama: Aktif';
      autoScanMode.style.color = '#10b981'; // green color
    } else {
      autoScanMode.textContent = 'Otomatik Tarama: Kapalı';
      autoScanMode.style.color = '#9ca3af'; // gray color
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

    // Render last scan time
    lastScan.textContent = `Son Güncelleme: ${formatTime(lastScanTime)}`;

    if (isProcessing) {
      // Disable scan button when scanning is active
      if (scanBtn) {
        scanBtn.disabled = true;
        scanBtn.style.opacity = '0.5';
        scanBtn.style.cursor = 'not-allowed';
      }

      if (nextCheckTime) {
        // WAITING state (security cooldown)
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
        // SCANNING state
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
        // Transition/starting state
        badge.textContent = 'Taranıyor';
        badge.className = 'status-badge scanning';
        dot.className = 'status-dot scanning';
        
        timerContainer.style.display = 'none';
        message.textContent = lastMsg || '⏳ Tarama başlatılıyor, ilanlar kuyruğa alınıyor...';

        const queueCountText = remaining > 0 ? `${remaining} ilan kaldı` : 'Hesaplanıyor...';
        queueInfo.textContent = `Kuyrukta: ${queueCountText}`;
      }
    } else {
      // IDLE state
      if (!autoScanEnabled) {
        badge.textContent = 'Pasif';
        badge.className = 'status-badge disabled';
        dot.className = 'status-dot disabled';
        timerContainer.style.display = 'none';
        message.textContent = 'Otomatik tarama kapalı. "Hemen Tara" ile manuel başlatabilirsiniz.';
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

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
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
    if (changes.userFavorites) {
      updateFavoritesCount();
    }
    if (changes.hoverSettingsCollapsed) {
      setHoverSettingsCollapsedState(changes.hoverSettingsCollapsed.newValue);
    }
  }
  if (namespace === 'sync') {
    if (changes.settings) {
      initHoverSettingsUI();
    }
  }
});

function setStatusCardCollapsedState(collapsed) {
  const card = document.getElementById('crawler-status-card');
  if (!card) return;
  if (collapsed) {
    card.classList.add('collapsed');
  } else {
    card.classList.remove('collapsed');
  }
}

function setHoverSettingsCollapsedState(collapsed) {
  const card = document.getElementById('hover-settings-card');
  if (!card) return;
  if (collapsed) {
    card.classList.add('collapsed');
  } else {
    card.classList.remove('collapsed');
  }
}

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
    } catch(e) {
      return val + ' TL';
    }
  };

  const isDrop = changeType === 'düştü';
  const accentColor = isDrop ? '#10b981' : '#ef4444';
  const bgColor = isDrop ? 'rgba(16, 185, 129, 0.06)' : 'rgba(239, 68, 68, 0.06)';
  const borderColor = isDrop ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)';
  const icon = isDrop ? '📉' : '📈';
  const label = isDrop ? 'Fiyat Düştü!' : 'Fiyat Yükseldi!';

  const diff = Math.abs(newPrice - oldPrice);
  const percent = Math.round((diff / oldPrice) * 100);
  const diffLabel = isDrop 
    ? `- ${formatPriceVal(diff)} (-%${percent})` 
    : `+ ${formatPriceVal(diff)} (+%${percent})`;

  const displayTitle = title && title.length > 40 ? title.substring(0, 38) + '...' : (title || `İlan #${ilanId}`);

  const toast = document.createElement('div');
  toast.id = `popup-toast-${ilanId}`;
  toast.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: ${bgColor};
    border-bottom: 2px solid ${borderColor};
    padding: 10px 14px;
    z-index: 10000;
    font-family: inherit;
    font-size: 12px;
    color: var(--text, #1f2937);
    backdrop-filter: blur(12px);
    transform: translateY(-100%);
    opacity: 0;
    transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.35s ease;
    box-sizing: border-box;
  `;

  toast.innerHTML = `
    <div style="display: flex; align-items: flex-start; gap: 8px;">
      <span style="font-size: 18px; line-height: 1;">${icon}</span>
      <div style="flex: 1; min-width: 0;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
          <span style="font-weight: 700; font-size: 11px; color: ${accentColor}; text-transform: uppercase; letter-spacing: 0.3px;">${label}</span>
          <button id="popup-toast-close-${ilanId}" style="
            background: none; border: none; color: var(--text-muted, #6b7280); 
            cursor: pointer; font-size: 14px; padding: 0 2px; line-height: 1;
          ">✕</button>
        </div>
        <div style="font-weight: 600; font-size: 12px; margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${title}">${displayTitle}</div>
        <div style="display: flex; align-items: center; gap: 8px; font-size: 11px;">
          <span style="text-decoration: line-through; color: var(--text-muted, #6b7280);">${formatPriceVal(oldPrice)}</span>
          <span style="color: var(--text-muted, #6b7280);">→</span>
          <span style="font-weight: 800; color: ${accentColor}; font-size: 13px;">${formatPriceVal(newPrice)}</span>
          <span style="font-weight: 700; color: ${accentColor}; font-size: 10px; margin-left: auto;">${diffLabel}</span>
        </div>
        <div style="margin-top: 6px; display: flex; justify-content: flex-end;">
          <a href="${atob('aHR0cHM6Ly93d3cuc2FoaWJpbmRlbi5jb20=')}/kelime-ile-arama?query_text=${ilanId}" target="_blank" 
             id="popup-toast-link-${ilanId}"
             style="font-size: 11px; font-weight: 600; color: var(--primary, #3b82f6); text-decoration: none; display: inline-flex; align-items: center; gap: 3px;">
            İlana Git ↗
          </a>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(toast);

  // Trigger slide-in
  requestAnimationFrame(() => {
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';
  });

  const dismissToast = () => {
    toast.style.transform = 'translateY(-100%)';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 380);
  };

  const closeBtn = document.getElementById(`popup-toast-close-${ilanId}`);
  if (closeBtn) closeBtn.addEventListener('click', dismissToast);

  const linkEl = document.getElementById(`popup-toast-link-${ilanId}`);
  if (linkEl) {
    linkEl.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: linkEl.href });
    });
  }

  // Auto dismiss after 8 seconds
  setTimeout(() => {
    if (document.body.contains(toast)) dismissToast();
  }, 8000);
}
