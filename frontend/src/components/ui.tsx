import type { ReactNode } from "react";

// Small, dependency-free UI primitives shared across every screen. Kept in
// one file on purpose — there aren't enough of them yet to earn a folder.

export function Card({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`rounded-lg border border-[var(--border)] bg-[var(--surface)] ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="mb-1 font-mono text-xs uppercase tracking-widest text-[var(--text-muted)]">
            {eyebrow}
          </p>
        )}
        <h2 className="text-lg font-semibold text-[var(--text)]">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
}) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";
  const variants: Record<string, string> = {
    primary: "bg-[var(--accent)] text-white hover:opacity-90",
    secondary:
      "border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:border-[var(--accent)]",
    danger:
      "border border-[var(--hallucinated)] text-[var(--hallucinated)] hover:bg-[var(--hallucinated-soft)]",
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1 block font-mono text-xs uppercase tracking-wide text-[var(--text-muted)]">
      {children}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] ${props.className ?? ""}`}
    />
  );
}

export function Select({
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] ${props.className ?? ""}`}
    >
      {children}
    </select>
  );
}

export function Slider({
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix = "",
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[var(--border)] accent-[var(--accent)]"
      />
      <span className="w-14 shrink-0 text-right font-mono text-sm tabular-nums text-[var(--text)]">
        {value}
        {suffix}
      </span>
    </div>
  );
}

const VERDICT_COLOR: Record<string, string> = {
  GROUNDED: "var(--grounded)",
  grounded: "var(--grounded)",
  PARTIALLY_GROUNDED: "var(--partial)",
  partial: "var(--partial)",
  HALLUCINATED: "var(--hallucinated)",
  hallucinated: "var(--hallucinated)",
  UNGROUNDED: "var(--hallucinated)",
};

const VERDICT_SOFT: Record<string, string> = {
  GROUNDED: "var(--grounded-soft)",
  grounded: "var(--grounded-soft)",
  PARTIALLY_GROUNDED: "var(--partial-soft)",
  partial: "var(--partial-soft)",
  HALLUCINATED: "var(--hallucinated-soft)",
  hallucinated: "var(--hallucinated-soft)",
  UNGROUNDED: "var(--hallucinated-soft)",
};

export function verdictColor(label: string): string {
  return VERDICT_COLOR[label] ?? "var(--text-muted)";
}

export function VerdictBadge({ label }: { label: string }) {
  const color = verdictColor(label);
  const soft = VERDICT_SOFT[label] ?? "var(--border)";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-xs font-medium"
      style={{ color, background: soft }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {label.replace(/_/g, " ").toLowerCase()}
    </span>
  );
}

/**
 * The score track — the app's signature element. A 0..1 hallucination score
 * rendered against the actual grounded/partial zone boundaries, so the bar
 * reads as a calibrated instrument rather than a generic progress meter.
 */
export function ScoreTrack({
  score,
  groundedCeiling = 0.3,
  partialCeiling = 0.6,
}: {
  score: number;
  groundedCeiling?: number;
  partialCeiling?: number;
}) {
  const pct = Math.max(0, Math.min(1, score)) * 100;
  return (
    <div className="w-full">
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-[var(--border)]">
        <div
          className="absolute inset-y-0 left-0"
          style={{ width: `${groundedCeiling * 100}%`, background: "var(--grounded)", opacity: 0.35 }}
        />
        <div
          className="absolute inset-y-0"
          style={{
            left: `${groundedCeiling * 100}%`,
            width: `${(partialCeiling - groundedCeiling) * 100}%`,
            background: "var(--partial)",
            opacity: 0.35,
          }}
        />
        <div
          className="absolute inset-y-0"
          style={{
            left: `${partialCeiling * 100}%`,
            width: `${(1 - partialCeiling) * 100}%`,
            background: "var(--hallucinated)",
            opacity: 0.35,
          }}
        />
        <div
          className="absolute top-0 h-full w-0.5 -translate-x-1/2 bg-[var(--text)]"
          style={{ left: `${pct}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-[var(--text-muted)]">
        <span>0.0</span>
        <span className="tabular-nums">{score.toFixed(3)}</span>
        <span>1.0</span>
      </div>
    </div>
  );
}

export function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--border)]">
      <div
        className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-widest text-[var(--text-muted)]">
        {label}
      </p>
      <p className="mt-1 font-mono text-2xl font-semibold text-[var(--text)]">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-[var(--text-muted)]">{sub}</p>}
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--border)] px-6 py-10 text-center">
      <p className="text-sm font-medium text-[var(--text)]">{title}</p>
      <p className="mt-1 text-sm text-[var(--text-muted)]">{body}</p>
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      className="rounded-md border px-3 py-2 text-sm"
      style={{ borderColor: "var(--hallucinated)", color: "var(--hallucinated)", background: "var(--hallucinated-soft)" }}
    >
      {message}
    </div>
  );
}
