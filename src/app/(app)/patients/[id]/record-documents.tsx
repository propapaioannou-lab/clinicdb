"use client";

import Link from "next/link";
import { Dropdown } from "@/components/dropdown";
import { useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { PlusIcon } from "@/components/icons";
import { Badge, card, ErrorBox, inputClass, Notice, primaryButton, secondaryButton, textareaClass } from "@/components/ui";
import type { DocumentActionState } from "./documents-actions";

export type DocRow = {
  id: string;
  type: string;
  name: string;
  documentDate: string; // yyyy-mm-dd
  comment: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  deleted: boolean;
  canOpen: boolean;
  visit: { id: string; label: string } | null;
};

const TYPES = ["GENERAL_CONSENT", "PROCEDURE_CONSENT", "LAB_RESULT", "IMAGING", "REFERRAL", "LETTER", "HISTORY", "SURGICAL_BRIEF", "PHOTO", "OTHER"] as const;
const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif,.doc,.docx,.xls,.xlsx";
const isImage = (mime: string) => mime.startsWith("image/") && mime !== "image/heic";
const size = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toLocaleString("el-GR", { maximumFractionDigits: 1 })} MB`);
const kind = (mime: string) => (mime === "application/pdf" ? "PDF" : isImage(mime) || mime === "image/heic" ? "IMG" : mime.includes("sheet") || mime.includes("excel") ? "XLS" : "DOC");
// dd/mm/yyyy, typed like every other date in the app (a date picker follows the
// browser's language and may show month/day).
const ddmmyyyy = (iso: string) => iso.split("-").reverse().join("/");
const today = () => ddmmyyyy(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens" }).format(new Date()));

// Type, date, visit and comment: shared by upload (for all chosen files) and edit.
function MetaFields({ visits, initial }: { visits: { id: string; label: string }[]; initial?: Partial<DocRow> }) {
  const t = useTranslations("documents");
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="block text-sm text-ink-3">{t("type")}
        <Dropdown name="type" label={t("type")} defaultValue={initial?.type ?? "OTHER"} placeholder={null} options={TYPES.map((ty) => ({ value: ty, label: t(`types.${ty}`) }))} className="mt-1" />
      </label>
      <label className="block text-sm text-ink-3">{t("date")}
        <input name="documentDate" required defaultValue={initial?.documentDate ? ddmmyyyy(initial.documentDate) : today()} placeholder="ΗΗ/ΜΜ/ΕΕΕΕ" inputMode="numeric" className={inputClass} />
      </label>
      <label className="block text-sm text-ink-3">{t("visit")}
        <Dropdown name="visitId" label={t("visit")} defaultValue={initial?.visit?.id} options={visits.map((v) => ({ value: v.id, label: v.label }))} className="mt-1" />
      </label>
      <label className="block text-sm text-ink-3 sm:col-span-3">{t("comment")}
        <textarea name="comment" rows={2} defaultValue={initial?.comment ?? ""} className={textareaClass} />
      </label>
    </div>
  );
}

// Έγγραφα tab (SPEC §4 Document; Phase 2 step 6, decided 11 Oct 2026).
export function DocumentsTab({
  patientId,
  docs,
  visits,
  canEdit,
  canRestore,
  showingDeleted,
  upload,
  update,
  setDeleted,
}: {
  patientId: string;
  docs: DocRow[];
  visits: { id: string; label: string }[];
  canEdit: boolean;
  canRestore: boolean;
  showingDeleted: boolean;
  upload: (fd: FormData) => Promise<DocumentActionState>;
  update: (id: string, fd: FormData) => Promise<DocumentActionState>;
  setDeleted: (id: string, deleted: boolean) => Promise<DocumentActionState>;
}) {
  const t = useTranslations("documents");
  const format = useFormatter();
  const [view, setView] = useState<"list" | "gallery">("list");
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [state, setState] = useState<DocumentActionState>({});
  const [pending, start] = useTransition();
  const active = docs.filter((d) => !d.deleted);
  const images = active.filter((d) => d.canOpen && isImage(d.mimeType));
  const date = (d: string) => format.dateTime(new Date(`${d}T12:00:00Z`), { day: "2-digit", month: "2-digit", year: "numeric" });
  const error = state.error && t(`errors.${state.error}`, { file: state.file ?? "" });

  // Copy the files right away: the browser empties the live list when the input resets.
  const addFiles = (list: FileList | null) => {
    const picked = Array.from(list ?? []);
    if (picked.length) setFiles((x) => [...x, ...picked]);
  };
  const send = (form: HTMLFormElement) => {
    const fd = new FormData(form);
    fd.delete("files");
    for (const f of files) fd.append("files", f);
    start(async () => {
      const r = await upload(fd);
      setState(r);
      if (r.saved) {
        setFiles([]);
        setOpen(false);
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {error && <ErrorBox>{error}</ErrorBox>}
      {state.saved !== undefined && !state.error && <Notice>{t("saved", { count: state.saved })}</Notice>}

      <section className={`${card} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-5 py-4">
          <h2 className="text-[17px] font-semibold">{t("count", { count: active.length })}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div role="tablist" aria-label={t("viewLabel")} className="flex rounded-full border border-line-strong p-0.5">
              {(["list", "gallery"] as const).map((v) => (
                <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`min-h-9 rounded-full px-3.5 text-sm ${view === v ? "bg-primary font-semibold text-white" : "text-ink-3"}`}>
                  {t(`views.${v}`)}
                </button>
              ))}
            </div>
            {canEdit && (
              <button type="button" onClick={() => setOpen((x) => !x)} className={primaryButton}>
                <PlusIcon />{t("upload")}
              </button>
            )}
          </div>
        </div>

        {open && canEdit && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(e.currentTarget);
            }}
            className="flex flex-col gap-3 border-b border-line-soft bg-surface-2 px-5 py-4"
          >
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                addFiles(e.dataTransfer.files);
              }}
              className={`flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-[12px] border-2 border-dashed px-4 py-5 text-center ${dragging ? "border-primary bg-primary-tint" : "border-line-strong bg-surface"}`}
            >
              <span className="text-[15px] font-semibold text-primary">{t("choose")}</span>
              <span className="text-[13px] text-muted">{t("allowed")}</span>
              <input type="file" name="files" multiple accept={ACCEPT} onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} className="sr-only" />
            </label>
            {files.length > 0 && (
              <ul className="flex flex-col gap-1 text-sm">
                {files.map((f, i) => (
                  <li key={`${f.name}${i}`} className="flex items-center justify-between gap-2 rounded-[8px] bg-surface px-3 py-1.5">
                    <span className="min-w-0 truncate">{f.name} <span className="text-muted">· {size(f.size)}</span></span>
                    <button type="button" aria-label={t("removeFile", { name: f.name })} onClick={() => setFiles((x) => x.filter((_, j) => j !== i))} className="text-muted hover:text-danger">✕</button>
                  </li>
                ))}
              </ul>
            )}
            <MetaFields visits={visits} />
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={pending || !files.length} className={primaryButton}>{pending ? t("uploading") : t("save", { count: files.length })}</button>
              <button type="button" onClick={() => { setOpen(false); setFiles([]); }} className={secondaryButton}>{t("cancel")}</button>
            </div>
          </form>
        )}

        {view === "gallery" ? (
          images.length ? (
            <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 lg:grid-cols-4">
              {images.map((d) => (
                <a key={d.id} href={`/api/documents/${d.id}`} target="_blank" rel="noopener" className="group flex flex-col gap-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element -- private files, served with auth */}
                  <img src={`/api/documents/${d.id}`} alt={d.name} loading="lazy" className="aspect-square w-full rounded-[10px] border border-line-soft bg-surface-2 object-cover group-hover:border-primary" />
                  <span className="truncate text-[13px] font-medium">{d.name}</span>
                  <span className="text-[12px] text-muted">{date(d.documentDate)}</span>
                </a>
              ))}
            </div>
          ) : (
            <p className="px-5 py-6 text-sm text-muted">{t("noImages")}</p>
          )
        ) : (
          <>
            {docs.length === 0 && <p className="px-5 py-6 text-sm text-muted">{t("none")}</p>}
            {docs.map((d) =>
              editing === d.id ? (
                <form
                  key={d.id}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    start(async () => {
                      const r = await update(d.id, fd);
                      setState(r.error ? r : {});
                      if (!r.error) setEditing(null);
                    });
                  }}
                  className="flex flex-col gap-3 border-b border-line-softer bg-surface-2 px-5 py-4"
                >
                  <label className="block text-sm text-ink-3">{t("name")}
                    <input name="name" required defaultValue={d.name} className={inputClass} />
                  </label>
                  <MetaFields visits={visits} initial={d} />
                  <div className="flex flex-wrap gap-2">
                    <button type="submit" disabled={pending} className={primaryButton}>{t("saveEdit")}</button>
                    <button type="button" onClick={() => setEditing(null)} className={secondaryButton}>{t("cancel")}</button>
                  </div>
                </form>
              ) : (
                <div key={d.id} className={`flex flex-wrap items-center gap-4 border-b border-line-softer px-5 py-3.5 ${d.deleted ? "opacity-55" : ""}`}>
                  <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-primary-tint text-[12px] font-bold text-primary">{kind(d.mimeType)}</span>
                  <span className="flex min-w-0 flex-[1_1_280px] flex-col gap-0.5">
                    <span className="flex flex-wrap items-center gap-2">
                      {d.canOpen && !d.deleted ? (
                        <a href={`/api/documents/${d.id}`} target="_blank" rel="noopener" className="text-[15px] font-semibold text-ink hover:text-primary">{d.name}</a>
                      ) : (
                        <span className="text-[15px] font-semibold">{d.name}</span>
                      )}
                      <Badge tone="neutral">{t(`types.${d.type}` as "types.OTHER")}</Badge>
                      {d.deleted && <Badge tone="red">{t("deleted")}</Badge>}
                    </span>
                    <span className="text-[13px] text-muted">
                      {[date(d.documentDate), size(d.sizeBytes), d.visit && t("ofVisit", { visit: d.visit.label })].filter(Boolean).join(" · ")}
                    </span>
                    {d.comment && <span className="text-sm text-ink-3">{d.comment}</span>}
                  </span>
                  <span className="flex flex-wrap gap-3 text-[13.5px] font-semibold">
                    {d.canOpen && <a href={`/api/documents/${d.id}?download=1`} className="text-primary hover:text-primary-hover">{t("download")}</a>}
                    {canEdit && !d.deleted && <button type="button" onClick={() => setEditing(d.id)} className="text-primary hover:text-primary-hover">{t("edit")}</button>}
                    {canEdit && !d.deleted && (
                      <button
                        type="button"
                        onClick={() => confirm(t("confirmDelete", { name: d.name })) && start(async () => setState(await setDeleted(d.id, true)))}
                        className="text-danger hover:underline"
                      >
                        {t("delete")}
                      </button>
                    )}
                    {canRestore && d.deleted && (
                      <button type="button" onClick={() => start(async () => setState(await setDeleted(d.id, false)))} className="text-primary hover:text-primary-hover">{t("restore")}</button>
                    )}
                  </span>
                </div>
              ),
            )}
          </>
        )}
      </section>
      {canRestore && (
        <Link href={`/patients/${patientId}?tab=documents${showingDeleted ? "" : "&deleted=1"}`} className="self-start text-[13px] font-semibold text-muted hover:text-primary">
          {showingDeleted ? t("hideDeleted") : t("showDeleted")}
        </Link>
      )}
    </div>
  );
}
