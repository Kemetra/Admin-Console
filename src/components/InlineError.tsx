/**
 * Inline field error (T011, FR-003-007). Renders nothing when there is no
 * error, so callers can pass a possibly-undefined message unconditionally.
 */
import "./inline-error.css";

export interface InlineErrorProps {
  message?: string;
}

export function InlineError({ message }: Readonly<InlineErrorProps>): React.JSX.Element | null {
  if (!message) {
    return null;
  }
  return (
    <span className="rtc-inline-error" role="alert">
      {message}
    </span>
  );
}
