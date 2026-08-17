import type { InvoiceData } from "./invoice-pdf";

export type SavedInvoice = {
  id: string;
  number: string;
  billTo: string;
  date: string;
  total: number;
  currency: string;
  createdAt: number;
  data: InvoiceData;
};

const KEY = "invoice.history.v1";

export function loadHistory(): SavedInvoice[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SavedInvoice[]) : [];
  } catch {
    return [];
  }
}

export function saveHistory(list: SavedInvoice[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function addToHistory(item: SavedInvoice) {
  const list = [item, ...loadHistory()].slice(0, 50);
  saveHistory(list);
  return list;
}

// Save the invoice the user is working on. If it is one they already saved (or
// opened from the list), overwrite that entry instead of piling up a new copy
// every time they press save or download.
export function upsertHistory(item: SavedInvoice) {
  const existing = loadHistory();
  const without = existing.filter((i) => i.id !== item.id);
  const list = [item, ...without].slice(0, 50);
  saveHistory(list);
  return list;
}

export function removeFromHistory(id: string) {
  const list = loadHistory().filter((i) => i.id !== id);
  saveHistory(list);
  return list;
}
