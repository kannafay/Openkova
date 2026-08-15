'use client';

import { useEffect, useState } from 'react';
import SnippetInput from './SnippetInput';
import FileInput from './FileInput';
import UrlInput from './UrlInput';
import Gallery from './Gallery';

type Tab = 'snippet' | 'files' | 'url';
export type OutputFormat = 'png' | 'jpeg' | 'webp' | 'pdf';

export interface GalleryImage {
  imageId: string;
  label: string;
  filename?: string;
}

export interface Viewport {
  width: number;
  height: number;
  label: string;
}

const VIEWPORTS: Viewport[] = [
  { label: 'Mobile', width: 390, height: 844 },
  { label: 'Email', width: 720, height: 800 },
  { label: 'Desktop', width: 1280, height: 800 },
  { label: 'Wide', width: 1920, height: 1080 },
];

const DEFAULT_VIEWPORT = VIEWPORTS.find(({ label }) => label === 'Desktop')!;

const FORMATS: { id: OutputFormat; label: string }[] = [
  { id: 'png', label: 'PNG' },
  { id: 'jpeg', label: 'JPEG' },
  { id: 'webp', label: 'WebP' },
  { id: 'pdf', label: 'PDF' },
];

interface Props {
  initialSessionId: string | null;
  cleanupEnabled: boolean;
  cleanupRetentionHours: number;
}

export default function ConverterTabs({ initialSessionId, cleanupEnabled, cleanupRetentionHours }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('snippet');
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [viewport, setViewport] = useState<Viewport>(DEFAULT_VIEWPORT);
  const [fullPage, setFullPage] = useState(false);
  const [format, setFormat] = useState<OutputFormat>('png');
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    setApiKey(sessionStorage.getItem('openkova_api_key') ?? '');
  }, []);

  function handleApiKeyChange(value: string) {
    setApiKey(value);
    if (value) sessionStorage.setItem('openkova_api_key', value);
    else sessionStorage.removeItem('openkova_api_key');
  }

  function handleConversionComplete(newSessionId: string, newImages: GalleryImage[]) {
    setSessionId(newSessionId);
    setImages((prev) => [...newImages, ...prev]);
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'snippet', label: 'HTML Snippet' },
    { id: 'files', label: 'Files' },
    { id: 'url', label: 'URL / Crawl' },
  ];

  return (
    <div>
      <div className="api-key-control">
        <label className="api-key-control__label" htmlFor="api-key-input">API key</label>
        <input
          id="api-key-input"
          className="api-key-control__input"
          type="password"
          value={apiKey}
          onChange={(event) => handleApiKeyChange(event.target.value)}
          placeholder="Enter API_KEY"
          autoComplete="off"
          spellCheck={false}
        />
        <span className={`api-key-control__status${apiKey.trim() ? ' api-key-control__status--ready' : ''}`}>
          {apiKey.trim() ? 'Ready' : 'Required'}
        </span>
        <span
          className={`cleanup-status${cleanupEnabled ? ' cleanup-status--enabled' : ''}`}
          title={cleanupEnabled ? 'Expired sessions are checked every hour' : 'Automatic cleanup is disabled'}
        >
          <span className="cleanup-status__dot" aria-hidden="true" />
          {cleanupEnabled ? `Auto cleanup: ${cleanupRetentionHours}h` : 'Auto cleanup: Off'}
        </span>
      </div>

      <div className="converter-tabs__toolbar">
        <div className="converter-tabs__tablist" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`converter-tabs__tab${activeTab === tab.id ? ' converter-tabs__tab--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="converter-tabs__controls">
          <button
            className={`fullpage-btn${fullPage ? ' fullpage-btn--active' : ''}`}
            onClick={() => setFullPage((p) => !p)}
            title="Capture the full scrollable page height, not just the viewport"
          >
            Full page
          </button>

          <div className="format-selector" role="group" aria-label="Output format">
            {FORMATS.map((f) => (
              <button
                key={f.id}
                className={`format-selector__btn${format === f.id ? ' format-selector__btn--active' : ''}`}
                onClick={() => setFormat(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="viewport-selector" role="group" aria-label="Viewport size">
            {VIEWPORTS.map((vp) => (
              <button
                key={vp.label}
                className={`viewport-selector__btn${viewport.label === vp.label ? ' viewport-selector__btn--active' : ''}`}
                onClick={() => setViewport(vp)}
                title={`${vp.width} × ${vp.height}`}
              >
                {vp.label}
                <span className="viewport-selector__dims">{vp.width}px</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeTab === 'snippet' && (
        <SnippetInput apiKey={apiKey} sessionId={sessionId} viewport={viewport} fullPage={fullPage} format={format} onConversionComplete={handleConversionComplete} />
      )}
      {activeTab === 'files' && (
        <FileInput apiKey={apiKey} sessionId={sessionId} viewport={viewport} fullPage={fullPage} format={format} onConversionComplete={handleConversionComplete} />
      )}
      {activeTab === 'url' && (
        <UrlInput apiKey={apiKey} sessionId={sessionId} viewport={viewport} fullPage={fullPage} format={format} onConversionComplete={handleConversionComplete} />
      )}

      {images.length > 0 && sessionId && (
        <Gallery sessionId={sessionId} images={images} />
      )}
    </div>
  );
}
