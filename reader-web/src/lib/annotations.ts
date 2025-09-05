import { openDB, listAnnotations, putAnnotation, deleteAnnotation } from "@/lib/db";
import { uuid } from "@/lib/utils";
import type { Annotation, DocId } from "@/lib/types";

export async function loadAnnotations(docId: DocId): Promise<Annotation[]> {
  const db = await openDB();
  return listAnnotations(db, docId);
}

export async function addAnnotation(docId: DocId, cfi: string, color?: string, note?: string) {
  const now = Date.now();
  const ann: Annotation = {
    id: uuid(),
    docId,
    cfi,
    color,
    note,
    createdAt: now,
    updatedAt: now,
  };
  const db = await openDB();
  await putAnnotation(db, ann);
  return ann;
}

export async function updateAnnotationNote(ann: Annotation, note?: string) {
  ann.note = note;
  ann.updatedAt = Date.now();
  const db = await openDB();
  await putAnnotation(db, ann);
  return ann;
}

export async function removeAnnotation(id: string) {
  const db = await openDB();
  await deleteAnnotation(db, id);
}
