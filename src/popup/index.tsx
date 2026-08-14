import { h, render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { TikFlowMediaData } from '../background';
import './popup.css';

render(<App />, document.getElementById('root')!);

function App() {
	const [mediaData, setMediaData] = useState<TikFlowMediaData | null>(null);
	const [loading, setLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);
	const [inputUrl, setInputUrl] = useState<string>('');

	const fetchVideo = (url: string) => {
		setLoading(true);
		setError(null);
		chrome.runtime.sendMessage({
			type: 'FETCH_TIKFLOW_DATA',
			url: url
		}, (res) => {
			setLoading(false);
			if (res && res.success && res.data) {
				setMediaData(res.data);
			} else {
				setError(res?.error || 'Vídeo não encontrado.');
			}
		});
	};

	useEffect(() => {
		chrome.runtime.sendMessage({ type: 'GET_CURRENT_TAB_TIKFLOW' }, (res) => {
			setLoading(false);
			if (res && res.success && res.data) {
				setMediaData(res.data);
				if (res.tabUrl) setInputUrl(res.tabUrl);
			} else {
				// Standby mode
			}
		});
	}, []);

	const handleDownloadVideo = () => {
		if (!mediaData) return;
		const filename = `tikflow_${mediaData.author}_${mediaData.id || Date.now()}_no_watermark.mp4`.replace(/[^\w\.-]/g, '_');
		chrome.runtime.sendMessage({
			type: 'DOWNLOAD_MEDIA',
			url: mediaData.videoHd || mediaData.videoNoWatermark,
			filename
		});
	};

	const handleDownloadAudio = () => {
		if (!mediaData || !mediaData.audio) return;
		const filename = `tikflow_audio_${mediaData.author}_${mediaData.id || Date.now()}.mp3`.replace(/[^\w\.-]/g, '_');
		chrome.runtime.sendMessage({
			type: 'DOWNLOAD_MEDIA',
			url: mediaData.audio,
			filename
		});
	};

	return (
		<div className="tf-container">
			<header className="tf-header">
				<div className="tf-brand">
					<svg className="tf-logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
						<path d="M12 3v12m0 0l4-4m-4 4l-4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
					</svg>
					<h1>Tik<span>Flow</span></h1>
				</div>
				<span className="tf-tag">Sem Marca</span>
			</header>

			<div className="tf-input-group">
				<input
					type="text"
					className="tf-input"
					placeholder="Cole o link do vídeo..."
					value={inputUrl}
					onInput={(e) => setInputUrl((e.target as HTMLInputElement).value)}
					onKeyDown={(e) => {
						if (e.key === 'Enter' && inputUrl.trim()) {
							fetchVideo(inputUrl.trim());
						}
					}}
				/>
				<button
					type="button"
					className="tf-btn-fetch"
					onClick={() => inputUrl.trim() && fetchVideo(inputUrl.trim())}
				>
					Buscar
				</button>
			</div>

			<main className="tf-content">
				{loading && (
					<div className="tf-state">
						<div className="tf-spinner"></div>
						<p>Processando vídeo sem marca d'água...</p>
					</div>
				)}

				{!loading && error && (
					<div className="tf-state">
						<p style={{ color: '#fe2c55' }}>{error}</p>
					</div>
				)}

				{!loading && !mediaData && !error && (
					<div className="tf-state">
						<p>Nenhum vídeo carregado no momento.</p>
						<small>Abra um vídeo ou cole o link acima.</small>
					</div>
				)}

				{!loading && mediaData && (
					<div className="tf-card">
						<div className="tf-card-preview">
							{mediaData.cover && (
								<img src={mediaData.cover} alt="Cover" className="tf-cover" />
							)}
							<div className="tf-meta">
								<span className="tf-author">@{mediaData.author}</span>
								<p className="tf-title">{mediaData.title}</p>
								<span className="tf-badge-nowm">✓ HD Sem Marca</span>
							</div>
						</div>

						<div className="tf-actions">
							<button type="button" className="tf-btn-primary" onClick={handleDownloadVideo}>
								<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
									<path d="M4.5 4.5a3 3 0 0 0-3 3v9a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-9a3 3 0 0 0-3-3H4.5ZM19.5 8.25l3-2.25v12l-3-2.25V8.25Z"/>
								</svg>
								Baixar Vídeo (Sem Marca d'Água)
							</button>

							{mediaData.audio && (
								<button type="button" className="tf-btn-secondary" onClick={handleDownloadAudio}>
									<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
										<path d="M19.95 3.3a1.5 1.5 0 0 0-1.65-.25L8.55 7.42A1.5 1.5 0 0 0 7.5 8.81v8.44a3.75 3.75 0 1 0 1.5 3V10.22l9-4.05v5.08a3.75 3.75 0 1 0 1.5 3V4.5a1.5 1.5 0 0 0-.05-1.2Z"/>
									</svg>
									Baixar Áudio Original (MP3)
								</button>
							)}
						</div>
					</div>
				)}
			</main>

			<footer className="tf-footer">
				<span>Dica: Use também o botão "Baixar" diretamente nos vídeos</span>
			</footer>
		</div>
	);
}
