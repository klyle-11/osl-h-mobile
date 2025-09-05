// Simple IndexedDB wrapper without external deps
// DB name and stores are versioned to allow future multi-user features.

const DB_NAME = 'reader-web';
const DB_VERSION = 1;
const STORE_BOOKS = 'books';
const STORE_ANN = 'annotations';
const STORE_BLOBS = 'blobs'; // File blobs by docId

export type IDBDB = Awaited<ReturnType<typeof openDB>>;

export async function openDB() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_BOOKS)) {
        db.createObjectStore(STORE_BOOKS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_ANN)) {
        const store = db.createObjectStore(STORE_ANN, { keyPath: 'id' });
        // index by docId to fetch annotations per book
        store.createIndex('by_doc', 'docId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_BLOBS)) {
        db.createObjectStore(STORE_BLOBS); // key: docId, value: Blob
      }
    };
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
  });
}

function tx(db: IDBDatabase, store: string, mode: IDBTransactionMode = 'readonly') {
  return db.transaction(store, mode).objectStore(store);
}

export async function putBook(db: IDBDatabase, book: any) {
  await reqProm(tx(db, STORE_BOOKS, 'readwrite').put(book));
}
export async function getBook(db: IDBDatabase, id: string) {
  return reqProm<any>(tx(db, STORE_BOOKS).get(id));
}
export async function listBooks(db: IDBDatabase) {
  return reqProm<any[]>(tx(db, STORE_BOOKS).getAll());
}
export async function putBlob(db: IDBDatabase, id: string, blob: Blob) {
  await reqProm(tx(db, STORE_BLOBS, 'readwrite').put(blob, id));
}
export async function getBlob(db: IDBDatabase, id: string) {
  return reqProm<Blob | undefined>(tx(db, STORE_BLOBS).get(id));
}

export async function putAnnotation(db: IDBDatabase, ann: any) {
  await reqProm(tx(db, STORE_ANN, 'readwrite').put(ann));
}
export async function deleteAnnotation(db: IDBDatabase, id: string) {
  await reqProm(tx(db, STORE_ANN, 'readwrite').delete(id));
}
export async function listAnnotations(db: IDBDatabase, docId: string) {
  return new Promise<any[]>((resolve, reject) => {
    const store = tx(db, STORE_ANN);
    const idx = store.index('by_doc');
    const req = idx.getAll(docId);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result ?? []);
  });
}

function reqProm<T = unknown>(req: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}
