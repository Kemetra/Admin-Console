/**
 * Catalog shapes (RT-266 plan §3.2). A message is a whole sentence with named
 * `{param}` placeholders, or a plural map resolved by `Intl.PluralRules` on the
 * `count` param. Arabic supplies the categories its prose needs (all six where
 * a count can take any value); English needs `one` and `other`. `other` is
 * always required.
 */
export type PluralMessage = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

export type Message = string | PluralMessage;

export type Messages = Record<string, Message>;

/**
 * A second-locale module typed against its Arabic counterpart: every key must
 * be present, so a missing translation is a compile error, never a runtime
 * fallback to a raw key or to the other language.
 */
export type MessagesOf<T> = { [K in keyof T]: Message };
