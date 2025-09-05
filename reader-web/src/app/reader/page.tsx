"use client";
// @ts-nocheck
import React from "react";
import FoliateView, { type FoliateViewRef } from "@/components/FoliateView";
import FileUpload from "@/components/FileUpload";
import AnnotationSheet from "@/components/AnnotationSheet";
import { addAnnotation, loadAnnotations, removeAnnotation, updateAnnotationNote } from "@/lib/annotations";
import { getBlob, openDB, putBlob, putBook } from "@/lib/db";
import { hashFile } from "@/lib/utils";

export default function ReaderPage() {
  const readerRef = React.useRef<FoliateViewRef>(null);
  const [docId, setDocId] = React.useState<string | null>(null);
  const [anns, setAnns] = React.useState([]);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [active, setActive] = React.useState<any>(null); // { id, cfi }

  const bootFromStorage = React.useCallback(async () => {
    // attempt to load last opened book from session
    const last = sessionStorage.getItem("lastDocId");
    if (!last) return;
    const db = await openDB();
    const blob = await getBlob(db, last);
    if (!blob) return;
    setDocId(last);
    await readerRef.current?.open(blob);
    const list = await loadAnnotations(last);
    setAnns(list);
    for (const a of list) await readerRef.current?.addHighlight({ id: a.id, cfi: a.cfi, color: a.color, note: a.note });
  }, []);

  React.useEffect(() => {
    bootFromStorage();
  }, [bootFromStorage]);

  const onFile = async (file: File) => {
    const id = await hashFile(file);
    const db = await openDB();
    await putBlob(db, id, file);
    await putBook(db, { id, name: file.name, size: file.size, lastModified: file.lastModified });
    sessionStorage.setItem("lastDocId", id);
    setDocId(id);
    await readerRef.current?.open(file);
    const list = await loadAnnotations(id);
    setAnns(list);
    for (const a of list) await readerRef.current?.addHighlight({ id: a.id, cfi: a.cfi, color: a.color, note: a.note });
  };

  const onHighlightCreate = async (cfi: string) => {
    if (!docId) return;
    const ann = await addAnnotation(docId, cfi, "#fde047");
    setAnns((s: any[]) => [ann, ...s]);
    await readerRef.current?.addHighlight({ id: ann.id, cfi: ann.cfi, color: ann.color });
    setActive(ann);
    setSheetOpen(true);
  };

  const onHighlightTap = async (_id: string, cfi: string) => {
    const ann = anns.find((a: any) => a.cfi === cfi);
    if (ann) {
      setActive(ann);
      setSheetOpen(true);
    }
  };

  const saveNote = async (note: string) => {
    if (!active) return;
    const updated = await updateAnnotationNote(active, note);
    setAnns((s: any[]) => s.map(a => (a.id === updated.id ? updated : a)));
    setSheetOpen(false);
  };

  const deleteActive = async () => {
    if (!active) return;
    await readerRef.current?.deleteHighlight(active.cfi);
    await removeAnnotation(active.id);
    setAnns((s: any[]) => s.filter(a => a.id !== active.id));
    setActive(null);
    setSheetOpen(false);
  };

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="p-3 flex items-center gap-2 border-b border-neutral-200 dark:border-neutral-800">
        <div className="text-lg font-semibold">Reader</div>
        <div className="ml-auto w-44 sm:w-64">
          <FileUpload onFile={onFile} />
        </div>
      </header>
      <main className="flex-1 min-h-0">
        {docId ? (
          <div className="h-dvh sm:h-[calc(100dvh-64px)]">
            <FoliateView ref={readerRef} onHighlightCreate={onHighlightCreate} onHighlightTap={onHighlightTap} />
          </div>
        ) : (
          <div className="h-[80dvh] flex items-center justify-center p-6">
            <div className="max-w-sm w-full space-y-3 text-center">
              <h1 className="text-xl font-semibold">Upload an EPUB</h1>
              <p className="text-sm text-neutral-600 dark:text-neutral-300">Your file and annotations stay on this device.</p>
              <FileUpload onFile={onFile} />
            </div>
          </div>
        )}
      </main>

      <AnnotationSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSave={saveNote}
        onDelete={deleteActive}
        defaultNote={active?.note}
      />
    </div>
  );
}
