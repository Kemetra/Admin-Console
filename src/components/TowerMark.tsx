/**
 * Retail Tower OS shield mark. Stroke-only, currentColor (DESIGN.md icon
 * contract); the lockup colours it Tower Teal.
 */
export function TowerMark({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="Retail Tower OS"
    >
      <path d="M12 3 4 6v6c0 4.5 3.2 7.4 8 9 4.8-1.6 8-4.5 8-9V6l-8-3Z" />
      <path d="M12 7.5v9" />
      <path d="M8.5 12h7" />
    </svg>
  );
}
