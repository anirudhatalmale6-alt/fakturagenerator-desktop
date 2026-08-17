// Jobs handed over from the Job Tracker app via the desktop bridge.
export type HandoffJob = {
  name: string;
  amount: number;
  currency: string;
  month: string;
  poNumber: string;
  invoiceNumber: string;
};

export type HandoffPayload = {
  version: number;
  sentAt: number;
  jobs: HandoffJob[];
};

interface JobHandoffBridge {
  available: boolean;
  take: () => Promise<HandoffPayload | null>;
  onHandoff: (cb: (payload: HandoffPayload) => void) => () => void;
}

declare global {
  interface Window {
    jobHandoff?: JobHandoffBridge;
  }
}

export function handoffAvailable(): boolean {
  return typeof window !== "undefined" && window.jobHandoff?.available === true;
}

// Collects a handoff that arrived before the page was ready (including one that
// launched the app). Returns null in a plain browser or when there is nothing.
export async function takePendingHandoff(): Promise<HandoffPayload | null> {
  if (!handoffAvailable()) return null;
  try {
    return await window.jobHandoff!.take();
  } catch {
    return null;
  }
}

export function subscribeToHandoff(cb: (payload: HandoffPayload) => void): () => void {
  if (!handoffAvailable()) return () => {};
  return window.jobHandoff!.onHandoff(cb);
}

// Currencies Job Tracker can send that this app also offers. Anything else is
// ignored so an unknown code cannot put the currency picker into a broken state.
const KNOWN_CURRENCIES = ["SEK", "EUR", "USD", "GBP", "NOK", "DKK"];

export function normaliseCurrency(currency: string, fallback: string): string {
  const c = (currency || "").toUpperCase();
  return KNOWN_CURRENCIES.includes(c) ? c : fallback;
}
