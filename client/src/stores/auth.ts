import { create } from 'zustand';
import type { AuthStatus, GitHubUser, DeviceCodeResponse } from '../../../shared/src/index';

interface AuthState {
  status: AuthStatus;
  deviceCode: DeviceCodeResponse | null;
  loading: boolean;
  error: string | null;
  clientId: string;

  setClientId: (id: string) => void;
  checkAuth: () => Promise<void>;
  startDeviceFlow: () => Promise<void>;
  pollForToken: (deviceCode: string) => Promise<boolean | 'slow_down'>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: { authenticated: false },
  deviceCode: null,
  loading: false,
  error: null,
  clientId: '',

  setClientId: (id: string) => set({ clientId: id }),

  checkAuth: async () => {
    try {
      const res = await fetch('/api/auth/status', { credentials: 'include' });
      const data = await res.json();
      set({ status: data });
    } catch {
      set({ status: { authenticated: false } });
    }
  },

  startDeviceFlow: async () => {
    const { clientId } = get();
    if (!clientId.trim()) {
      set({ error: 'Please enter your GitHub Client ID' });
      return;
    }
    set({ loading: true, error: null });
    try {
      const res = await fetch('/api/auth/device-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ client_id: clientId.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        set({ error: err.error, loading: false });
        return;
      }
      const data = await res.json();
      set({ deviceCode: data, loading: false });
    } catch (err) {
      set({ error: 'Failed to start authentication', loading: false });
    }
  },

  pollForToken: async (deviceCode: string) => {
    try {
      const { clientId } = get();
      const res = await fetch('/api/auth/poll-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ device_code: deviceCode, client_id: clientId }),
      });

      const data = await res.json();

      if (data.status === 'complete') {
        set({
          status: { authenticated: true, user: data.user as GitHubUser },
          deviceCode: null,
        });
        return true;
      }

      if (data.status === 'slow_down') {
        return 'slow_down'; // Signal to increase interval
      }

      if (data.status === 'error') {
        set({ error: data.error, deviceCode: null });
        return true; // Stop polling
      }

      return false; // Keep polling
    } catch {
      return false;
    }
  },

  logout: async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    set({ status: { authenticated: false }, deviceCode: null });
  },

  clearError: () => set({ error: null }),
}));
