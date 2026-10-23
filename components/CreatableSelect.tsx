"use client";
import { useId, useState } from "react";

const NEW = "__new__";

type Props = {
  label: string;
  items: readonly { id: string; name: string }[];
  value: string;
  onChange: (id: string) => void;
  /** يُنشئ العنصر الجديد ويعيد معرّفه. */
  onCreate: (name: string) => Promise<string>;
  placeholder: string;
  newLabel: string;
  newPlaceholder: string;
  required?: boolean;
  disabled?: boolean;
};

/** قائمة منسدلة مع خيار «إضافة جديد…» في آخرها. */
export default function CreatableSelect(p: Props) {
  const uid = useId();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function onSelect(v: string) {
    setError("");
    if (v === NEW) {
      setAdding(true);
      return;
    }
    setAdding(false);
    p.onChange(v);
  }

  async function add() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const id = await p.onCreate(name);
      p.onChange(id);
      setAdding(false);
      setName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّرت الإضافة.");
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    setAdding(false);
    setName("");
    setError("");
  }

  return (
    <div className="field">
      <label htmlFor={`${uid}-sel`}>{p.label}</label>
      <select
        id={`${uid}-sel`}
        value={adding ? NEW : p.value}
        onChange={(e) => onSelect(e.target.value)}
        required={p.required && !adding}
        disabled={p.disabled}
      >
        <option value="">{p.placeholder}</option>
        {p.items.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name}
          </option>
        ))}
        <option value={NEW}>＋ {p.newLabel}</option>
      </select>

      {adding && (
        <div className="addrow">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void add();
              } else if (e.key === "Escape") cancel();
            }}
            placeholder={p.newPlaceholder}
            aria-label={p.newPlaceholder}
            maxLength={80}
            autoFocus
          />
          <button type="button" className="btn btn--sm" onClick={() => void add()} disabled={busy || !name.trim()}>
            {busy ? "..." : "إضافة"}
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={cancel}>
            إلغاء
          </button>
        </div>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
