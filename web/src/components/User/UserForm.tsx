import React, { useState, useEffect } from 'react';
import type { User } from '../../types';

interface UserFormProps {
  user?: User;
  onSubmit: (userData: {
    username: string;
    password: string;
    role: 'admin' | 'user';
    status: 'active' | 'inactive';
  }) => void;
  onCancel: () => void;
}

const UserForm: React.FC<UserFormProps> = ({ user, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'user' as 'admin' | 'user',
    status: 'active' as 'active' | 'inactive',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // 当编辑用户时，初始化表单数据
  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username,
        password: '', // 编辑时密码可选
        role: user.role,
        status: user.status,
      });
    } else {
      // 添加新用户时重置表单
      setFormData({
        username: '',
        password: '',
        role: 'user',
        status: 'active',
      });
    }
    setErrors({});
  }, [user]);

  // 表单验证
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // 用户名验证
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    } else if (formData.username.length > 20) {
      newErrors.username = 'Username must be at most 20 characters';
    }

    // 密码验证
    if (!user && !formData.password.trim()) {
      // 添加新用户时密码必填
      newErrors.password = 'Password is required';
    } else if (formData.password && formData.password.length < 6) {
      // 编辑时如果填写密码，需要验证长度
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 处理表单字段变化
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // 清除对应字段的错误信息
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  // 处理表单提交
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      setIsSubmitting(true);
      onSubmit({
        username: formData.username,
        password: formData.password,
        role: formData.role,
        status: formData.status,
      });
      setIsSubmitting(false);
    }
  };

  return (
    <div className="user-form-container">
      <h3>{user ? 'Edit User' : 'Add New User'}</h3>
      <form onSubmit={handleSubmit} className="user-form">
        <div className="form-group">
          <label htmlFor="username">Username</label>
          <input
            type="text"
            id="username"
            name="username"
            value={formData.username}
            onChange={handleChange}
            disabled={!!user} // 编辑时用户名不可修改
            className={errors.username ? 'input-error' : ''}
          />
          {errors.username && (
            <div className="error-message">{errors.username}</div>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="password">
            Password {user ? '(Leave blank to keep current password)' : ''}
          </label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            className={errors.password ? 'input-error' : ''}
          />
          {errors.password && (
            <div className="error-message">{errors.password}</div>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="role">Role</label>
          <select
            id="role"
            name="role"
            value={formData.role}
            onChange={handleChange}
          >
            <option value="admin">Admin</option>
            <option value="user">User</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="status">Status</label>
          <select
            id="status"
            name="status"
            value={formData.status}
            onChange={handleChange}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : user ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default UserForm;
