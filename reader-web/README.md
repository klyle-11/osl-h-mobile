Mobile-first EPUB reader with annotations, built on Next.js and Tailwind.

Key points:
- EPUB rendering powered by Readest’s underlying engine (foliate-js) loaded at runtime.
- Local-only storage: EPUB files and annotations live in IndexedDB.
- Mobile bottom-sheet UI for creating/editing notes linked to highlights.
- Clear seams to plug in a backend later for multi-user sync.

Getting Started
1) Ensure disk space is available for dependencies.
2) Install and run:

```bash
npm install
npm run dev
```

Then visit http://localhost:3000/reader and upload an EPUB.

Architecture
- `src/components/FoliateView.tsx` wraps the foliate-js <foliate-view> custom element and emits highlight events.
- `src/components/AnnotationSheet.tsx` is a mobile-style bottom sheet for note editing.
- `src/lib/db.ts` is a minimal IndexedDB helper; `src/lib/annotations.ts` provides CRUD.
- `src/lib/backend.ts` documents where to add server APIs and realtime later.

Future multi-user
- Add auth (e.g., NextAuth) and implement functions in `src/lib/backend.ts`.
- Sync annotations per docId, subscribe to updates over WebSocket.

