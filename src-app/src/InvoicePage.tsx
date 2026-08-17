import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { dict, type Lang } from "@/lib/i18n";
import {
  generatePdf,
  money,
  totals,
  type InvoiceData,
  type Line,
} from "@/lib/invoice-pdf";
import { loadCustomers, saveCustomers, type Customer } from "@/lib/customers";
import { loadSenders, saveSenders, type Sender } from "@/lib/senders";
import {
  loadHistory,
  removeFromHistory,
  upsertHistory,
  type SavedInvoice,
} from "@/lib/history";

const uid = () => Math.random().toString(36).slice(2, 10);

const CURRENCIES = ["SEK", "EUR", "USD", "GBP", "NOK", "DKK"];

export function InvoicePage() {
  const [lang, setLang] = useState<Lang>("sv");
  const t = dict[lang];
  const fileRef = useRef<HTMLInputElement>(null);

  const [data, setData] = useState<InvoiceData>({
    logo: null,
    from: "",
    billTo: "",
    shipTo: "",
    number: "1",
    date: new Date().toISOString().slice(0, 10),
    paymentTerms: "",
    dueDate: "",
    poNumber: "",
    yourRef: "",
    paymentInfo: "",
    items: [{ id: uid(), description: "", quantity: 1, rate: 0 }],
    notes: "",
    terms: "",
    taxPercent: 25,
    discount: 0,
    shipping: 0,
    amountPaid: 0,
    currency: "SEK",
  });

  const [customers, setCustomers] = useState<Customer[]>([]);
  useEffect(() => setCustomers(loadCustomers()), []);

  const [senders, setSenders] = useState<Sender[]>([]);
  useEffect(() => {
    const list = loadSenders();
    setSenders(list);
    // Pre-fill the From field with the most recently saved details so the user
    // does not retype their own company on every new invoice.
    const first = list[0];
    if (first) setData((d) => (d.from ? d : { ...d, from: first.details }));
  }, []);

  const [history, setHistory] = useState<SavedInvoice[]>([]);
  useEffect(() => setHistory(loadHistory()), []);

  // Id of the saved invoice currently open, so saving again updates that entry
  // instead of creating a duplicate. null = this invoice has never been saved.
  const [currentId, setCurrentId] = useState<string | null>(null);

  const set = <K extends keyof InvoiceData>(k: K, v: InvoiceData[K]) =>
    setData((d) => ({ ...d, [k]: v }));

  const setItem = (id: string, patch: Partial<Line>) =>
    setData((d) => ({
      ...d,
      items: d.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    }));

  const sums = useMemo(() => totals(data), [data]);

  const onLogo = (f: File | undefined) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => set("logo", String(r.result));
    r.readAsDataURL(f);
  };

  const saveCustomer = () => {
    const details = data.billTo.trim();
    if (!details) {
      toast.error(t.emptyCustomer);
      return;
    }
    const name = (details.split("\n")[0] ?? details).slice(0, 60);
    const next = [{ id: uid(), name, details }, ...customers.filter((c) => c.details !== details)];
    setCustomers(next);
    saveCustomers(next);
    toast.success(t.saved);
  };

  const removeCustomer = (id: string) => {
    const next = customers.filter((c) => c.id !== id);
    setCustomers(next);
    saveCustomers(next);
    toast.success(t.deleted);
  };

  const saveSender = () => {
    const details = data.from.trim();
    if (!details) {
      toast.error(t.emptySender);
      return;
    }
    const name = (details.split("\n")[0] ?? details).slice(0, 60);
    const next = [{ id: uid(), name, details }, ...senders.filter((s) => s.details !== details)];
    setSenders(next);
    saveSenders(next);
    toast.success(t.senderSaved);
  };

  const removeSender = (id: string) => {
    const next = senders.filter((s) => s.id !== id);
    setSenders(next);
    saveSenders(next);
    toast.success(t.senderDeleted);
  };

  // Store the invoice as it currently stands. Used both by the Save button and
  // by Download, so a downloaded invoice is always saved too.
  const persistInvoice = () => {
    const sums = totals(data);
    const isUpdate = currentId !== null;
    const id = currentId ?? uid();
    const next = upsertHistory({
      id,
      number: data.number,
      billTo: data.billTo,
      date: data.date,
      total: sums.total,
      currency: data.currency,
      createdAt: Date.now(),
      data,
    });
    setHistory(next);
    setCurrentId(id);
    return isUpdate;
  };

  const saveInvoice = () => {
    const isUpdate = persistInvoice();
    toast.success(isUpdate ? t.invoiceUpdated : t.savedHistory);
  };

  const download = () => {
    generatePdf(data, t);
    persistInvoice();
    toast.success(t.savedHistory);
  };

  const openInvoice = (h: SavedInvoice) => {
    setData(h.data);
    setCurrentId(h.id);
    toast.success(t.invoiceOpened);
  };

  const deleteInvoice = (id: string) => {
    setHistory(removeFromHistory(id));
    // The open invoice was just deleted, so saving again must create a new entry
    // rather than silently resurrecting the deleted one.
    if (currentId === id) setCurrentId(null);
  };

  const newInvoice = () => {
    setData({
      logo: null,
      from: senders[0]?.details ?? "",
      billTo: "",
      shipTo: "",
      number: "",
      date: new Date().toISOString().slice(0, 10),
      paymentTerms: "",
      dueDate: "",
      poNumber: "",
      yourRef: "",
      paymentInfo: "",
      items: [{ id: uid(), description: "", quantity: 1, rate: 0 }],
      notes: "",
      terms: "",
      taxPercent: 25,
      discount: 0,
      shipping: 0,
      amountPaid: 0,
      currency: data.currency,
    });
    setCurrentId(null);
    toast.success(t.newInvoiceDone);
  };

  return (
    <main className="min-h-screen bg-muted/40 py-8 px-4">
      <Toaster />
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{t.appName}</h1>
            <p className="text-sm font-medium text-foreground/80">{t.tagline}</p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-foreground">{t.language}</span>
            <div className="inline-flex overflow-hidden rounded-md border border-border">
              {(["sv", "en"] as Lang[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`px-3 py-1.5 text-sm transition-colors ${
                    lang === l
                      ? "bg-primary text-primary-foreground"
                      : "bg-background hover:bg-accent"
                  }`}
                >
                  {l === "sv" ? "Svenska" : "English"}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          {/* Invoice sheet */}
          <section className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                {data.logo ? (
                  <div className="space-y-2">
                    <img src={data.logo} alt={t.logo} className="h-20 w-auto object-contain" />
                    <button
                      className="text-xs font-medium text-foreground underline"
                      onClick={() => set("logo", null)}
                    >
                      {t.removeLogo}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="flex h-20 w-40 items-center justify-center rounded-lg border border-dashed border-border text-sm font-medium text-foreground hover:bg-accent"
                  >
                    {t.uploadLogo}
                  </button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onLogo(e.target.files?.[0])}
                />
              </div>
              <h2 className="text-4xl font-light tracking-widest text-foreground">
                {t.invoice}
              </h2>
            </div>

            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              <div className="space-y-4">
                <Field label={t.from}>
                  <textarea
                    className={taCls}
                    rows={3}
                    placeholder={t.fromPh}
                    value={data.from}
                    onChange={(e) => set("from", e.target.value)}
                  />
                  <button
                    onClick={saveSender}
                    className="mt-1 text-xs text-primary underline underline-offset-2"
                  >
                    {t.saveSender}
                  </button>
                </Field>
                <Field label={t.billTo}>
                  <textarea
                    className={taCls}
                    rows={3}
                    placeholder={t.toPh}
                    value={data.billTo}
                    onChange={(e) => set("billTo", e.target.value)}
                  />
                  <button
                    onClick={saveCustomer}
                    className="mt-1 text-xs text-primary underline underline-offset-2"
                  >
                    {t.saveCustomer}
                  </button>
                </Field>
                <Field label={t.shipTo}>
                  <textarea
                    className={taCls}
                    rows={2}
                    placeholder={t.shipPh}
                    value={data.shipTo}
                    onChange={(e) => set("shipTo", e.target.value)}
                  />
                </Field>
              </div>

              <div className="space-y-3">
                <Row label={t.number}>
                  <input
                    className={inCls}
                    value={data.number}
                    onChange={(e) => set("number", e.target.value)}
                  />
                </Row>
                <Row label={t.date}>
                  <input
                    type="date"
                    className={inCls}
                    value={data.date}
                    onChange={(e) => set("date", e.target.value)}
                  />
                </Row>
                <Row label={t.paymentTerms}>
                  <input
                    className={inCls}
                    value={data.paymentTerms}
                    onChange={(e) => set("paymentTerms", e.target.value)}
                  />
                </Row>
                <Row label={t.dueDate}>
                  <input
                    type="date"
                    className={inCls}
                    value={data.dueDate}
                    onChange={(e) => set("dueDate", e.target.value)}
                  />
                </Row>
                <Row label={t.poNumber}>
                  <input
                    className={inCls}
                    value={data.poNumber}
                    onChange={(e) => set("poNumber", e.target.value)}
                  />
                </Row>
                <Row label={t.yourRef}>
                  <input
                    className={inCls}
                    value={data.yourRef}
                    onChange={(e) => set("yourRef", e.target.value)}
                  />
                </Row>
                <Row label={t.paymentInfo}>
                  <input
                    className={inCls}
                    placeholder={t.paymentInfoPh}
                    value={data.paymentInfo}
                    onChange={(e) => set("paymentInfo", e.target.value)}
                  />
                </Row>
                <Row label={t.currency}>
                  <select
                    className={inCls}
                    value={data.currency}
                    onChange={(e) => set("currency", e.target.value)}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Row>
              </div>
            </div>

            {/* Items */}
            <div className="mt-8 overflow-hidden rounded-lg border border-border">
              <div className="grid grid-cols-12 gap-2 bg-primary px-3 py-2 text-xs font-medium uppercase tracking-wide text-primary-foreground">
                <div className="col-span-6">{t.item}</div>
                <div className="col-span-2 text-right">{t.quantity}</div>
                <div className="col-span-2 text-right">{t.rate}</div>
                <div className="col-span-2 text-right">{t.amount}</div>
              </div>
              {data.items.map((i) => (
                <div
                  key={i.id}
                  className="group grid grid-cols-12 items-center gap-2 border-t border-border px-3 py-2"
                >
                  <div className="col-span-6 flex items-center gap-2">
                    <button
                      onClick={() =>
                        setData((d) => ({ ...d, items: d.items.filter((x) => x.id !== i.id) }))
                      }
                      className="text-foreground/70 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                      aria-label={t.remove}
                    >
                      ×
                    </button>
                    <input
                      className={inCls}
                      placeholder={t.description}
                      value={i.description}
                      onChange={(e) => setItem(i.id, { description: e.target.value })}
                    />
                  </div>
                  <input
                    type="number"
                    className={`${inCls} col-span-2 text-right`}
                    value={i.quantity}
                    onChange={(e) => setItem(i.id, { quantity: Number(e.target.value) })}
                  />
                  <input
                    type="number"
                    className={`${inCls} col-span-2 text-right`}
                    value={i.rate}
                    onChange={(e) => setItem(i.id, { rate: Number(e.target.value) })}
                  />
                  <div className="col-span-2 text-right text-sm tabular-nums">
                    {money(i.quantity * i.rate, data.currency)}
                  </div>
                </div>
              ))}
              <button
                onClick={() =>
                  setData((d) => ({
                    ...d,
                    items: [...d.items, { id: uid(), description: "", quantity: 1, rate: 0 }],
                  }))
                }
                className="w-full border-t border-border px-3 py-2 text-left text-sm text-primary hover:bg-accent"
              >
                {t.addItem}
              </button>
            </div>

            {/* Notes + totals */}
            <div className="mt-8 grid gap-8 sm:grid-cols-2">
              <div className="space-y-4">
                <Field label={t.notes}>
                  <textarea
                    className={taCls}
                    rows={3}
                    placeholder={t.notesPh}
                    value={data.notes}
                    onChange={(e) => set("notes", e.target.value)}
                  />
                </Field>
                <Field label={t.terms}>
                  <textarea
                    className={taCls}
                    rows={3}
                    placeholder={t.termsPh}
                    value={data.terms}
                    onChange={(e) => set("terms", e.target.value)}
                  />
                </Field>
              </div>
              <div className="space-y-2 text-sm">
                <TotalRow label={t.subtotal} value={money(sums.subtotal, data.currency)} />
                <Row label={`${t.tax} %`}>
                  <input
                    type="number"
                    className={`${inCls} text-right`}
                    value={data.taxPercent}
                    onChange={(e) => set("taxPercent", Number(e.target.value))}
                  />
                </Row>
                <TotalRow label={t.tax} value={money(sums.tax, data.currency)} />
                <Row label={t.discount}>
                  <input
                    type="number"
                    className={`${inCls} text-right`}
                    value={data.discount}
                    onChange={(e) => set("discount", Number(e.target.value))}
                  />
                </Row>
                <Row label={t.shipping}>
                  <input
                    type="number"
                    className={`${inCls} text-right`}
                    value={data.shipping}
                    onChange={(e) => set("shipping", Number(e.target.value))}
                  />
                </Row>
                <TotalRow label={t.total} value={money(sums.total, data.currency)} strong />
                <Row label={t.amountPaid}>
                  <input
                    type="number"
                    className={`${inCls} text-right`}
                    value={data.amountPaid}
                    onChange={(e) => set("amountPaid", Number(e.target.value))}
                  />
                </Row>
                <TotalRow label={t.balanceDue} value={money(sums.balance, data.currency)} strong />
              </div>
            </div>
          </section>

          {/* Sidebar */}
          <aside className="space-y-4">
            <Button className="w-full" size="lg" onClick={download}>
              {t.download}
            </Button>
            <div className="flex gap-2">
              <Button className="flex-1" variant="outline" onClick={saveInvoice}>
                {t.saveInvoice}
              </Button>
              <Button className="flex-1" variant="outline" onClick={newInvoice}>
                {t.newInvoice}
              </Button>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-foreground">{t.senders}</h3>
              {senders.length === 0 ? (
                <p className="text-sm font-medium text-foreground/80">{t.noSenders}</p>
              ) : (
                <ul className="space-y-2">
                  {senders.map((s) => (
                    <li key={s.id} className="rounded-md border border-border p-2">
                      <p className="truncate text-sm font-bold text-foreground">{s.name}</p>
                      <p className="truncate text-xs font-medium text-foreground/80">
                        {s.details.split("\n").slice(1).join(", ")}
                      </p>
                      <div className="mt-1 flex gap-3 text-xs">
                        <button
                          className="font-medium text-primary underline"
                          onClick={() => set("from", s.details)}
                        >
                          {t.load}
                        </button>
                        <button
                          className="font-medium text-destructive underline"
                          onClick={() => removeSender(s.id)}
                        >
                          {t.remove}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-foreground">{t.customers}</h3>
              {customers.length === 0 ? (
                <p className="text-sm font-medium text-foreground/80">{t.noCustomers}</p>
              ) : (
                <ul className="space-y-2">
                  {customers.map((c) => (
                    <li key={c.id} className="rounded-md border border-border p-2">
                      <p className="truncate text-sm font-bold text-foreground">{c.name}</p>
                      <p className="truncate text-xs font-medium text-foreground/80">
                        {c.details.split("\n").slice(1).join(", ")}
                      </p>
                      <div className="mt-1 flex gap-3 text-xs">
                        <button
                          className="font-medium text-primary underline"
                          onClick={() => set("billTo", c.details)}
                        >
                          {t.load}
                        </button>
                        <button
                          className="font-medium text-destructive underline"
                          onClick={() => removeCustomer(c.id)}
                        >
                          {t.remove}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-foreground">{t.history}</h3>
              {history.length === 0 ? (
                <p className="text-sm font-medium text-foreground/80">{t.noHistory}</p>
              ) : (
                <ul className="space-y-2">
                  {history.map((h) => (
                    <li
                      key={h.id}
                      className={`rounded-md border p-2 ${
                        h.id === currentId ? "border-primary bg-primary/5" : "border-border"
                      }`}
                    >
                      <p className="truncate text-sm font-bold text-foreground">
                        #{h.number || "–"}
                      </p>
                      <p className="truncate text-xs font-medium text-foreground/80">
                        {h.billTo.split("\n")[0] || "–"} · {h.date} · {money(h.total, h.currency)}
                      </p>
                      <div className="mt-1 flex gap-3 text-xs">
                        <button
                          className="font-medium text-primary underline"
                          onClick={() => openInvoice(h)}
                        >
                          {t.loadHistory}
                        </button>
                        <button
                          className="font-medium text-destructive underline"
                          onClick={() => deleteInvoice(h.id)}
                        >
                          {t.deleteHistory}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

const inCls =
  "w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm outline-none transition-colors hover:border-border focus:border-ring focus:bg-background";
const taCls = `${inCls} resize-y`;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 items-center gap-2">
      <span className="text-right text-xs font-bold uppercase tracking-wide text-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

function TotalRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="grid grid-cols-2 items-center gap-2 px-2">
      <span
        className={`text-right text-xs font-bold uppercase tracking-wide ${
          strong ? "text-foreground" : "text-foreground"
        }`}
      >
        {label}
      </span>
      <span className={`text-right tabular-nums ${strong ? "font-semibold" : ""}`}>{value}</span>
    </div>
  );
}
