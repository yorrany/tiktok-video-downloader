interface TikFlowMedia {
  id: string;
  title: string;
  author: string;
  videoNoWatermark: string;
  videoHd?: string;
  audio: string;
}

const videoCache = new Map<string, TikFlowMedia>();
const interceptedItems = new Map<string, any>();

// 1. Inject interceptor
function injectScript() {
  try {
    const s = document.createElement('script');
    s.src = chrome.runtime.getURL('injected.js');
    s.onload = () => s.remove();
    (document.head || document.documentElement).appendChild(s);
  } catch (e) {}
}

// 2. Listen to injected script messages
window.addEventListener('message', (e) => {
  if (e.source !== window || !e.data || e.data.source !== 'TIKFLOW_INJECTED') return;

  if (e.data.type === 'ITEM_DATA' && e.data.data) {
    const item = e.data.data;
    if (item.id) {
      interceptedItems.set(item.id, item);
      if (item.videoUrl) {
        interceptedItems.set(item.videoUrl, item);
      }
    }
  }
});

const DOWNLOAD_ICON_SVG = `
<svg viewBox="0 0 24 24" fill="currentColor">
  <path d="M12 2.25a.75.75 0 0 1 .75.75v11.69l3.22-3.22a.75.75 0 1 1 1.06 1.06l-4.5 4.5a.75.75 0 0 1-1.06 0l-4.5-4.5a.75.75 0 1 1 1.06-1.06l3.22 3.22V3a.75.75 0 0 1 .75-.75Zm-9 15a.75.75 0 0 1 .75.75v2.25a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5V18a.75.75 0 0 1 1.5 0v2.25A3 3 0 0 1 18.75 23.25H5.25A3 3 0 0 1 2.25 20.25V18a.75.75 0 0 1 .75-.75Z"/>
</svg>
`;

const SPINNER_SVG = `
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
  <circle cx="12" cy="12" r="10" stroke-width="3" stroke-dasharray="32" stroke-linecap="round"/>
</svg>
`;

const VIDEO_ICON_SVG = `
<svg viewBox="0 0 24 24" fill="currentColor">
  <path d="M4.5 4.5a3 3 0 0 0-3 3v9a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-9a3 3 0 0 0-3-3H4.5ZM19.5 8.25l3-2.25v12l-3-2.25V8.25Z"/>
</svg>
`;

const AUDIO_ICON_SVG = `
<svg viewBox="0 0 24 24" fill="currentColor">
  <path d="M19.95 3.3a1.5 1.5 0 0 0-1.65-.25L8.55 7.42A1.5 1.5 0 0 0 7.5 8.81v8.44a3.75 3.75 0 1 0 1.5 3V10.22l9-4.05v5.08a3.75 3.75 0 1 0 1.5 3V4.5a1.5 1.5 0 0 0-.05-1.2Z"/>
</svg>
`;

function showToast(message: string) {
  const existing = document.querySelector('.tikflow-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'tikflow-toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

function triggerDownload(url: string, filename: string) {
  chrome.runtime.sendMessage({
    type: 'DOWNLOAD_MEDIA',
    url,
    filename
  }, (response) => {
    if (chrome.runtime.lastError || !response || !response.success) {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  });
}

// Multi-method video URL extractor
function extractVideoUrl(container: HTMLElement): string | null {
  const parent = container.closest('[data-e2e="feed-item"], [data-e2e="recommend-list-item-container"], div[class*="DivItemContainer"], [data-e2e="browse-video-container"], section, article') || container;
  
  // 1. Direct anchor with /video/ or /photo/
  const link = parent.querySelector('a[href*="/video/"], a[href*="/photo/"]') as HTMLAnchorElement | null;
  if (link && link.href) {
    return link.href;
  }

  // 2. Search anywhere inside parent for /video/ link
  const allLinks = parent.querySelectorAll('a');
  for (const a of Array.from(allLinks)) {
    if (a.href && (a.href.includes('/video/') || a.href.includes('/photo/'))) {
      return a.href;
    }
  }

  // 3. Search HTML for 18-20 digit ID
  const html = parent.outerHTML;
  const matchId = html.match(/video\/(\d{15,25})/i) || 
                  html.match(/id="[^"]*?(\d{17,22})[^"]*?"/i) ||
                  html.match(/data-id="(\d{15,25})"/i) ||
                  html.match(/itemStruct.*?(\d{18,22})/i);
                  
  const authorLink = parent.querySelector('a[href*="/@"]') as HTMLAnchorElement | null;
  const username = authorLink ? authorLink.href.split('/@')[1]?.split('/')[0]?.split('?')[0] : 'user';

  if (matchId && matchId[1]) {
    return `https://www.tiktok.com/@${username}/video/${matchId[1]}`;
  }

  // 4. If on video detail page
  if (window.location.href.includes('/video/') || window.location.href.includes('/photo/')) {
    return window.location.href;
  }

  // 5. Look for any item in interceptedItems matching author
  for (const [id, item] of interceptedItems.entries()) {
    if (item.author === username && item.videoUrl) {
      return item.videoUrl;
    }
  }

  // 6. Return first intercepted item if on feed
  if (interceptedItems.size > 0) {
    const first = Array.from(interceptedItems.values())[0];
    if (first && first.videoUrl) return first.videoUrl;
  }

  return null;
}

function showDownloadMenu(parent: HTMLElement, container: HTMLElement, btn: HTMLElement) {
  const existing = parent.querySelector('.tikflow-menu');
  if (existing) {
    existing.remove();
    return;
  }

  const videoUrl = extractVideoUrl(container);
  if (!videoUrl) {
    showToast('Carregando dados do vídeo, tente novamente em um instante.');
    return;
  }

  btn.classList.add('tikflow-spinning');
  const originalSvg = btn.innerHTML;
  btn.innerHTML = SPINNER_SVG;

  chrome.runtime.sendMessage({
    type: 'FETCH_TIKFLOW_DATA',
    url: videoUrl
  }, (res) => {
    btn.classList.remove('tikflow-spinning');
    btn.innerHTML = originalSvg;

    if (!res || !res.success || !res.data) {
      showToast(res?.error || 'Erro ao obter vídeo sem marca d\'água.');
      return;
    }

    const data: TikFlowMedia = res.data;
    videoCache.set(videoUrl, data);

    const menu = document.createElement('div');
    menu.className = 'tikflow-menu';

    // 1. No Watermark Video Button
    const videoBtn = document.createElement('button');
    videoBtn.type = 'button';
    videoBtn.className = 'tikflow-menu-item';
    videoBtn.innerHTML = `${VIDEO_ICON_SVG}<span>Vídeo Sem Marca d'Água (HD)</span>`;
    videoBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.remove();
      const filename = `tikflow_${data.author}_${data.id || Date.now()}_no_watermark.mp4`.replace(/[^\w\.-]/g, '_');
      triggerDownload(data.videoHd || data.videoNoWatermark, filename);
      showToast('Baixando vídeo sem marca d\'água...');
    });

    // 2. Audio MP3 Button
    const audioBtn = document.createElement('button');
    audioBtn.type = 'button';
    audioBtn.className = 'tikflow-menu-item';
    audioBtn.innerHTML = `${AUDIO_ICON_SVG}<span>Áudio Original (MP3)</span>`;
    audioBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.remove();
      if (!data.audio) {
        showToast('Áudio não disponível separadamente.');
        return;
      }
      const filename = `tikflow_audio_${data.author}_${data.id || Date.now()}.mp3`.replace(/[^\w\.-]/g, '_');
      triggerDownload(data.audio, filename);
      showToast('Baixando áudio MP3...');
    });

    menu.appendChild(videoBtn);
    menu.appendChild(audioBtn);

    const closeHandler = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node) && !parent.contains(e.target as Node)) {
        menu.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 10);

    parent.appendChild(menu);
  });
}

function processFeedItem(feedItem: HTMLElement) {
  if (feedItem.querySelector('.tikflow-btn-wrapper')) {
    return;
  }

  const actionContainer = feedItem.querySelector('[data-e2e="feed-action-item"]')?.parentElement ||
                          feedItem.querySelector('[class*="ActionItemContainer"]') ||
                          feedItem.querySelector('[class*="ActionBarWrapper"]') ||
                          feedItem.querySelector('[data-e2e="browse-action-item"]')?.parentElement ||
                          feedItem.querySelector('[class*="DivActionWrapper"]');

  if (!actionContainer) {
    return;
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'tikflow-btn-wrapper';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'tikflow-action-btn';
  btn.setAttribute('aria-label', 'Baixar sem marca d\'água');
  btn.setAttribute('title', 'Baixar Vídeo Sem Marca d\'Água');
  btn.innerHTML = DOWNLOAD_ICON_SVG;

  const label = document.createElement('span');
  label.className = 'tikflow-btn-label';
  label.textContent = 'Baixar';

  wrapper.appendChild(btn);
  wrapper.appendChild(label);

  wrapper.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    showDownloadMenu(wrapper, feedItem, btn);
  });

  actionContainer.appendChild(wrapper);
}

function processVideoPlayer(player: HTMLElement) {
  if (player.querySelector('.tikflow-floating-btn') || player.classList.contains('tikflow-tagged')) {
    return;
  }

  player.classList.add('tikflow-tagged');

  const floatingBtn = document.createElement('button');
  floatingBtn.type = 'button';
  floatingBtn.className = 'tikflow-floating-btn';
  floatingBtn.innerHTML = `${DOWNLOAD_ICON_SVG}<span>Sem Marca</span>`;

  floatingBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    showDownloadMenu(player, player, floatingBtn);
  });

  const pos = window.getComputedStyle(player).position;
  if (pos === 'static') {
    player.style.position = 'relative';
  }

  player.appendChild(floatingBtn);
}

function scanDOM() {
  const items = document.querySelectorAll('[data-e2e="feed-item"], [data-e2e="recommend-list-item-container"], [class*="DivItemContainer"], [data-e2e="browse-video-container"], section, article');
  items.forEach((item) => processFeedItem(item as HTMLElement));

  const players = document.querySelectorAll('[data-e2e="browse-video"], [class*="DivVideoPlayerContainer"], div[class*="DivVideoContainer"]');
  players.forEach((player) => processVideoPlayer(player as HTMLElement));
}

function init() {
  injectScript();
  scanDOM();

  const observer = new MutationObserver(() => {
    scanDOM();
  });

  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true,
  });

  setInterval(scanDOM, 1500);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
