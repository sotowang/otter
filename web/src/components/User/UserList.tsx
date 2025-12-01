import React, { useState, useEffect } from 'react';
import type { User } from '../../types';
import { userAPI } from '../../services/api';
import Modal from '../Common/Modal';

interface UserListProps {
  onEditUser: (user: User) => void;
  onAddUser: () => void;
  refreshTrigger: number;
}

const UserList: React.FC<UserListProps> = ({ onEditUser, onAddUser, refreshTrigger }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [searchParams, setSearchParams] = useState({
    username: '',
    role: '',
    status: '',
  });
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [deleteTarget, setDeleteTarget] = useState<'single' | 'multiple' | null>(null);
  const [userToDelete, setUserToDelete] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [usersPerPage] = useState<number>(10);

  // 加载用户列表
  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await userAPI.loadUsers();
      setUsers(data);
      setFilteredUsers(data);
      setError('');
    } catch (err) {
      setError('Failed to load users');
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [refreshTrigger]);

  // 筛选用户
  useEffect(() => {
    let result = [...users];

    if (searchParams.username) {
      result = result.filter(user =>
        user.username.toLowerCase().includes(searchParams.username.toLowerCase())
      );
    }

    if (searchParams.role) {
      result = result.filter(user => user.role === searchParams.role);
    }

    if (searchParams.status) {
      result = result.filter(user => user.status === searchParams.status);
    }

    setFilteredUsers(result);
    // 确保currentPage不超过总页数
    const totalPages = Math.ceil(result.length / usersPerPage);
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    } else if (totalPages === 0) {
      setCurrentPage(1);
    }
  }, [searchParams, users, currentPage, usersPerPage]);

  // 处理搜索参数变化
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setSearchParams(prev => ({ ...prev, [name]: value }));
  };

  // 处理单个用户删除
  const handleDeleteUser = (username: string) => {
    setUserToDelete(username);
    setDeleteTarget('single');
    setShowDeleteModal(true);
  };

  // 处理批量删除
  const handleBatchDelete = () => {
    if (selectedUsers.length === 0) return;
    setDeleteTarget('multiple');
    setShowDeleteModal(true);
  };

  // 确认删除
  const confirmDelete = async () => {
    try {
      if (deleteTarget === 'single' && userToDelete) {
        await userAPI.deleteUser(userToDelete);
      } else if (deleteTarget === 'multiple') {
        for (const username of selectedUsers) {
          await userAPI.deleteUser(username);
        }
      }
      setShowDeleteModal(false);
      setSelectedUsers([]);
      loadUsers(); // 重新加载用户列表
    } catch (err) {
      setError('Failed to delete user(s)');
      console.error('Failed to delete user(s):', err);
    }
  };

  // 处理用户选择
  const handleUserSelect = (username: string) => {
    setSelectedUsers(prev => {
      if (prev.includes(username)) {
        return prev.filter(u => u !== username);
      } else {
        return [...prev, username];
      }
    });
  };

  // 处理全选/取消全选
  const handleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map(user => user.username));
    }
  };

  // 分页逻辑
  const indexOfLastUser = currentPage * usersPerPage;
  const indexOfFirstUser = indexOfLastUser - usersPerPage;
  const currentUsers = filteredUsers.slice(indexOfFirstUser, indexOfLastUser);
  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  return (
    <div className="user-list-container">
      {/* 搜索筛选区域 */}
      <div className="search-filter-section">
        <div className="search-fields">
          <div className="search-field">
            <label htmlFor="username">Username:</label>
            <input
              type="text"
              id="username"
              name="username"
              value={searchParams.username}
              onChange={handleSearchChange}
              placeholder="Search by username"
            />
          </div>
          <div className="search-field">
            <label htmlFor="role">Role:</label>
            <select
              id="role"
              name="role"
              value={searchParams.role}
              onChange={handleSearchChange}
            >
              <option value="">All</option>
              <option value="admin">Admin</option>
              <option value="user">User</option>
            </select>
          </div>
          <div className="search-field">
            <label htmlFor="status">Status:</label>
            <select
              id="status"
              name="status"
              value={searchParams.status}
              onChange={handleSearchChange}
            >
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* 操作按钮区域 */}
      <div className="action-buttons">
        <button className="btn btn-primary" onClick={onAddUser}>
          Add User
        </button>
        <button
          className="btn btn-danger"
          onClick={handleBatchDelete}
          disabled={selectedUsers.length === 0}
        >
          Delete Selected ({selectedUsers.length})
        </button>
      </div>

      {/* 用户列表 */}
      {loading ? (
        <div className="loading">Loading...</div>
      ) : error ? (
        <div className="error">{error}</div>
      ) : (
        <div className="table-container">
          <table className="user-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                    onChange={handleSelectAll}
                  />
                </th>
                <th>Username</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created At</th>
                <th>Updated At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="no-data">
                    No users found
                  </td>
                </tr>
              ) : (
                currentUsers.map(user => (
                  <tr key={user.username}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.username)}
                        onChange={() => handleUserSelect(user.username)}
                      />
                    </td>
                    <td>{user.username}</td>
                    <td>
                      <span className={`role-badge role-${user.role}`}>
                        {user.role}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge status-${user.status}`}>
                        {user.status}
                      </span>
                    </td>
                    <td>{new Date(user.created_at).toLocaleString()}</td>
                    <td>{new Date(user.updated_at).toLocaleString()}</td>
                    <td>
                      <div className="action-buttons-small">
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => onEditUser(user)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDeleteUser(user.username)}
                          disabled={user.username === 'admin'}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="btn btn-sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            Previous
          </button>
          <span className="page-info">
            Page {currentPage} of {totalPages}
          </span>
          <button
            className="btn btn-sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </div>
      )}

      {/* 删除确认模态框 */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Confirm Delete"
      >
        <div className="modal-content">
          <p>
            {deleteTarget === 'single' 
              ? `Are you sure you want to delete user "${userToDelete}"?`
              : `Are you sure you want to delete ${selectedUsers.length} selected users?`
            }
          </p>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </button>
            <button className="btn btn-danger" onClick={confirmDelete}>
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default UserList;