import { Icon } from "@/components/icons/Icon";

/**
 * The "back" arrow of a back link (RT-399). It points back along the reading
 * direction (UX-03 "RTL follows meaning"): left in English, mirrored in
 * Arabic, where back is to the right. The registry's `back` entry owns that
 * mirror (RT-696, RT-263 D-263-4). Decorative: the link's label is its
 * accessible name.
 */
export function BackArrow(): React.JSX.Element {
  return <Icon name="back" size="sm" className="back-arrow" />;
}
