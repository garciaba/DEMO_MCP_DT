import type { GitHubUser } from '../../../shared/src/index.js';

interface Session {
  githubToken: string;
  user: GitHubUser;
  createdAt: number;
}

// Lightweight in-memory session store.
// For production, swap with Redis or a DB-backed store.
class SessionStore {
  private sessions = new Map<string, Session>();
  private readonly TTL = 8 * 60 * 60 * 1000; // 8 hours

  set(sessionId: string, session: Session): void {
    this.sessions.set(sessionId, session);
  }

  get(sessionId: string): Session | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    if (Date.now() - session.createdAt > this.TTL) {
      this.sessions.delete(sessionId);
      return undefined;
    }

    return session;
  }

  delete(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  getToken(sessionId: string): string | undefined {
    return this.get(sessionId)?.githubToken;
  }
}

export const sessionStore = new SessionStore();
