export interface TikFlowMediaData {
	id: string;
	title: string;
	author: string;
	avatar: string;
	cover: string;
	videoNoWatermark: string;
	videoHd?: string;
	videoWatermark?: string;
	audio: string;
	audioTitle: string;
	duration: number;
}

// Fetch video metadata without watermark
export async function fetchTikFlowData(videoUrl: string): Promise<TikFlowMediaData> {
	if (!videoUrl || (!videoUrl.includes('tiktok.com') && !videoUrl.includes('douyin.com'))) {
		throw new Error('Por favor, forneça um link válido.');
	}

	// If URL is just home/foryou without specific video
	if ((videoUrl.endsWith('/foryou') || videoUrl.endsWith('tiktok.com/') || videoUrl.endsWith('/explore')) && !videoUrl.includes('/video/') && !videoUrl.includes('/photo/')) {
		throw new Error('Abra um vídeo específico ou use o botão "Baixar" no post.');
	}

	const cleanUrl = videoUrl.split('?')[0];

	// Try TikWM API
	const response = await fetch('https://www.tikwm.com/api/', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
			'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
		},
		body: `url=${encodeURIComponent(cleanUrl)}&hd=1`,
	});

	if (!response.ok) {
		throw new Error(`Erro na comunicação com o servidor (Status ${response.status}).`);
	}

	const json = await response.json();
	if (json.code !== 0 || !json.data) {
		const msg = json.msg || '';
		if (msg.includes('Url parsing is failed') || msg.includes('check url')) {
			throw new Error('Link do vídeo não identificado. Clique no botão "Baixar" diretamente no post.');
		}
		throw new Error(msg || 'Não foi possível extrair o vídeo sem marca d\'água.');
	}

	const d = json.data;
	return {
		id: d.id || '',
		title: d.title || 'Video',
		author: (d.author && (d.author.nickname || d.author.unique_id)) || 'User',
		avatar: (d.author && d.author.avatar) || '',
		cover: d.cover || '',
		videoNoWatermark: d.play || '',
		videoHd: d.hdplay || d.play || '',
		videoWatermark: d.wmplay || '',
		audio: d.music || '',
		audioTitle: (d.music_info && d.music_info.title) || 'Original Sound',
		duration: d.duration || 0,
	};
}

// Message Listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.type === 'FETCH_TIKFLOW_DATA') {
		fetchTikFlowData(request.url)
			.then((data) => sendResponse({ success: true, data }))
			.catch((err) => sendResponse({ success: false, error: err.message }));
		return true; // async
	}

	if (request.type === 'DOWNLOAD_MEDIA') {
		const filename = request.filename || `video_${Date.now()}.mp4`;
		if (chrome.downloads) {
			chrome.downloads.download({
				url: request.url,
				filename: filename,
				saveAs: false,
			}, (downloadId) => {
				if (chrome.runtime.lastError) {
					sendResponse({ success: false, error: chrome.runtime.lastError.message });
				} else {
					sendResponse({ success: true, downloadId });
				}
			});
		} else {
			sendResponse({ success: false, error: 'Downloads API indisponível' });
		}
		return true; // async
	}

	if (request.type === 'GET_CURRENT_TAB_TIKFLOW') {
		chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
			const activeTab = tabs[0];
			if (!activeTab || !activeTab.id || !activeTab.url || !activeTab.url.includes('tiktok.com')) {
				sendResponse({ success: false, error: 'Nenhuma aba ativa compatível encontrada.' });
				return;
			}

			// If tab URL already is a direct video/photo page
			if (activeTab.url.includes('/video/') || activeTab.url.includes('/photo/') || activeTab.url.includes('/t/')) {
				try {
					const data = await fetchTikFlowData(activeTab.url);
					sendResponse({ success: true, data, tabUrl: activeTab.url });
				} catch (e: any) {
					sendResponse({ success: false, error: e.message, tabUrl: activeTab.url });
				}
				return;
			}

			// If tab is on feed, find the currently visible video URL on the page
			try {
				const results = await chrome.scripting.executeScript({
					target: { tabId: activeTab.id },
					func: () => {
						try {
							const videos = Array.from(document.querySelectorAll('video'));
							for (const v of videos) {
								const rect = v.getBoundingClientRect();
								if (rect.top >= -200 && rect.bottom <= (window.innerHeight + 200) && rect.height > 100) {
									const parent = v.closest('[data-e2e="feed-item"], [data-e2e="recommend-list-item-container"], div[class*="DivItemContainer"], [data-e2e="browse-video-container"], section, article') || v.parentElement;
									const link = parent?.querySelector('a[href*="/video/"], a[href*="/photo/"]') as HTMLAnchorElement | null;
									if (link && link.href) {
										return link.href;
									}
								}
							}
							const firstLink = document.querySelector('a[href*="/video/"], a[href*="/photo/"]') as HTMLAnchorElement | null;
							return firstLink ? firstLink.href : null;
						} catch (e) {
							return null;
						}
					}
				});

				const detectedUrl = results?.[0]?.result;
				if (detectedUrl) {
					const data = await fetchTikFlowData(detectedUrl);
					sendResponse({ success: true, data, tabUrl: detectedUrl });
				} else {
					sendResponse({ success: false, error: 'Abra um vídeo ou use o botão "Baixar" diretamente na timeline.', tabUrl: activeTab.url });
				}
			} catch (e: any) {
				sendResponse({ success: false, error: 'Clique no botão "Baixar" diretamente no vídeo.', tabUrl: activeTab.url });
			}
		});
		return true; // async
	}
});
