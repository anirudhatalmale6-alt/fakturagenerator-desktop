// "My own details" - the sender side of the invoice (the Från / From field).
// Mirrors customers.ts so the user can store their own company details once and
// reuse them on every invoice instead of retyping them.
export type Sender = {
  id: string;
  name: string;
  details: string;
  // Bankgiro / IBAN / Swish etc. Optional because profiles saved before this
  // field existed have no payment details stored.
  paymentInfo?: string;
};

const KEY = "invoice.senders.v1";

export function loadSenders(): Sender[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Sender[]) : [];
  } catch {
    return [];
  }
}

export function saveSenders(list: Sender[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(list));
}
