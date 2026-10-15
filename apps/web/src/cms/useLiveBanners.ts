import { useEffect, useState } from 'react';
import type { LiveContent, PublicBanner } from '@goalpath/shared';

/**
 * Where the content API lives. In development it defaults to the local API; in
 * production it must be set at build time (VITE_API_URL), and when it is not
 * set the app simply shows no CMS content.
 */
const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined) ?? (import.meta.env.DEV ? 'http://localhost:3002' : '');

/** How often to look for changes while the app stays open. */
const REFRESH_MS = 60_000;

/**
 * The banners that are live right now for this kind of person, from the admin.
 * Refreshes every minute and whenever the app comes back to the foreground.
 * Any failure leaves the list as it was: the app never breaks because of the CMS.
 */
export function useLiveBanners(role?: 'owner' | 'professional'): PublicBanner[] {
  const [banners, setBanners] = useState<PublicBanner[]>([]);

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
        if (!cancelled && Array.isArray(data.banners)) setBanners(data.banners);
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

  return banners;
}
