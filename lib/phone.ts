/** Нормалізує телефон до цифр без + і пробілів */
export function digitsOnlyPhone(value: string | null | undefined): string {
  return (value || "").replace(/\D/g, "");
}

export function isPhoneRouteParam(value: string): boolean {
  return /^\d{10,15}$/.test(value);
}
