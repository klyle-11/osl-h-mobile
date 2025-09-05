// Backend integration placeholders for future multi-user sync.
// In the future, implement these functions to talk to your server (e.g., Node/Express + DB).

export type User = { id: string; name: string };
export type RemoteAnnotation = {
  id: string;
  userId: string;
  docId: string;
  cfi: string;
  color?: string;
  note?: string;
  createdAt: number;
  updatedAt: number;
};

// TODO: wire to real auth (e.g., NextAuth) when multi-user arrives
export async function getCurrentUser(): Promise<User | null> {
  return null;
}

// TODO: call your REST/GraphQL endpoints
export async function syncAnnotations(docId: string, local: RemoteAnnotation[]): Promise<RemoteAnnotation[]> {
  // Intentionally a no-op in single-user mode.
  return local;
}

// TODO: subscribe to realtime updates (WebSocket) so users can see each others' highlights
export function subscribeAnnotations(docId: string, onEvent: (event: { type: 'upsert' | 'delete'; data: RemoteAnnotation }) => void) {
  // Return unsubscribe
  return () => {};
}
