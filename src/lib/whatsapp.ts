/** Iraqi local mobile number (07xxxxxxxxx) → international digits for wa.me (9647xxxxxxxxx). */
export function toInternationalDigits(phone: string, countryCode = "964"): string {
  const digits = phone.replace(/[^\d]/g, "");
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith(countryCode)) return digits;
  if (digits.startsWith("0")) return countryCode + digits.slice(1);
  return digits;
}

export function whatsappUrl(waNumber: string, text?: string): string {
  const base = `https://wa.me/${waNumber}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export const generalInquiryMessage = "السلام عليكم، أود الاستفسار عن منتجات المجمع.";
export const bookingIntroMessage = "السلام عليكم، أود حجز قطعة من المجمع.";
export const deliveryInquiryMessage = "السلام عليكم، أود الاستفسار عن طلب منتجات وتوصيلها إلى محافظتي.";

export function productInquiryMessage(productName: string): string {
  return `السلام عليكم، أود الاستفسار/حجز المنتج: ${productName}`;
}

/**
 * Admin → customer: opens WhatsApp with a prepared message. It is only a link – nothing is sent until the
 * staff member presses «Send» inside WhatsApp themselves.
 */
export function customerWhatsappUrl(customerPhone: string, customerName: string, reservationNumber: string, productName: string): string {
  const text = `مرحباً ${customerName}، معك مجمع أميرة باشا بخصوص حجزك رقم ${reservationNumber} للمنتج: ${productName}.`;
  return whatsappUrl(toInternationalDigits(customerPhone), text);
}
