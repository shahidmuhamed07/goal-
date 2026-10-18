import { useEffect, useState } from 'react';
import type { LiveContent, PublicBanner, PublicPage, PublicPopup } from '@goalpath/shared';

/**
 * Where the content API lives. In development it defaults to the local API; in
 * production it must be set at build time (VITE_API_URL), and when it is not
 * set the app simply shows no CMS content.
 */
const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined) ?? (import.meta.env.DEV ? 'http://localhost:3002' : '');

/** How often to look for changes while the app stays open. */
const REFRESH_MS = 60_000;

export interface LiveCms {
  banners: PublicBanner[];
  popups: PublicPopup[];
  pages: PublicPage[];
}

const EMPTY: LiveCms = { banners: [], popups: [], pages: [] };

/**
 * Everything the admin has put live right now for this kind of person: banners,
 * popups and pages. Refreshes every minute and whenever the app comes back to
 * the foreground. Any failure leaves things as they were: the app never breaks
 * because of the CMS. An older API that does not send popups or pages gives none.
 */
export function useLiveContent(role?: 'owner' | 'professional'): LiveCms {
  const [content, setContent] = useState<LiveCms>(EMPTY);

  useEffect(() => {
    if (!API_URL) return;
    let cancelled = false;
    let controller: AbortController | undefined;

    const load = async () => {
      controller?.abort();
      controller = new AbortController();
      try {
        const res = await fetch(`${API_URL}/api/content/live${role ? `?role=${role}` : ''}`, { signal: controller.signal });
        if (!res.ok) return;
        const data = (await res.json()) as LiveContent;
        if (cancelled || !Array.isArray(data.banners)) return;
        setContent({
          banners: data.banners,
          popups: Array.isArray(data.popups) ? data.popups : [],
          pages: Array.isArray(data.pages) ? data.pages : [],
        });
      } catch {
        /* offline or the API is down: keep what we have */
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };

    void load();
    const timer = window.setInterval(load, REFRESH_MS);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      controller?.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [role]);

  return content;
}

/** Only the banners. The login screen has no use for the rest. */
export function useLiveBanners(role?: 'owner' | 'professional'): PublicBanner[] {
  return useLiveContent(role).banners;
}
