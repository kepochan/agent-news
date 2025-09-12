import { useState, useEffect, createContext, useContext } from 'react';

export interface User {
  id: string;
  email: string;
  name?: string;
  role: 'admin' | 'user';
  image?: string;
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useAuthState() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const checkAuth = async () => {
    try {
      // Check if we have a token in URL (OAuth callback)
      const urlParams = new URLSearchParams(window.location.search);
      const tokenFromUrl = urlParams.get('token');
      const userFromUrl = urlParams.get('user');
      
      if (tokenFromUrl && userFromUrl) {
        // Store token and user from OAuth callback
        localStorage.setItem('auth_token', tokenFromUrl);
        const userData = JSON.parse(decodeURIComponent(userFromUrl));
        setUser(userData);
        
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
        setLoading(false);
        return;
      }

      // Check if we have a stored token
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }

      // Verify token with backend
      const response = await fetch('http://localhost:8000/auth/session', {
        headers: getAuthHeaders(),
      });
      
      if (response.ok) {
        const session = await response.json();
        if (session.user) {
          // Get additional user info from members API
          const memberResponse = await fetch('http://localhost:8000/members/me', {
            headers: getAuthHeaders(),
          });
          
          if (memberResponse.ok) {
            const memberInfo = await memberResponse.json();
            setUser({
              id: session.user.id,
              email: session.user.email,
              name: session.user.name || memberInfo.name,
              role: memberInfo.role || 'user',
            });
          } else {
            setUser({
              id: session.user.id,
              email: session.user.email,
              name: session.user.name,
              role: 'user',
            });
          }
        } else {
          setUser(null);
          localStorage.removeItem('auth_token');
        }
      } else {
        setUser(null);
        localStorage.removeItem('auth_token');
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
      localStorage.removeItem('auth_token');
    } finally {
      setLoading(false);
    }
  };

  const login = () => {
    window.location.href = 'http://localhost:8000/auth/google';
  };

  const logout = async () => {
    try {
      await fetch('http://localhost:8000/auth/logout', {
        method: 'POST',
        headers: getAuthHeaders(),
      });
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      localStorage.removeItem('auth_token');
      setUser(null);
      window.location.href = '/';
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  return {
    user,
    loading,
    login,
    logout,
    refreshUser: checkAuth,
  };
}