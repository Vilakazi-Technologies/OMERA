"use client";

import { useState } from "react";
import { extractPersonFromCsv, type PersonFromCsv } from "@/lib/csv/person-from-csv";

type Props = {
  person: PersonFromCsv | null;
  onPerson: (person: PersonFromCsv | null) => void;
};

export function PersonCsvPanel({ person, onPerson }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  function apply(text: string) {
    try {
      onPerson(extractPersonFromCsv(text));
      setError(null);
      setDraft("");
      setOpen(false);
    } catch {
      setError("No person found. Include a header row and at least a name, ID number, phone, or email.");
    }
  }

  return (
    <section aria-label="Person from CSV" className="mt-4 w-full text-left">
      {person ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-slate-500">Person from CSV</p>
          <p className="mt-1 text-sm text-slate-200">{person.note}</p>
          <ul className="mt-2 space-y-1">
            {person.display.map((row) => (
              <li key={`${row.label}-${row.value}`} className="text-sm">
                <span className="text-slate-500">{row.label}: </span>
                <span className="text-white">{row.value}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => setOpen((value) => !value)} className="rounded-full border border-white/20 px-4 py-1.5 text-sm text-white hover:bg-white/10">Replace person CSV</button>
            <button type="button" onClick={() => { onPerson(null); setOpen(false); setError(null); }} className="rounded-full border border-white/20 px-4 py-1.5 text-sm text-white hover:bg-white/10">Remove person</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen((value) => !value)} className="rounded-full border border-white/20 px-4 py-1.5 text-sm text-white hover:bg-white/10">Add a person from CSV</button>
      )}
      {open ? (
        <div className="mt-3 rounded-2xl border border-dashed border-white/15 px-4 py-3">
          <label className="block text-xs text-slate-400">
            Upload CSV
            <input type="file" accept=".csv,text/csv" className="mt-1 block w-full text-sm text-slate-300" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; void file.text().then(apply); }} />
          </label>
          <label className="mt-3 block text-xs text-slate-400">
            Paste person CSV
            <textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={4} placeholder="Full name,ID number,Phone,Email" className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none" />
          </label>
          <button type="button" onClick={() => apply(draft)} className="mt-3 rounded-full bg-white px-4 py-1.5 text-sm font-medium text-black hover:bg-white/90">Use this person</button>
          {error ? <p role="alert" className="mt-2 text-sm text-red-300">{error}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
