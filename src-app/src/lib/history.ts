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

export function removeFromHistory(id: string) {
  const list = loadHistory().filter((i) => i.id !== id);
  saveHistory(list);
  return list;
}
