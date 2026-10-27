import React, { useRef, useState } from 'react';
import { t } from '../constants/translations';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';
import {
  clearActivityFromUrl,
  parseActivityFromUrl,
  shareWorksheetWithImage,
} from '../services/urlService';

export interface WorksheetItem {
  id: string;
  title: string;
  badge: string;
  previewImg: string;
  pdfUrl: string;
  pdfFilename: string;
  jpgUrl: string;
  jpgFilename: string;
  description: string;
  pubName: string;
  domain: string;
  dateLabel: string;
}

export const WORKSHEETS: WorksheetItem[] = [
  {
    id: 'halloween-2026-coloring-page',
    title: 'Littlables Halloween Party Coloring Page',
    badge: '🎨 Coloring Page',
    previewImg: '/img/worksheets/preview/littlables-halloween-coloring-page-preview.jpg',
    pdfUrl: '/img/worksheets/littlables-halloween-2026-coloring-page.pdf',
    pdfFilename: 'littlables-halloween-2026-coloring-page.pdf',
    jpgUrl: '/img/worksheets/littlables-halloween-2026-coloring-page.jpg',
    jpgFilename: 'littlables-halloween-2026-coloring-page.jpg',
    description:
      "Color in a cozy Halloween costume party with friendly jack-o'-lanterns, party balloons, sweet treats, and alphabet blocks!",
    pubName: 'littlables',
    domain: 'littlables.com',
    dateLabel: 'Oct 2026',
  },
  {
    id: 'halloween-2026-hidden-objects-coloring-page',
    title: 'Halloween Hidden Objects & Coloring Page',
    badge: '🔍 Hidden Objects',
    previewImg: '/img/worksheets/preview/littlables-halloween-hidden-objects-coloring-page-preview.jpg',
    pdfUrl: '/img/worksheets/littlables-halloween-2026-hidden-objects-coloring-page.pdf',
    pdfFilename: 'littlables-halloween-2026-hidden-objects-coloring-page.pdf',
    jpgUrl: '/img/worksheets/littlables-halloween-2026-hidden-objects-coloring-page.jpg',
    jpgFilename: 'littlables-halloween-2026-hidden-objects-coloring-page.jpg',
    description:
      'Can you find all 10 hidden objects — pizza, banana, star, heart, key, moon, crown, fish, pencil, and bone — and color the scene?',
    pubName: 'littlables',
    domain: 'littlables.com',
    dateLabel: 'Oct 2026',
  },
];

export function toggleWorksheetsPanel() {
  window.dispatchEvent(new CustomEvent('littlables:toggle-worksheets'));
}

export const WorksheetsPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState<boolean>(() => parseActivityFromUrl().isOpen);
  const [targetWorksheetId, setTargetWorksheetId] = useState<string | null>(
    () => parseActivityFromUrl().worksheetId
  );
  const [backdropTop, setBackdropTop] = useState<number>(54);
  const containerRef = useRef<HTMLElement | null>(null);
  const printFrameRef = useRef<HTMLIFrameElement | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useLockBodyScroll(isOpen);

  React.useEffect(() => {
    const updateHeaderBottom = () => {
      const headerEl = document.querySelector('.news-widget-header');
      if (headerEl) {
        const rect = headerEl.getBoundingClientRect();
        setBackdropTop(Math.max(0, Math.round(rect.bottom)));
      }
    };
    updateHeaderBottom();

    const handleToggle = () => {
      updateHeaderBottom();
      setIsOpen((prev) => {
        const next = !prev;
        if (!next) {
          clearActivityFromUrl();
        }
        return next;
      });
    };

    const handleUrlChange = () => {
      const parsed = parseActivityFromUrl();
      if (parsed.isOpen) {
        updateHeaderBottom();
        setTargetWorksheetId(parsed.worksheetId);
        setIsOpen(true);
      }
    };

    window.addEventListener('littlables:toggle-worksheets', handleToggle);
    window.addEventListener('resize', updateHeaderBottom);
    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    return () => {
      window.removeEventListener('littlables:toggle-worksheets', handleToggle);
      window.removeEventListener('resize', updateHeaderBottom);
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, []);

  React.useEffect(() => {
    if (!isOpen) {
      document.documentElement.classList.remove('story-modal-open');
      document.body.classList.remove('story-modal-open');
      return;
    }
    document.documentElement.classList.add('story-modal-open');
    document.body.classList.add('story-modal-open');

    if (targetWorksheetId) {
      window.requestAnimationFrame(() => {
        const cardEl = document.getElementById(`worksheet-card-${targetWorksheetId}`);
        if (cardEl) {
          cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
    }

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('#worksheets-btn')) return;
      if (containerRef.current && !containerRef.current.contains(target)) {
        clearActivityFromUrl();
        setIsOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.documentElement.classList.remove('story-modal-open');
      document.body.classList.remove('story-modal-open');
    };
  }, [isOpen, targetWorksheetId]);

  const isMobileDevice = (): boolean => {
    if (typeof window === 'undefined') return false;
    const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches;
    const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(
      navigator.userAgent || ''
    );
    return Boolean(coarsePointer || mobileUA);
  };

  const handleFileDownload = async (
    e: React.MouseEvent<HTMLAnchorElement>,
    url: string,
    filename: string,
    fileType: 'pdf' | 'jpg'
  ) => {
    if (isMobileDevice()) {
      // On mobile: let the <a target="_blank"> link open directly and automatically in a new window/tab
      return;
    }

    // On desktop: prompt for a file location using the File System Access API when supported
    e.preventDefault();
    const absoluteUrl = new URL(url, window.location.origin).href;

    if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
      try {
        const pickerTypes =
          fileType === 'pdf'
            ? [
                {
                  description: 'PDF Document',
                  accept: { 'application/pdf': ['.pdf'] },
                },
              ]
            : [
                {
                  description: 'JPEG Image',
                  accept: { 'image/jpeg': ['.jpg', '.jpeg'] },
                },
              ];

        const fileHandle = await (
          window as unknown as {
            showSaveFilePicker: (options: unknown) => Promise<FileSystemFileHandle>;
          }
        ).showSaveFilePicker({
          suggestedName: filename,
          types: pickerTypes,
        });

        const response = await fetch(absoluteUrl);
        const blob = await response.blob();
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          // User cancelled the file location dialog
          return;
        }
        // Fall through to new window + download fallback if blocked by iframe or browser
      }
    }

    // Fallback for desktop browsers/environments without showSaveFilePicker:
    // Open in a new window so the website is never lost, and trigger download
    window.open(absoluteUrl, '_blank', 'noopener,noreferrer');
    try {
      const response = await fetch(absoluteUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const tempLink = document.createElement('a');
      tempLink.href = blobUrl;
      tempLink.download = filename;
      tempLink.target = '_blank';
      tempLink.rel = 'noopener noreferrer';
      document.body.appendChild(tempLink);
      tempLink.click();
      document.body.removeChild(tempLink);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch {
      // Already opened in a new window above
    }
  };

  const handlePrintWorksheet = (worksheet: WorksheetItem) => {
    setPrintingId(worksheet.id);

    const escapedTitle = worksheet.title.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const imgSrc = new URL(worksheet.jpgUrl, window.location.origin).href;
    const pdfHref = new URL(worksheet.pdfUrl, window.location.origin).href;

    const printHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapedTitle}</title>
  <style>
    @page {
      size: portrait;
      margin: 0.25in;
    }
    * {
      box-sizing: border-box;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #f4f1ea;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1f2937;
    }
    .print-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 16px;
      background: #ffffff;
      border-bottom: 1px solid #e5e7eb;
      position: sticky;
      top: 0;
      z-index: 10;
    }
    .print-toolbar-title {
      font-weight: 700;
      font-size: 14px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .print-toolbar-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }
    .print-btn {
      appearance: none;
      border: 1px solid #dc2626;
      background: #ef4444;
      color: #ffffff;
      font-weight: 700;
      font-size: 13px;
      padding: 6px 14px;
      border-radius: 8px;
      cursor: pointer;
      text-decoration: none;
    }
    .print-link-btn {
      appearance: none;
      border: 1px solid #d1d5db;
      background: #f9fafb;
      color: #1f2937;
      font-weight: 700;
      font-size: 13px;
      padding: 6px 12px;
      border-radius: 8px;
      cursor: pointer;
      text-decoration: none;
    }
    .print-page-wrap {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 16px;
      min-height: calc(100vh - 52px);
    }
    img {
      width: 100%;
      max-width: 8.5in;
      height: auto;
      object-fit: contain;
      display: block;
      margin: 0 auto;
      background: #ffffff;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
      border-radius: 4px;
    }
    @media print {
      html, body {
        background: #ffffff;
      }
      .print-toolbar {
        display: none !important;
      }
      .print-page-wrap {
        padding: 0;
        min-height: auto;
      }
      img {
        max-width: 100%;
        max-height: 98vh;
        box-shadow: none;
        border-radius: 0;
      }
    }
  </style>
</head>
<body>
  <div class="print-toolbar">
    <div class="print-toolbar-title">${escapedTitle}</div>
    <div class="print-toolbar-actions">
      <a class="print-link-btn" href="${pdfHref}" download="${worksheet.pdfFilename}">⬇ PDF</a>
      <button type="button" class="print-btn" onclick="window.print()">🖨️ Print</button>
    </div>
  </div>
  <div class="print-page-wrap">
    <img id="print-img" src="${imgSrc}" alt="${escapedTitle}" />
  </div>
  <script>
    (function() {
      var img = document.getElementById('print-img');
      var printed = false;
      function triggerPrint() {
        if (printed) return;
        printed = true;
        setTimeout(function() {
          window.focus();
          window.print();
        }, 150);
      }
      if (img.complete && img.naturalWidth > 0) {
        triggerPrint();
      } else {
        img.onload = triggerPrint;
      }
    })();
  </script>
</body>
</html>`;

    // Open in a new window/tab so the main website is never lost
    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.open();
      printWin.document.write(printHtml);
      printWin.document.close();
      setTimeout(() => {
        setPrintingId((prev) => (prev === worksheet.id ? null : prev));
      }, 900);
      return;
    }

    // Fallback to hidden iframe only if popup was blocked
    const frame = printFrameRef.current;
    const doc = frame?.contentDocument || frame?.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(printHtml);
      doc.close();
    }

    setTimeout(() => {
      setPrintingId((prev) => (prev === worksheet.id ? null : prev));
    }, 1200);
  };

  const handleShareWorksheet = async (
    e: React.MouseEvent<HTMLButtonElement>,
    worksheet: WorksheetItem
  ) => {
    e.stopPropagation();
    const ok = await shareWorksheetWithImage(worksheet);
    if (ok) {
      setCopiedId(worksheet.id);
      setTimeout(() => {
        setCopiedId((prev) => (prev === worksheet.id ? null : prev));
      }, 2000);
    }
  };

  return (
    <div
      className="worksheets-overlay-backdrop"
      style={{ top: `${backdropTop}px` }}
      hidden={!isOpen}
    >
      <section
        ref={containerRef}
        className="worksheets-dropdown-container"
        aria-label="Printable Worksheets & Activities"
      >
        <div className="worksheets-dropdown-scroll">
          <div className="news-grid worksheets-grid">
        {WORKSHEETS.map((worksheet) => (
          <article
            key={worksheet.id}
            id={`worksheet-card-${worksheet.id}`}
            className="news-card worksheet-card"
          >
            <div className="news-card-image-wrap worksheet-card-image-wrap is-loaded">
              <img
                src={worksheet.previewImg}
                alt={worksheet.title}
                className="news-card-image worksheet-card-image is-loaded"
                loading="eager"
                decoding="async"
              />
              <span className="news-card-badge">{worksheet.badge}</span>
            </div>

            <div className="news-card-content">
              <div className="news-card-meta story-meta-grid">
                <span className="story-meta-cell story-provider-badge" title={worksheet.pubName}>
                  📰 {worksheet.pubName}
                </span>
                <span className="story-meta-cell story-date-badge" title={worksheet.dateLabel}>
                  🕒 {worksheet.dateLabel}
                </span>
                <span className="story-meta-cell story-domain-badge" title={worksheet.domain}>
                  🌐 {worksheet.domain}
                </span>
                <span className="story-meta-cell story-scoop-badge">
                  {t('verifiedWire') || "🧸 Littlables' Little Scoop"}
                </span>
              </div>

              <div className="news-card-title worksheet-card-title">{worksheet.title}</div>

              <p className="news-card-desc">{worksheet.description}</p>

              <div className="news-card-footer worksheet-card-footer">
                <button
                  type="button"
                  className="worksheet-action-btn worksheet-print-btn"
                  data-umami-event="Print-Worksheet"
                  data-umami-event-worksheet={worksheet.id}
                  onClick={() => handlePrintWorksheet(worksheet)}
                >
                  🖨️ {printingId === worksheet.id ? 'Preparing…' : 'Print'}
                </button>

                <div className="worksheet-download-group">
                  <a
                    href={worksheet.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="worksheet-action-btn worksheet-download-btn"
                    data-umami-event="Download-Worksheet-PDF"
                    data-umami-event-worksheet={worksheet.id}
                    title="Download PDF"
                    onClick={(e) =>
                      handleFileDownload(e, worksheet.pdfUrl, worksheet.pdfFilename, 'pdf')
                    }
                  >
                    ⬇ PDF
                  </a>
                  <a
                    href={worksheet.jpgUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="worksheet-action-btn worksheet-download-btn"
                    data-umami-event="Download-Worksheet-JPG"
                    data-umami-event-worksheet={worksheet.id}
                    title="Download JPG"
                    onClick={(e) =>
                      handleFileDownload(e, worksheet.jpgUrl, worksheet.jpgFilename, 'jpg')
                    }
                  >
                    ⬇ JPG
                  </a>
                  <button
                    type="button"
                    className={`reaction-pill story-share-btn worksheet-share-btn ${
                      copiedId === worksheet.id ? 'copied' : ''
                    }`}
                    onClick={(e) => handleShareWorksheet(e, worksheet)}
                    title="Share activity link & image"
                    aria-label="Share activity"
                    data-umami-event="Share-Worksheet"
                    data-umami-event-worksheet={worksheet.id}
                  >
                    <span>{copiedId === worksheet.id ? '✓' : '🔗'}</span>
                    <span>{copiedId === worksheet.id ? 'Copied' : 'Share'}</span>
                  </button>
                </div>
              </div>
            </div>
          </article>
        ))}
          </div>
        </div>

        <iframe
          ref={printFrameRef}
          title="Worksheet Print Frame"
          className="worksheet-print-iframe"
          aria-hidden="true"
        />
      </section>
    </div>
  );
};
