import { useEffect, useState } from "react";
import type { NextActionPatch } from "@/lib/crm/types";

export function NextActionEditor({
  nextAction,
  nextActionDue,
  onSave,
}: {
  nextAction: string | null;
  nextActionDue: string | null;
  onSave: (patch: NextActionPatch) => void;
}) {
  const [action, setAction] = useState(nextAction ?? "");
  const [due, setDue] = useState(nextActionDue ?? "");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setAction(nextAction ?? "");
    setDue(nextActionDue ?? "");
    setDirty(false);
  }, [nextAction, nextActionDue]);

  return (
    <div className="space-y-3">
      {!nextAction && (
        <p className="text-sm text-danger">
          Missing next step — sets P1 until filled.
        </p>
      )}
      <div>
        <label className="text-[10px] font-medium uppercase tracking-wider text-fg-subtle">
          Next action
        </label>
        <input
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setDirty(true);
          }}
          placeholder="e.g. Send revised proposal"
          className="mt-1 w-full rounded-md border border-border-soft bg-card px-3 py-2 text-sm text-ink placeholder:text-fg-subtle focus:border-signal-cyan focus:outline-none"
        />
      </div>
      <div>
        <label className="text-[10px] font-medium uppercase tracking-wider text-fg-subtle">
          Due (ISO date)
        </label>
        <input
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
        disabled={!dirty}
        onClick={() => {
          onSave({
            nextAction: action.trim() || null,
            nextActionDue: due || null,
          });
          setDirty(false);
        }}
        className="w-full rounded-md bg-ink px-3 py-2 text-xs font-semibold text-white enabled:hover:bg-deep-ink disabled:cursor-not-allowed disabled:opacity-40"
      >
        Save next step
      </button>
      <p className="text-[10px] text-fg-subtle">
        Local store only — mirrors `next_action` / `next_action_due` columns. Not
        written to production CRM.
      </p>
    </div>
  );
}
