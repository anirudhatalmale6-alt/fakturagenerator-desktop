import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Dict } from "./i18n";

export type Line = { id: string; description: string; quantity: number; rate: number };

export type InvoiceData = {
  logo: string | null;
  from: string;
  billTo: string;
  shipTo: string;
  number: string;
  date: string;
  paymentTerms: string;
  dueDate: string;
  poNumber: string;
  yourRef: string;
  paymentInfo: string;
  items: Line[];
  notes: string;
  terms: string;
  taxPercent: number;
  discount: number;
  shipping: number;
  amountPaid: number;
  currency: string;
};

export function money(n: number, currency: string) {
  return `${currency} ${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function totals(d: InvoiceData) {
  const subtotal = d.items.reduce((s, i) => s + (i.quantity || 0) * (i.rate || 0), 0);
  const tax = (subtotal * (d.taxPercent || 0)) / 100;
  const total = subtotal + tax - (d.discount || 0) + (d.shipping || 0);
  const balance = total - (d.amountPaid || 0);
  return { subtotal, tax, total, balance };
}

export function generatePdf(d: InvoiceData, t: Dict) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const M = 48;
  let y = M;

  if (d.logo) {
    try {
      doc.addImage(d.logo, "PNG", M, y, 110, 60);
    } catch {
      /* ignore bad image */
    }
  }

  doc.setFontSize(26);
  doc.setTextColor(30);
  doc.text(t.invoice, 547, y + 22, { align: "right" });
  doc.setFontSize(11);
  doc.setTextColor(110);
  doc.text(d.number ? `# ${d.number}` : "", 547, y + 40, { align: "right" });

  y += 90;
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(t.from, M, y);
  doc.text(t.billTo, 220, y);
  doc.setTextColor(30);
  doc.text(doc.splitTextToSize(d.from || "-", 150), M, y + 14);
  doc.text(doc.splitTextToSize(d.billTo || "-", 150), 220, y + 14);

  const meta: [string, string][] = [
    [t.date, d.date],
    [t.paymentTerms, d.paymentTerms],
    [t.dueDate, d.dueDate],
    [t.poNumber, d.poNumber],
    [t.yourRef, d.yourRef],
    [t.paymentInfo, d.paymentInfo],
  ].filter(([, v]) => !!v) as [string, string][];
  let my = y;
  meta.forEach(([k, v]) => {
    doc.setTextColor(120);
    doc.text(k, 460, my, { align: "right" });
    doc.setTextColor(30);
    doc.text(String(v), 547, my, { align: "right" });
    my += 16;
  });

  const startY = Math.max(y + 90, my + 20);
  autoTable(doc, {
    startY,
    head: [[t.item, t.quantity, t.rate, t.amount]],
    body: d.items.map((i) => [
      i.description,
      String(i.quantity ?? 0),
      money(i.rate || 0, d.currency),
      money((i.quantity || 0) * (i.rate || 0), d.currency),
    ]),
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 8 },
    headStyles: { fillColor: [32, 41, 57], textColor: 255 },
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
    },
    margin: { left: M, right: M },
  });

  const { subtotal, tax, total, balance } = totals(d);
  // @ts-expect-error autotable augments doc
  let ty = (doc.lastAutoTable?.finalY ?? startY) + 24;
  const rows: [string, string][] = [
    [t.subtotal, money(subtotal, d.currency)],
    [`${t.tax} (${d.taxPercent || 0}%)`, money(tax, d.currency)],
  ];
  if (d.discount) rows.push([t.discount, `-${money(d.discount, d.currency)}`]);
  if (d.shipping) rows.push([t.shipping, money(d.shipping, d.currency)]);
  rows.push([t.total, money(total, d.currency)]);
  if (d.amountPaid) rows.push([t.amountPaid, money(d.amountPaid, d.currency)]);
  rows.push([t.balanceDue, money(balance, d.currency)]);

  rows.forEach(([k, v], idx) => {
    const last = idx === rows.length - 1;
    doc.setFontSize(last ? 12 : 10);
    doc.setTextColor(last ? 20 : 110);
    doc.text(k, 440, ty, { align: "right" });
    doc.setTextColor(20);
    doc.text(v, 547, ty, { align: "right" });
    ty += last ? 22 : 18;
  });

  if (d.notes || d.terms) {
    let ny = ty + 20;
    doc.setFontSize(10);
    if (d.notes) {
      doc.setTextColor(120);
      doc.text(t.notes, M, ny);
      doc.setTextColor(40);
      doc.text(doc.splitTextToSize(d.notes, 320), M, ny + 14);
      ny += 14 + doc.splitTextToSize(d.notes, 320).length * 12 + 14;
    }
    if (d.terms) {
      doc.setTextColor(120);
      doc.text(t.terms, M, ny);
      doc.setTextColor(40);
      doc.text(doc.splitTextToSize(d.terms, 320), M, ny + 14);
    }
  }

  doc.save(`${t.invoice.toLowerCase()}-${d.number || "1"}.pdf`);
}
