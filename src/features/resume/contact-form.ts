export interface ContactForm {
  displayName?: string;
  headline?: string;
  email?: string;
  phone?: string;
  website?: string;
  linkedin?: string;
  github?: string;
  location?: string;
}

type Nullable = { [K in keyof ContactForm]?: string | null };

/** Profile row → dialog values (strings, never null, so inputs are controlled). */
export function profileToContact(p: Nullable | null): ContactForm {
  return {
    displayName: p?.displayName ?? "",
    headline: p?.headline ?? "",
    email: p?.email ?? "",
    phone: p?.phone ?? "",
    website: p?.website ?? "",
    linkedin: p?.linkedin ?? "",
    github: p?.github ?? "",
    location: p?.location ?? "",
  };
}
