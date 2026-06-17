import type { GitHubUser, AnthropicUser, AuthProvider } from '../../../shared/src/index.js';

interface Session {
  provider: AuthProvider;
  githubToken?: string;
  anthropicApiKey?: string;
  user?: GitHubUser;
  anthropicUser?: AnthropicUser;
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
    const session = this.get(sessionId);
    if (!session) return undefined;
    return session.githubToken ?? session.anthropicApiKey;
  }

  getProvider(sessionId: string): AuthProvider | undefined {
    return this.get(sessionId)?.provider;
  }
}

export const sessionStore = new SessionStore();
