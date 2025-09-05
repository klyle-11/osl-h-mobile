export type DocId = string;

export type Annotation = {
  id: string; // uuid
  docId: DocId;
  cfi: string; // epubcfi(...)
  color?: string; // highlight color
  note?: string;
  createdAt: number;
  updatedAt: number;
};

export type StoredBook = {
  id: DocId;
  name: string;
  size: number;
  lastModified?: number;
};
