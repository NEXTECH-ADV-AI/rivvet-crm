export function PageHeader({
  title,
  description,
  action,
  eyebrow,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="crm-label mb-1">{eyebrow}</p>}
        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-[1.35rem]">
          {title}
        </h1>
        {description && (
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-fg-muted">
            {description}
          </p>
        )}
      </div>
      {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
    </div>
  );
}
