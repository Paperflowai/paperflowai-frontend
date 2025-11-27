import Link from "next/link";
import { PropsWithChildren } from "react";

type Tone = "gray" | "blue" | "green" | "yellow" | "red";

const toneClasses: Record<Tone, string> = {
  gray:   "bg-gray-100 text-gray-700",
  blue:   "bg-blue-100 text-blue-700",
  green:  "bg-green-100 text-green-700",
  yellow: "bg-yellow-100 text-yellow-800",
  red:    "bg-red-100 text-red-700",
};

export default function DocsCard(
  {
    title,
    badge,
    cta,
    secondary = [],
    children,
  }: PropsWithChildren<{
    title: string;
    badge?: { label: string; tone: Tone };
    cta?: { label: string; href?: string; onClick?: () => void };
    secondary?: Array<{ label: string; href?: string; onClick?: () => void }>;
  }>
) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">{title}</h3>
        {badge && (
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${toneClasses[badge.tone]}`}>
            {badge.label}
          </span>
        )}
      </div>

      {/* Primär CTA */}
      {cta && (
        cta.href ? (
          <Link
            href={cta.href}
            className="inline-flex items-center justify-center h-11 px-4 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition w-full sm:w-auto"
          >
            {cta.label}
          </Link>
        ) : (
          <button
            onClick={cta.onClick}
            className="inline-flex items-center justify-center h-11 px-4 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition w-full sm:w-auto"
          >
            {cta.label}
          </button>
        )
      )}

      {/* Innehåll (din befintliga text/länkar/uploader) */}
      <div className="text-sm text-gray-700">
        {children}
      </div>

      {/* Sekundära actions */}
      {secondary.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2">
          {secondary.map((s, i) =>
            s.href ? (
              <Link
                key={i}
                href={s.href}
                className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50"
              >
                {s.label}
              </Link>
            ) : (
              <button
                key={i}
                onClick={s.onClick}
                className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50"
              >
                {s.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
