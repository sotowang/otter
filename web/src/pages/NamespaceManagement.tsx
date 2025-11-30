import React, { useState, useEffect } from 'react';
import AppLayout from '../components/Layout/AppLayout';
import Modal from '../components/Common/Modal';
import { useAuth } from '../hooks/useAuth';
import { useNamespace } from '../hooks/useNamespace';

const NamespaceManagement: React.FC = () => {
  const { username, logout } = useAuth();
  const {
    namespaces,
    isLoading,
    loadNamespaces,
    createNamespace,
    deleteNamespace,
  } = useNamespace();

  // 状态管理
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newNamespace, setNewNamespace] = useState('');
  const [namespaceError, setNamespaceError] = useState('');

  // 加载命名空间列表
  useEffect(() => {
    loadNamespaces();
  }, [loadNamespaces]);

  // 打开创建命名空间模态框
  const openCreateNamespaceModal = () => {
    setIsModalOpen(true);
    setNewNamespace('');
    setNamespaceError('');
  };

  // 关闭创建命名空间模态框
  const closeCreateNamespaceModal = () => {
    setIsModalOpen(false);
    setNewNamespace('');
    setNamespaceError('');
  };

  // 验证命名空间名称
  const validateNamespaceName = (name: string): boolean => {
    if (!name.trim()) {
      setNamespaceError('Namespace name cannot be empty');
      return false;
    }

    // 验证命名空间名称格式（字母数字、下划线和连字符）
    const nameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!nameRegex.test(name)) {
      setNamespaceError(
        'Namespace name can only contain alphanumeric characters, underscores, and hyphens'
      );
      return false;
    }

    setNamespaceError('');
    return true;
  };

  // 处理创建命名空间
  const handleCreateNamespace = async () => {
    if (validateNamespaceName(newNamespace)) {
      const success = await createNamespace(newNamespace.trim());
      if (success) {
        closeCreateNamespaceModal();
      }
    }
  };

  // 处理删除命名空间
  const handleDeleteNamespace = async (namespace: string) => {
    if (
      window.confirm(
        `Are you sure you want to delete namespace "${namespace}"?`
      )
    ) {
      await deleteNamespace(namespace);
    }
  };

  // 渲染命名空间列表
  const renderNamespaces = () => {
    if (isLoading) {
      return (
        <tr>
          <td
            colSpan={3}
            style={{ textAlign: 'center', color: '#999', padding: '40px' }}
          >
            <span className="loading"></span> Loading namespaces...
          </td>
        </tr>
      );
    }

    if (namespaces.length === 0) {
      return (
        <tr>
          <td
            colSpan={3}
            style={{ textAlign: 'center', color: '#999', padding: '40px' }}
          >
            No namespaces found
          </td>
        </tr>
      );
    }

    return namespaces.map((ns) => {
      const isDefault = ns === 'public';
      return (
        <tr key={ns}>
          <td>
            <div className="namespace-info">
              <span className="namespace-name">{ns}</span>
              {isDefault && (
                <span className="namespace-tag default-tag">Default</span>
              )}
            </div>
          </td>
          <td>
            <span className="status-badge active">Active</span>
          </td>
          <td className="actions">
            {isDefault ? (
              <button disabled className="disabled-btn">
                Default
              </button>
            ) : (
              <button
                onClick={() => handleDeleteNamespace(ns)}
                className="delete-btn"
              >
                Delete
              </button>
            )}
          </td>
        </tr>
      );
    });
  };

  return (
    <>
      <div id="namespace-management-section" className="content-section">
        <div className="section-header">
          <h2>Namespace Management</h2>
          <p>Manage your configuration namespaces</p>
        </div>

        <div className="card namespace-card existing-namespaces-card">
          <div className="card-header">
            <h3>Existing Namespaces</h3>
            <button
              type="button"
              onClick={openCreateNamespaceModal}
              className="save-btn"
            >
              Create Namespace
            </button>
          </div>
          <div className="card-body">
            <div className="table-container">
              <table id="namespaceTable" className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>{renderNamespaces()}</tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* 创建命名空间模态框 */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeCreateNamespaceModal}
        title="Create New Namespace"
      >
        <form id="createNamespaceForm">
          <div className="form-group">
            <label htmlFor="newNamespace">Namespace Name</label>
            <input
              type="text"
              id="newNamespace"
              className="form-control"
              placeholder="Enter namespace name"
              value={newNamespace}
              onChange={(e) => setNewNamespace(e.target.value)}
            />
            {namespaceError && (
              <div
                id="namespaceError"
                className="error-message"
                style={{
                  color: '#ff4d4f',
                  fontSize: '12px',
                  marginTop: '4px',
                  display: 'block',
                }}
              >
                {namespaceError}
              </div>
            )}
          </div>
        </form>
        <div className="modal-footer">
          <button
            type="button"
            className="cancel-btn"
            onClick={closeCreateNamespaceModal}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreateNamespace}
            className="save-btn"
          >
            Create
          </button>
        </div>
      </Modal>
    </>
  );
};

export default NamespaceManagement;
