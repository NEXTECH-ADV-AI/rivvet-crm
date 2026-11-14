import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { Sidebar } from "./sidebar";
import { RivvetBrand, RivvetIcon, RivvetWordmark } from "./logo";
import { CommandSearch } from "./command-search";
import { CrmHydrateBanner } from "./crm-hydrate";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <div className="flex min-h-[calc(100dvh-var(--grok-banner-h,0px))] bg-mist">
        <a
          href="#crm-main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-ink focus:p-3 focus:text-white"
        >
          Skip to main content
        </a>
        <div className="hidden shrink-0 md:block">
          <div className="sticky top-[var(--grok-banner-h,0px)] h-[calc(100dvh-var(--grok-banner-h,0px))]">
            <Sidebar />
          </div>
        </div>

        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-deep-ink/50 md:hidden" />
          <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex h-dvh w-[min(20rem,calc(100vw-2rem))] flex-col bg-sidebar shadow-float md:hidden">
            <div className="flex shrink-0 items-center justify-between px-3 pt-[env(safe-area-inset-top)] text-sidebar-fg">
              <Dialog.Title className="text-sm font-semibold">Navigation</Dialog.Title>
              <Dialog.Close
                className="flex size-11 items-center justify-center rounded-md hover:bg-sidebar-hover"
                aria-label="Close menu"
              >
                <X className="size-5" aria-hidden />
              </Dialog.Close>
            </div>
            <Dialog.Description className="sr-only">
              Rivvet CRM pages and settings
            </Dialog.Description>
            <div className="min-h-0 flex-1">
              <Sidebar onNavigate={() => setOpen(false)} />
            </div>
          </Dialog.Content>
        </Dialog.Portal>

        <div className="flex min-w-0 flex-1 flex-col">
          <CrmHydrateBanner />
          <header className="sticky top-[var(--grok-banner-h,0px)] z-20 border-b border-border-soft bg-card/95 backdrop-blur-md">
            <div className="flex items-center gap-2 px-4 py-2.5 sm:gap-3 sm:px-5">
              <Dialog.Trigger asChild>
                <button
                  type="button"
                  className="flex size-11 shrink-0 items-center justify-center rounded-md text-ink hover:bg-mist md:hidden"
                  aria-label="Open menu"
                >
                  <Menu className="size-5" aria-hidden />
                </button>
              </Dialog.Trigger>

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
              </div>
            </div>
          </header>

          <main
            id="crm-main"
            tabIndex={-1}
            className="min-w-0 flex-1 scroll-mt-24 px-4 py-4 sm:px-6 sm:py-5 lg:px-8"
          >
            {children}
          </main>
        </div>
      </div>
    </Dialog.Root>
  );
}
