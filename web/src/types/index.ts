// 配置项类型
export interface Config {
  namespace: string;
  group: string;
  key: string;
  value: string;
  type: string;
  version: number;
  created_at: string;
  updated_at: string;
}

// 配置历史类型
export interface ConfigHistory {
  namespace: string;
  group: string;
  key: string;
  value: string;
  type: string;
  version: string; // 使用string类型以支持大整数，避免JavaScript number精度问题
  op_type: string;
  created_at: string;
}

// 用户类型
export interface User {
  id: number;
  username: string;
  password: string;
  role: 'admin' | 'user';
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

// 导航项类型
export interface NavItem {
  id: string;
  title: string;
  icon: string;
  path: string;
  subItems?: NavSubItem[];
}

export interface NavSubItem {
  id: string;
  title: string;
  path: string;
}

// 通知类型
export interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

// 模态框属性类型
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

// 加载组件属性类型
export interface LoadingProps {
  size?: 'small' | 'medium' | 'large';
  text?: string;
}
