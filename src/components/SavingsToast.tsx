// src/components/SavingsToast.tsx
"use client";

export default function SavingsToast({
  open,
  minutes,
  amountSEK,
  onClose,
}: {
  open: boolean;
  minutes: number;
  amountSEK: number;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-4 z-[999] flex justify-center px-4"
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-teal-200/60 bg-white shadow-lg">
        <div className="h-1 w-full bg-gradient-to-r from-teal-500 to-blue-500 rounded-t-2xl" />
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 h-2.5 w-2.5 rounded-full bg-teal-500" />
            <div className="flex-1">
              <p className="font-semibold text-gray-900">Du sparade nyss tid och pengar</p>
              <p className="text-sm text-gray-700 mt-1">
                ≈ <span className="font-medium">{minutes} min</span> &nbsp;·&nbsp;
                <span className="font-medium">
                  {new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK", maximumFractionDigits: 0 }).format(amountSEK)}
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
              aria-label="Stäng"
            >
              Stäng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
