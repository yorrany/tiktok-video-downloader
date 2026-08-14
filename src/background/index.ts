export interface TikTokMediaData {
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

// Fetch TikTok video metadata without watermark
export async function fetchTikTokData(videoUrl: string): Promise<TikTokMediaData> {
	// Clean URL (remove query params for API)
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
		throw new Error(`Erro na API do TikTok: status ${response.status}`);
	}

	const json = await response.json();
	if (json.code !== 0 || !json.data) {
		throw new Error(json.msg || 'Não foi possível obter o vídeo sem marca d\'água.');
	}

	const d = json.data;
	return {
		id: d.id || '',
		title: d.title || 'TikTok Video',
		author: (d.author && (d.author.nickname || d.author.unique_id)) || 'TikTok User',
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
	if (request.type === 'FETCH_TIKTOK_DATA') {
		fetchTikTokData(request.url)
			.then((data) => sendResponse({ success: true, data }))
			.catch((err) => sendResponse({ success: false, error: err.message }));
		return true; // async
	}

	if (request.type === 'DOWNLOAD_MEDIA') {
		const filename = request.filename || `tiktok_${Date.now()}.mp4`;
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
			sendResponse({ success: false, error: 'Downloads API unavailable' });
		}
		return true; // async
	}

	if (request.type === 'GET_CURRENT_TAB_TIKTOK') {
		chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
			const activeTab = tabs[0];
			if (!activeTab || !activeTab.url || !activeTab.url.includes('tiktok.com')) {
				sendResponse({ success: false, error: 'Abra um vídeo no TikTok primeiro.' });
				return;
			}

			try {
				const data = await fetchTikTokData(activeTab.url);
				sendResponse({ success: true, data, tabUrl: activeTab.url });
			} catch (e: any) {
				sendResponse({ success: false, error: e.message, tabUrl: activeTab.url });
			}
		});
		return true; // async
	}
});
