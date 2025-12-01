import type { Config, ConfigHistory, User } from '../types';

const API_BASE = '/api/v1';

// 获取认证头
const getHeaders = (): HeadersInit => {
  const token = localStorage.getItem('otter_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

// 处理API响应
const handleResponse = async <T>(response: Response): Promise<T> => {
  if (response.status === 401) {
    // 未授权，清除本地存储并跳转到登录页
    localStorage.removeItem('otter_token');
    localStorage.removeItem('otter_username');
    window.location.href = '/';
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'API request failed');
  }

  // 204 No Content响应没有响应体，直接返回undefined
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
};

// 认证相关API
export const authAPI = {
  // 登录
  login: async (
    username: string,
    password: string
  ): Promise<{ token: string }> => {
    const response = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    const tokenResponse = await handleResponse<{
      access_token: string;
      refresh_token: string;
      expires_in: number;
    }>(response);

    return { token: tokenResponse.access_token };
  },
};

// 配置管理API
export const configAPI = {
  // 加载配置列表
  loadConfigs: async (namespace: string, group: string): Promise<Config[]> => {
    const response = await fetch(
      `${API_BASE}/namespaces/${namespace}/groups/${group}/configs`,
      {
        headers: getHeaders(),
      }
    );

    return handleResponse<Config[]>(response);
  },

  // 获取单个配置
  getConfig: async (
    namespace: string,
    group: string,
    key: string
  ): Promise<Config> => {
    const response = await fetch(
      `${API_BASE}/namespaces/${namespace}/groups/${group}/configs/${key}`,
      {
        headers: getHeaders(),
      }
    );

    return handleResponse<Config>(response);
  },

  // 保存配置
  saveConfig: async (
    namespace: string,
    group: string,
    key: string,
    value: string,
    type: string
  ): Promise<Config> => {
    const response = await fetch(
      `${API_BASE}/namespaces/${namespace}/groups/${group}/configs/${key}`,
      {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ value, type }),
      }
    );

    return handleResponse<Config>(response);
  },

  // 删除配置
  deleteConfig: async (
    namespace: string,
    group: string,
    key: string
  ): Promise<void> => {
    const response = await fetch(
      `${API_BASE}/namespaces/${namespace}/groups/${group}/configs/${key}`,
      {
        method: 'DELETE',
        headers: getHeaders(),
      }
    );

    return handleResponse<void>(response);
  },

  // 查看配置历史
  getConfigHistory: async (
    namespace: string,
    group: string,
    key: string
  ): Promise<ConfigHistory[]> => {
    const response = await fetch(
      `${API_BASE}/namespaces/${namespace}/groups/${group}/configs/${key}/history`,
      {
        headers: getHeaders(),
      }
    );

    return handleResponse<ConfigHistory[]>(response);
  },

  // 回滚配置
  rollbackConfig: async (
    namespace: string,
    group: string,
    key: string,
    version: number
  ): Promise<Config> => {
    const response = await fetch(
      `${API_BASE}/namespaces/${namespace}/groups/${group}/configs/${key}/rollback`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ version }),
      }
    );

    return handleResponse<Config>(response);
  },

  // 克隆配置
  cloneConfigs: async (
    sourceNamespace: string,
    targetNamespace: string,
    group: string,
    keys: string[],
    overwrite: boolean
  ): Promise<void> => {
    // 首先获取源配置
    const sourceConfigs = await configAPI.loadConfigs(sourceNamespace, group);
    const configsToClone = sourceConfigs.filter((config) =>
      keys.includes(config.key)
    );

    // 逐个克隆配置
    for (const config of configsToClone) {
      try {
        await fetch(
          `${API_BASE}/namespaces/${targetNamespace}/groups/${group}/configs/${config.key}`,
          {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ value: config.value, type: config.type }),
          }
        );
      } catch (error) {
        if (!overwrite) {
          // 如果不允许覆盖，跳过已存在的配置
          continue;
        }
        throw error;
      }
    }
  },
};

// 命名空间管理API
export const namespaceAPI = {
  // 加载命名空间列表
  loadNamespaces: async (): Promise<string[]> => {
    const response = await fetch(`${API_BASE}/namespaces`, {
      headers: getHeaders(),
    });

    return handleResponse<string[]>(response);
  },

  // 创建命名空间
  createNamespace: async (name: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/namespaces`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name }),
    });

    return handleResponse<void>(response);
  },

  // 删除命名空间
  deleteNamespace: async (name: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/namespaces/${name}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });

    return handleResponse<void>(response);
  },
};

// 用户管理API
export const userAPI = {
  // 加载用户列表
  loadUsers: async (): Promise<User[]> => {
    const response = await fetch(`${API_BASE}/users`, {
      headers: getHeaders(),
    });

    return handleResponse<User[]>(response);
  },

  // 创建用户
  createUser: async (user: {
    username: string;
    password: string;
    role: 'admin' | 'user';
    status: 'active' | 'inactive';
  }): Promise<User> => {
    const response = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(user),
    });

    return handleResponse<User>(response);
  },

  // 更新用户
  updateUser: async (
    username: string,
    user: {
      password?: string;
      role: 'admin' | 'user';
      status: 'active' | 'inactive';
    }
  ): Promise<User> => {
    const response = await fetch(`${API_BASE}/users/${username}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(user),
    });

    return handleResponse<User>(response);
  },

  // 删除用户
  deleteUser: async (username: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/users/${username}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });

    return handleResponse<void>(response);
  },
};
