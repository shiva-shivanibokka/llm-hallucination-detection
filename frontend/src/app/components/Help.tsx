"use client";

// Small "?" affordance that reveals an explanatory tooltip on hover/focus.
// Styling lives in globals.css (.tip / .q / .pop).
export default function Help({ text }: { text: string }) {
  return (
    <span className="tip">
      <span className="q" tabIndex={0} role="button" aria-label={text}>
        ?
      </span>
      <span className="pop" role="tooltip">
        {text}
      </span>
    </span>
  );
}
