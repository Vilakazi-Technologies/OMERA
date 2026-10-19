"use client";

type Props = {
  title: string;
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DeleteChatDialog({ title, open, onCancel, onConfirm }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-chat-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label="Cancel delete"
        onClick={onCancel}
      />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-white/12 bg-[#0a0a0a] p-5 shadow-2xl">
        <h2
          id="delete-chat-title"
          className="font-serif text-lg font-medium text-white"
        >
          Delete this chat?
        </h2>
        <p className="mt-2 text-sm text-white/55">
          <span className="font-medium text-white/75">{title}</span> will be
          removed permanently. This cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl px-4 py-2 text-sm text-white/65 transition hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl bg-red-500/90 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-500"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
