import { useEffect, useState } from "react";
import { useNextAction, useSetNextAction, type RecordRef } from "@/lib/crm/wire";

/** A record's next step, saved as one open task (RIV-1542). It also shows on Activities. */
export function NextActionEditor({ record }: { record: RecordRef }) {
  const q = useNextAction(record);
  const save = useSetNextAction();
  const current = q.data?.nextAction ?? null;
  const [action, setAction] = useState("");
  const [due, setDue] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setAction(current?.title ?? "");
    setDue(current?.dueDate ?? "");
    setDirty(false);
  }, [current?.title, current?.dueDate]);

  if (q.isLoading) return <p className="text-sm text-fg-muted">Loading the next step…</p>;
  if (q.isError) return <p className="text-sm text-danger">Couldn't load the next step. Refresh to try again.</p>;

  return (
    <div className="space-y-3">
      {!current && <p className="text-sm text-fg-muted">No next step set.</p>}
      <div>
        <label htmlFor="next-action" className="text-[10px] font-medium uppercase tracking-wider text-fg-subtle">
          Next step
        </label>
        <input
          id="next-action"
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setDirty(true);
          }}
          placeholder="e.g. Call back Tuesday morning"
          className="mt-1 w-full rounded-md border border-border-soft bg-card px-3 py-2 text-sm text-ink placeholder:text-fg-subtle focus:border-signal-cyan focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="next-action-due" className="text-[10px] font-medium uppercase tracking-wider text-fg-subtle">
          Due
        </label>
        <input
          id="next-action-due"
          type="date"
          value={due}
          onChange={(e) => {
            setDue(e.target.value);
            setDirty(true);
          }}
          className="mt-1 w-full rounded-md border border-border-soft bg-card px-3 py-2 font-mono text-sm text-ink focus:border-signal-cyan focus:outline-none"
        />
      </div>
      <button
        type="button"
        disabled={!dirty || save.isPending}
        onClick={() =>
          save.mutate(
            { ...record, title: action.trim() || null, dueDate: due || null },
            { onSuccess: () => setDirty(false) },
          )
        }
        className="w-full rounded-md bg-ink px-3 py-2 text-xs font-semibold text-white transition active:scale-[0.98] enabled:hover:bg-deep-ink disabled:cursor-not-allowed disabled:opacity-40"
      >
        {save.isPending ? "Saving…" : action.trim() || !current ? "Save next step" : "Clear next step"}
      </button>
      {save.isError && (
        <p role="alert" className="text-xs text-danger">
          Couldn't save. Try again.
        </p>
      )}
    </div>
  );
}
