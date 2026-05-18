// Hanya domain email berikut yang diperbolehkan untuk registrasi
export const ALLOWED_EMAIL_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "yahoo.co.id",
  "hotmail.com",
  "outlook.com",
  "outlook.co.id",
  "live.com",
];

export const isAllowedEmailDomain = (email: string): boolean => {
  const lowerEmail = email.trim().toLowerCase();
  const domain = lowerEmail.split("@")[1];
  if (!domain) return false;
  return ALLOWED_EMAIL_DOMAINS.includes(domain);
};

export const ALLOWED_EMAIL_DOMAINS_LABEL = "Gmail, Yahoo, Hotmail, Outlook";
