import "./back-arrow.css";

/**
 * The "back" arrow of a back link (RT-399). It points back along the reading
 * direction (UX-03 "RTL follows meaning"): ← in English, mirrored in Arabic,
 * where back is to the right. U+2190 is not Bidi_Mirrored, so CSS mirrors it.
 * Decorative: the link's label is its accessible name.
 */
export function BackArrow(): React.JSX.Element {
  return (
    <span className="back-arrow" aria-hidden="true">
      ←
    </span>
  );
}
