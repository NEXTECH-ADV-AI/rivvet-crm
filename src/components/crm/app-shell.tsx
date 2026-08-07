import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { Sidebar } from "./sidebar";
import { RivvetBrand, RivvetIcon, RivvetWordmark } from "./logo";
import { CommandSearch } from "./command-search";
import { AgentStrip } from "./agent-strip";
import { WireBanner } from "./wire-banner";
import { useWireStatus } from "@/lib/crm/wire";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { data: wire } = useWireStatus();
  const live = wire?.source === "live";

  return (
    <div className="flex min-h-[calc(100dvh-var(--grok-banner-h,0px))] bg-mist">
      <div className="hidden shrink-0 md:block">
        <div className="sticky top-[var(--grok-banner-h,0px)] h-[calc(100dvh-var(--grok-banner-h,0px))]">
          <Sidebar />
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-deep-ink/50"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 z-50 shadow-float">
            <Sidebar onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-[var(--grok-banner-h,0px)] z-20 border-b border-border-soft bg-card/95 backdrop-blur-md">
          <div className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-md p-2 text-ink hover:bg-mist md:hidden"
              aria-label="Open menu"
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>

            <Link
              to="/home"
              className="flex items-center gap-2 md:hidden"
              aria-label="Rivvet CRM home"
            >
              <RivvetIcon className="size-8" alt="" />
              <RivvetWordmark className="h-4 w-auto max-w-[120px]" />
            </Link>

            <Link
              to="/home"
              className="hidden items-center gap-3 md:flex"
              aria-label="Rivvet CRM home"
            >
              <RivvetBrand variant="light" />
              <span className="hidden h-5 w-px bg-border-soft lg:block" />
              <span className="hidden font-mono text-[10px] tracking-[0.14em] text-fg-subtle lg:inline">
                CRM
              </span>
            </Link>

            <div className="ml-auto flex items-center gap-2">
              <CommandSearch />
              <span
                className={`hidden rounded-full border px-2 py-0.5 font-mono text-[10px] lg:inline ${
                  live
                    ? "border-product-mint/40 bg-product-mint/10 text-product-mint"
                    : "border-border-soft bg-mist text-fg-subtle"
                }`}
              >
                {live ? "LIVE" : "MOCK"}
              </span>
            </div>
          </div>
          <WireBanner />
          <AgentStrip />
        </header>

        <main className="flex-1 px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
