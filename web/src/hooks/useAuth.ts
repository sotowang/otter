import { useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';

interface AuthState {
  isAuthenticated: boolean;
  username: string | null;
  isLoading: boolean;
  error: string | null;
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    username: null,
    isLoading: true,
    error: null,
  });

  // 检查本地存储中的认证信息
  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('otter_token');
      const username = localStorage.getItem('otter_username');

      if (token && username) {
        setAuthState({
          isAuthenticated: true,
          username,
          isLoading: false,
          error: null,
        });
      } else {
        setAuthState((prev) => ({
          ...prev,
          isLoading: false,
        }));
      }
    };

    checkAuth();
  }, []);

  // 登录
  const login = useCallback(async (username: string, password: string) => {
    setAuthState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    try {
      const response = await authAPI.login(username, password);

      // 保存认证信息到本地存储
      localStorage.setItem('otter_token', response.token);
      localStorage.setItem('otter_username', username);

      setAuthState({
        isAuthenticated: true,
        username,
        isLoading: false,
        error: null,
      });

      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Login failed';
      setAuthState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));

      return false;
    }
  }, []);

  // 登出
  const logout = useCallback(() => {
    // 清除本地存储中的认证信息
    localStorage.removeItem('otter_token');
    localStorage.removeItem('otter_username');

    setAuthState({
      isAuthenticated: false,
      username: null,
      isLoading: false,
      error: null,
    });
  }, []);

  return {
    ...authState,
    login,
    logout,
  };
};
