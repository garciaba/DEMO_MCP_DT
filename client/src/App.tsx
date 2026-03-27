import { useEffect } from 'react';
import { useAuthStore } from './stores/auth';
import { LoginScreen } from './components/LoginScreen';
import { ChatLayout } from './components/ChatLayout';

export function App() {
  const { status, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (!status.authenticated) {
    return <LoginScreen />;
  }

  return <ChatLayout />;
}
