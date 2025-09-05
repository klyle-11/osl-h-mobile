"use client";
import React from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: (note: string) => void;
  onDelete?: () => void;
  defaultNote?: string;
};

export default function AnnotationSheet({ open, onClose, onSave, onDelete, defaultNote }: Props) {
  const [note, setNote] = React.useState(defaultNote ?? "");
  React.useEffect(() => setNote(defaultNote ?? ""), [defaultNote]);

  return (
    <div className={`fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
      {/* backdrop */}
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      {/* sheet */}
      <div
        className={`absolute inset-x-0 bottom-0 bg-white dark:bg-neutral-900 rounded-t-2xl shadow-2xl p-4 border-t border-neutral-200 dark:border-neutral-800 transition-transform duration-300 ${open ? 'translate-y-0' : 'translate-y-full'}`}
      >
        <div className="mx-auto h-1 w-12 rounded-full bg-neutral-300 dark:bg-neutral-700 mb-3" />
        <div className="space-y-3">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full h-28 p-3 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 outline-none"
            placeholder="Add a note..."
          />
          <div className="flex items-center justify-between">
            {onDelete && (
              <button
                onClick={onDelete}
                className="text-red-600 text-sm font-medium px-3 py-2"
              >
                Delete
              </button>
            )}
            <div className="ml-auto flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => onSave(note)}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
