export type Customer = {
  id: string;
  name: string;
  details: string;
};

const KEY = "invoice.customers.v1";

export function loadCustomers(): Customer[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Customer[]) : [];
  } catch {
    return [];
  }
}

export function saveCustomers(list: Customer[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(list));
}
