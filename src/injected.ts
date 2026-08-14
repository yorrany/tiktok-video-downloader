// Injected script in page context to intercept video feed data & React properties
(function() {
  if ((window as any).__tikflow_injected__) return;
  (window as any).__tikflow_injected__ = true;

  const itemsMap = new Map<string, any>();

  function processItem(item: any) {
    if (!item || typeof item !== 'object') return;
    const id = item.id || item.itemId || item.awemeId || item.id_str;
    if (!id || !/^\d{15,25}$/.test(id.toString())) return;

    const author = (item.author && (item.author.uniqueId || item.author.unique_id || item.author.nickname)) || 'user';
    const title = item.desc || item.title || '';
    const video = item.video || {};
    const music = item.music || {};

    const playAddr = video.playAddr || video.downloadAddr || (video.bitrateInfo && video.bitrateInfo[0] && video.bitrateInfo[0].PlayAddr && video.bitrateInfo[0].PlayAddr.UrlList && video.bitrateInfo[0].PlayAddr.UrlList[0]) || '';
    const musicUrl = music.playUrl || music.url || '';

    const entry = {
      id: id.toString(),
      author: author.toString(),
      title: title.toString(),
      videoUrl: `https://www.tiktok.com/@${author}/video/${id}`,
      playAddr: playAddr,
      musicUrl: musicUrl
    };

    itemsMap.set(entry.id, entry);

    window.postMessage({
      source: 'TIKFLOW_INJECTED',
      type: 'ITEM_DATA',
      data: entry
    }, '*');
  }

  function walkObject(obj: any, depth = 0) {
    if (!obj || typeof obj !== 'object' || depth > 8) return;

    if (obj.itemList && Array.isArray(obj.itemList)) {
      obj.itemList.forEach(processItem);
    }
    if (obj.items && Array.isArray(obj.items)) {
      obj.items.forEach(processItem);
    }
    if (obj.itemInfo && obj.itemInfo.itemStruct) {
      processItem(obj.itemInfo.itemStruct);
    }
    if (obj.itemStruct) {
      processItem(obj.itemStruct);
    }

    if (Array.isArray(obj)) {
      for (const item of obj) {
        walkObject(item, depth + 1);
      }
    } else {
      for (const key of Object.keys(obj)) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          walkObject(obj[key], depth + 1);
        }
      }
    }
  }

  // Intercept fetch
  const originalFetch = window.fetch;
  window.fetch = async function(...args: any[]) {
    const res = await originalFetch.apply(this, args);
    try {
      const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');
      if (url.includes('/api/') || url.includes('/item/') || url.includes('/recommend/')) {
        const clone = res.clone();
        clone.json().then(data => walkObject(data)).catch(() => {});
      }
    } catch (e) {}
    return res;
  };

  // Intercept XHR
  const originalXhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function(...args: any[]) {
    this.addEventListener('load', function() {
      try {
        if (this.responseText && (this.responseText.includes('itemList') || this.responseText.includes('itemStruct'))) {
          const data = JSON.parse(this.responseText);
          walkObject(data);
        }
      } catch (e) {}
    });
    return originalXhrSend.apply(this, args as any);
  };

  // Listen to requests from content script to resolve React Fiber on clicked element
  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data.source !== 'TIKFLOW_CONTENT') return;

    if (e.data.type === 'FIND_ELEMENT_DATA') {
      const { requestId, selector } = e.data;
      let found: any = null;

      try {
        const el = selector ? document.querySelector(selector) : null;
        if (el) {
          let cur: any = el;
          while (cur && !found) {
            for (const key of Object.keys(cur)) {
              if (key.startsWith('__reactFiber$') || key.startsWith('__reactProps$')) {
                const props = cur[key];
                let check = props;
                for (let i = 0; i < 6 && check; i++) {
                  if (check.memoizedProps?.itemInfo?.itemStruct) {
                    found = check.memoizedProps.itemInfo.itemStruct;
                    break;
                  }
                  if (check.memoizedProps?.itemStruct) {
                    found = check.memoizedProps.itemStruct;
                    break;
                  }
                  if (check.memoizedProps?.item) {
                    found = check.memoizedProps.item;
                    break;
                  }
                  check = check.return || check.child;
                }
              }
            }
            cur = cur.parentElement;
          }
        }
      } catch (err) {}

      if (found) {
        processItem(found);
      }

      window.postMessage({
        source: 'TIKFLOW_INJECTED',
        type: 'FIND_ELEMENT_DATA_RESPONSE',
        requestId,
        item: found ? {
          id: found.id || found.id_str,
          author: found.author?.uniqueId || found.author?.nickname || 'user',
          url: `https://www.tiktok.com/@${found.author?.uniqueId || 'user'}/video/${found.id || found.id_str}`
        } : null
      }, '*');
    }
  });

  console.info('[TikFlow] Data interceptor initialized');
})();
