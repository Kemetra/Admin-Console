/**
 * A form field's text. A missing or non-text entry (a File) reads as
 * `fallback`, never "[object File]"; an empty text entry stays "".
 */
export function textField(form: FormData, name: string, fallback = ""): string {
  const value = form.get(name);
  return typeof value === "string" ? value : fallback;
}
