/**
 * Initials avatar (Console v4.0). A decorative identity disc derived from a
 * display name (or email local-part as a fallback). Purely visual — `aria-hidden`
 * so it never competes with the adjacent name/email text for the accessible name
 * (member-list rows are located by name text in the test contract).
 *
 * Teal-wash ground, teal initials, circular (RT-396).
 */

export interface AvatarProps {
  /** Display name; falls back to deriving initials from an email-like string. */
  name: string;
  /** Diameter in px. */
  size?: number;
}

/** Up to two initials from the leading word(s) of a name or email local-part. */
function initialsOf(name: string): string {
  const base = name.includes("@") ? (name.split("@")[0] ?? name) : name;
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  return (
    parts
      .slice(0, 2)
      .map((p) => p[0] ?? "")
      .join("")
      .toUpperCase() || "?"
  );
}

export function Avatar({ name, size = 32 }: AvatarProps): React.JSX.Element {
  return (
    <span
      className="avatar"
      aria-hidden="true"
      // Initials never drop below the 12px readability floor (UX-03).
      style={{ width: size, height: size, fontSize: Math.max(12, Math.round(size * 0.4)) }}
    >
      {initialsOf(name)}
    </span>
  );
}
