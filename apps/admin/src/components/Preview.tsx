import type { ReactNode } from 'react';
import type { Banner, Page, Popup, Tone } from '@goalpath/shared';

/** A small phone that mimics the app, so edits are checked before they go live. */
function Phone({ children, overlay }: { children: ReactNode; overlay?: ReactNode }) {
  return (
    <div className="preview-col">
      <span className="label">Preview in the app</span>
      <div className="phone">
        <div className="phone-screen">
          {children}
          {overlay}
        </div>
      </div>
      <span className="small faint" style={{ textAlign: 'center' }}>Sample screen, not live data</span>
    </div>
  );
}

const Skeleton = ({ lines = 2 }: { lines?: number }) => (
  <div className="fake-card">
    {Array.from({ length: lines }, (_, i) => (
      <div key={i} className="fake-line" style={{ width: `${88 - i * 22}%` }} />
    ))}
  </div>
);

function Header() {
  return (
    <div className="phone-bar">
      <span>Goal Path</span>
      <span>●</span>
    </div>
  );
}

function BannerCard({ banner, strip }: { banner: Pick<Banner, 'title' | 'body' | 'imageUrl' | 'ctaLabel' | 'tone'>; strip?: boolean }) {
  const tone: Tone = banner.tone;
  if (strip) {
    return <div className={`p-strip p-banner ${tone}`}>{banner.title || 'Your announcement'}</div>;
  }
  return (
    <div className={`p-banner ${tone}`}>
      {banner.imageUrl && <img src={banner.imageUrl} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
      <b>{banner.title || 'Your headline'}</b>
      {banner.body && <span>{banner.body}</span>}
      {banner.ctaLabel && <span className="p-cta">{banner.ctaLabel}</span>}
    </div>
  );
}

export function BannerPreview({ banner }: { banner: Banner }) {
  const strip = banner.placement === 'announcement-bar';
  return (
    <Phone>
      {banner.placement === 'login-notice' ? (
        <>
          <div style={{ height: 40 }} />
          <div className="fake-card" style={{ textAlign: 'center' }}><b>Goal Path</b><div className="fake-line" /></div>
          <BannerCard banner={banner} />
        </>
      ) : (
        <>
          <Header />
          {strip && <BannerCard banner={banner} strip />}
          {banner.placement === 'goals-banner' && (
            <>
              <Skeleton />
              <BannerCard banner={banner} />
              <Skeleton lines={3} />
            </>
          )}
          {banner.placement === 'today-card' && (
            <>
              <div className="fake-line" style={{ width: '60%', height: 14 }} />
              <BannerCard banner={banner} />
              <Skeleton lines={3} />
            </>
          )}
          {strip && (
            <>
              <Skeleton />
              <Skeleton lines={3} />
            </>
          )}
        </>
      )}
    </Phone>
  );
}

export function PopupPreview({ popup }: { popup: Popup }) {
  return (
    <Phone
      overlay={
        <div className="p-scrim">
          <div className="p-sheet">
            <div className={`p-banner ${popup.tone}`} style={{ padding: 0, background: 'none' }}>
              {popup.imageUrl && <img src={popup.imageUrl} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
              <b>{popup.title || 'Your headline'}</b>
              <span>{popup.body || 'A sentence or two about it.'}</span>
            </div>
            {popup.ctaLabel && <span className="p-cta">{popup.ctaLabel}</span>}
            <span className="small" style={{ color: '#6c6a85' }}>Not now</span>
          </div>
        </div>
      }
    >
      <Header />
      <Skeleton />
      <Skeleton lines={3} />
    </Phone>
  );
}

export function PagePreview({ page }: { page: Pick<Page, 'title' | 'blocks'> }) {
  return (
    <Phone>
      <Header />
      <div className="p-page">
        <h4>{page.title || 'Page title'}</h4>
        {page.blocks.length === 0 && <p>Add a block to start.</p>}
        {page.blocks.map((b) => {
          switch (b.type) {
            case 'heading':
              return <h4 key={b.id} style={{ fontSize: 15 }}>{b.text || 'Heading'}</h4>;
            case 'text':
              return <p key={b.id}>{b.text || 'Some text.'}</p>;
            case 'image':
              return b.url ? <img key={b.id} src={b.url} alt={b.alt} onError={(e) => { e.currentTarget.style.display = 'none'; }} /> : <div key={b.id} className="fake-line" style={{ height: 70 }} />;
            case 'button':
              return <span key={b.id} className="p-cta">{b.label || 'Button'}</span>;
            case 'divider':
              return <hr key={b.id} />;
          }
        })}
      </div>
    </Phone>
  );
}
