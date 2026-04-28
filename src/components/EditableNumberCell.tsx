import { useEffect, useRef, useState } from "react";

interface Props {
  value: number;
  disabled?: boolean;
  onCommit: (n: number) => Promise<void> | void;
  decimals?: number;
  placeholder?: string;
}

/**
 * Spreadsheet-style editable numeric cell.
 * - Commits on blur / Enter if changed.
 * - Shows "dirty" highlight while editing and "saving" while persisting.
 */
export function EditableNumberCell({ value, disabled, onCommit, decimals = 0, placeholder = "—" }: Props) {
  const [draft, setDraft] = useState<string>(value ? String(value) : "");
  const [focused, setFocused] = useState(false);
  const [saving, setSaving] = useState(false);
  const lastCommitted = useRef<number>(value);

  useEffect(() => {
    if (!focused && !saving) {
      setDraft(value ? String(value) : "");
      lastCommitted.current = value;
    }
  }, [value, focused, saving]);

  const dirty = focused && draft !== (lastCommitted.current ? String(lastCommitted.current) : "");

  async function commit() {
    const raw = draft.trim().replace(",", ".");
    const n = raw === "" ? 0 : Number(raw);
    if (!Number.isFinite(n) || n < 0 || n >= 1_000_000) {
      // Reset to last committed
      setDraft(lastCommitted.current ? String(lastCommitted.current) : "");
      return;
    }
    if (n === lastCommitted.current) return;
    setSaving(true);
    try {
      await onCommit(n);
      lastCommitted.current = n;
    } finally {
      setSaving(false);
    }
  }

  const cls = ["edit", dirty ? "dirty" : "", saving ? "saving" : ""].filter(Boolean).join(" ");

  return (
    <td className={cls}>
      <input
        type="text"
        inputMode="decimal"
        value={focused ? draft : (value ? (decimals > 0 ? value.toFixed(decimals) : String(value)) : "")}
        placeholder={placeholder}
        disabled={disabled || saving}
        onFocus={(e) => {
          setFocused(true);
          setDraft(value ? String(value) : "");
          e.currentTarget.select();
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={async () => {
          await commit();
          setFocused(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.currentTarget as HTMLInputElement).blur();
          } else if (e.key === "Escape") {
            setDraft(lastCommitted.current ? String(lastCommitted.current) : "");
            (e.currentTarget as HTMLInputElement).blur();
          }
        }}
      />
    </td>
  );
}
