"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { loginUser } from '@/lib/api';

export interface User {
  id: number;
  username: string;
  role: 'admin' | 'user';
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedToken = localStorage.getItem('jarvis_auth_token');
      const storedUser = localStorage.getItem('jarvis_user');
      if (storedToken && storedUser) {
        try {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        } catch (e) {
          localStorage.removeItem('jarvis_auth_token');
          localStorage.removeItem('jarvis_user');
        }
      }
    }
  }, []);

  const login = async (username: string, password: string) => {
    const data = await loginUser(username, password);
    setToken(data.access_token);
    setUser(data.user);
  };

  const logout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('jarvis_auth_token');
      localStorage.removeItem('jarvis_user');
    }
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        isAuthenticated: !!token && !!user,
        isAdmin: user?.role === 'admin',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
