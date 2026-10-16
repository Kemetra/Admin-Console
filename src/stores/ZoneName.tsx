import { useLocale } from "@/i18n";
import { zoneCity } from "@/lib/timezones";

/**
 * A store's time zone as «القاهرة (Africa/Cairo)»: the city, then the IANA
 * identity isolated left-to-right. A zone with no curated city is its identity
 * alone, and no fixed UTC offset is ever shown (RT-477).
 */
export function ZoneName({ zone }: Readonly<{ zone?: string }>): React.JSX.Element {
  const locale = useLocale();
  if (!zone) return <span>—</span>;
  const city = zoneCity(zone, locale);
  const identity = <bdi dir="ltr">{zone}</bdi>;
  return city ? (
    <>
      <span>{city}</span> ({identity})
    </>
  ) : (
    identity
  );
}
