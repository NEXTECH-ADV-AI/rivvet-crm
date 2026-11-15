import { cn } from "@/components/ui/cn";

export function MetaPanel({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-2xl border border-border bg-card p-4",
        className,
      )}
    >
      <h2 className="mb-3 text-[15px] font-semibold text-ink">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function MetaRow({
  k,
  v,
  mono,
}: {
  k: string;
  v: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-wrap justify-between gap-2 border-b border-border-soft/70 py-2 text-sm last:border-0">
      <span className="shrink-0 text-fg-muted">{k}</span>
      <span
        className={cn(
          "min-w-0 max-w-full text-right text-ink [overflow-wrap:anywhere]",
          mono && "font-mono text-xs tabular",
        )}
      >
        {v}
      </span>
    </div>
  );
}

export function TagList({ tags }: { tags: string[] }) {
  if (!tags.length) return <span className="text-xs text-fg-subtle">—</span>;
  return (
    <div className="flex flex-wrap justify-end gap-1">
      {tags.map((t) => (
        <span
          key={t}
          className="rounded-full border border-border-soft bg-mist px-2 py-0.5 font-mono text-[12px] text-fg-muted"
        >
          {t}
        </span>
      ))}
    </div>
  );
}
