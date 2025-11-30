import { useState, useCallback } from 'react';
import { namespaceAPI } from '../services/api';

interface NamespaceState {
  namespaces: string[];
  isLoading: boolean;
  error: string | null;
}

export const useNamespace = () => {
  const [namespaceState, setNamespaceState] = useState<NamespaceState>({
    namespaces: [],
    isLoading: false,
    error: null,
  });

  // 加载命名空间列表
  const loadNamespaces = useCallback(async () => {
    setNamespaceState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    try {
      const namespaces = await namespaceAPI.loadNamespaces();
      setNamespaceState((prev) => ({
        ...prev,
        namespaces,
        isLoading: false,
      }));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to load namespaces';
      setNamespaceState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
    }
  }, []);

  // 创建命名空间
  const createNamespace = useCallback(async (name: string) => {
    setNamespaceState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    try {
      await namespaceAPI.createNamespace(name);
      // 更新命名空间列表
      const updatedNamespaces = await namespaceAPI.loadNamespaces();
      setNamespaceState((prev) => ({
        ...prev,
        namespaces: updatedNamespaces,
        isLoading: false,
      }));

      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to create namespace';
      setNamespaceState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));

      return false;
    }
  }, []);

  // 删除命名空间
  const deleteNamespace = useCallback(async (name: string) => {
    setNamespaceState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    try {
      await namespaceAPI.deleteNamespace(name);
      // 更新命名空间列表
      const updatedNamespaces = await namespaceAPI.loadNamespaces();
      setNamespaceState((prev) => ({
        ...prev,
        namespaces: updatedNamespaces,
        isLoading: false,
      }));

      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to delete namespace';
      setNamespaceState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));

      return false;
    }
  }, []);

  return {
    ...namespaceState,
    loadNamespaces,
    createNamespace,
    deleteNamespace,
  };
};
