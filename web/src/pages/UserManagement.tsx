import React, { useState } from 'react';
import UserList from '../components/User/UserList';
import UserForm from '../components/User/UserForm';
import Modal from '../components/Common/Modal';
import type { User } from '../types';
import { userAPI } from '../services/api';

const UserManagement: React.FC = () => {
  const [showFormModal, setShowFormModal] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<User | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  // 显示添加用户表单
  const handleAddUser = () => {
    setEditingUser(undefined);
    setShowFormModal(true);
  };

  // 显示编辑用户表单
  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setShowFormModal(true);
  };

  // 关闭表单
  const handleCloseForm = () => {
    setShowFormModal(false);
    setEditingUser(undefined);
  };

  // 处理表单提交
  const handleFormSubmit = async (userData: {
    username: string;
    password: string;
    role: 'admin' | 'user';
    status: 'active' | 'inactive';
  }) => {
    try {
      setLoading(true);
      setMessage(null);

      if (editingUser) {
        // 更新用户
        await userAPI.updateUser(editingUser.username, {
          password: userData.password,
          role: userData.role,
          status: userData.status,
        });
        setMessage({ type: 'success', text: 'User updated successfully' });
      } else {
        // 创建新用户
        await userAPI.createUser(userData);
        setMessage({ type: 'success', text: 'User created successfully' });
      }

      // 关闭表单并触发刷新
      setShowFormModal(false);
      setEditingUser(undefined);
      // 触发用户列表刷新
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Failed to save user:', error);
      setMessage({
        type: 'error',
        text: editingUser ? 'Failed to update user' : 'Failed to create user',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="user-management-container">
      <h2>User Management</h2>
      
      {/* 消息提示 */}
      {message && (
        <div className={`message message-${message.type}`}>
          {message.text}
        </div>
      )}

      {/* 用户列表 */}
      <UserList
        onEditUser={handleEditUser}
        onAddUser={handleAddUser}
        refreshTrigger={refreshTrigger}
      />

      {/* 用户表单模态框 */}
      <Modal
        isOpen={showFormModal}
        onClose={handleCloseForm}
        title={editingUser ? 'Edit User' : 'Add New User'}
      >
        <div className="modal-content">
          <UserForm
            user={editingUser}
            onSubmit={handleFormSubmit}
            onCancel={handleCloseForm}
          />
          {loading && <div className="loading-overlay">Loading...</div>}
        </div>
      </Modal>
    </div>
  );
};

export default UserManagement;