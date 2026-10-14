"use client";

import { openAssistant } from "./assistant/AssistantWidget";

/** Thumb-reach actions on phones. WhatsApp appears only when the client's number is configured. */
export function MobileActionBar({
  locale,
  labels,
  whatsapp,
}: {
  locale: string;
  labels: { places: string; fares: string; ask: string; whatsapp: string };
  whatsapp: string | null;
}) {
  const item = "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold";
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-basalt-900/10 bg-sand-50/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
      <div className="flex pr-20">
        <a href={`/${locale}#destinations`} className={`${item} text-basalt-800`}>
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z" /><circle cx="12" cy="9" r="2.5" /></svg>
          {labels.places}
        </a>
        <a href={`/${locale}#fares`} className={`${item} text-basalt-800`}>
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6" /></svg>
          {labels.fares}
        </a>
        {whatsapp ? (
          <a href={whatsapp} rel="noopener" className={`${item} text-peacock-700`}>
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z" /></svg>
            {labels.whatsapp}
          </a>
        ) : (
          <button type="button" onClick={() => openAssistant()} className={`${item} text-kumkum-700`}>
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 5h16v11H8l-4 4z" /></svg>
            {labels.ask}
          </button>
        )}
      </div>
    </nav>
  );
}
