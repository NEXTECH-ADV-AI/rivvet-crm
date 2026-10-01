import { useCrmHydrate } from "@/lib/crm/wire";
import { useCrmStore } from "@/lib/crm/store";

/** Loads the book into the client store. Says something only when the data is
 *  loading, failed, or is demo data; live data needs no banner (RIV-1534). */
export function CrmHydrateBanner() {
  const q = useCrmHydrate();
  const dataSource = useCrmStore((s) => s.dataSource);

  if (q.isLoading) {
    return (
      <div className="border-b border-border-soft bg-mist px-4 py-1.5 text-center text-xs text-fg-subtle">
        Loading CRM data…
      </div>
    );
  }
  if (q.isError) {
    return (
      <div role="alert" className="border-b border-red-300 bg-red-50 px-4 py-1.5 text-center text-xs text-red-800">
        Couldn't load CRM data. Refresh the page to try again.
      </div>
    );
  }
  if (q.data && dataSource !== "live") {
    return (
      <div className="border-b border-amber-300 bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-900">
        Demo data: this deploy has no database connection.
      </div>
    );
  }
  return null;
}
