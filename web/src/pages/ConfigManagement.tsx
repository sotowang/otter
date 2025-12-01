import React, { useState, useEffect } from 'react';
import AppLayout from '../components/Layout/AppLayout';
import ConfigList from '../components/Config/ConfigList';
import ConfigForm from '../components/Config/ConfigForm';
import Modal from '../components/Common/Modal';
import { useAuth } from '../hooks/useAuth';
import { useConfig } from '../hooks/useConfig';
import type { Config, ConfigHistory } from '../types';
import { namespaceAPI } from '../services/api';

const ConfigManagement: React.FC = () => {
  useAuth();
  const configHook = useConfig();
  const {
    configs,
    isLoading,
    configHistory,
    isHistoryLoading,
    loadConfigs,
    saveConfig,
    deleteConfig,
    viewHistory,
    rollbackConfig,
  } = configHook;

  // 状态管理
  const [namespace, setNamespace] = useState('public');
  const [group, setGroup] = useState('DEFAULT_GROUP');
  const [namespaces, setNamespaces] = useState<string[]>(['public']);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('Create Config');
  const [selectedConfig, setSelectedConfig] = useState<Config | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedHistoryConfig, setSelectedHistoryConfig] = useState<Config | null>(null);
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
  const [sourceNamespace, setSourceNamespace] = useState('public');
  const [targetNamespace, setTargetNamespace] = useState('');
  const [selectedConfigKeys, setSelectedConfigKeys] = useState<string[]>([]);
  const [overwriteConfigs, setOverwriteConfigs] = useState(false);
  const [isCloneLoading, setIsCloneLoading] = useState(false);

  // 加载命名空间列表
  useEffect(() => {
    const fetchNamespaces = async () => {
      try {
        const nsList = await namespaceAPI.loadNamespaces();
        setNamespaces(nsList);
      } catch (error) {
        console.error('Failed to load namespaces:', error);
      }
    };
    fetchNamespaces();
  }, []);

  // 当namespace或group变化时自动加载配置
  useEffect(() => {
    loadConfigs(namespace, group);
  }, [namespace, group, loadConfigs]);

  // 加载配置列表（保留手动加载功能）
  const handleLoadConfigs = () => {
    loadConfigs(namespace, group);
  };

  // 打开创建配置模态框
  const openCreateConfigModal = () => {
    setSelectedConfig(null);
    setModalTitle('Create Config');
    setIsModalOpen(true);
  };

  // 打开编辑配置模态框
  const openEditConfigModal = (config: Config) => {
    setSelectedConfig(config);
    setModalTitle('Edit Config');
    setIsModalOpen(true);
  };

  // 关闭配置模态框
  const closeCreateConfigModal = () => {
    setIsModalOpen(false);
    setSelectedConfig(null);
  };

  // 保存配置
  const handleSaveConfig = async (
    config: Omit<Config, 'version' | 'created_at' | 'updated_at'>
  ) => {
    const success = await saveConfig(config.namespace, group, config.key, config.value, config.type);
    if (success) {
      closeCreateConfigModal();
      // 如果保存成功，并且当前显示的是保存的namespace，重新加载配置
      if (config.namespace === namespace) {
        loadConfigs(namespace, group);
      }
    }
  };

  // 显示配置历史
  const handleShowHistory = (config: Config) => {
    viewHistory(namespace, group, config.key);
    setSelectedHistoryConfig(config);
    setIsHistoryModalOpen(true);
  };

  // 关闭历史模态框
  const closeHistoryModal = () => {
    setIsHistoryModalOpen(false);
    setSelectedHistoryConfig(null);
  };

  // 回滚配置
  const handleRollbackConfig = (version: number) => {
    if (selectedHistoryConfig) {
      rollbackConfig(namespace, group, selectedHistoryConfig.key, version);
      closeHistoryModal();
    }
  };

  // 删除配置
  const handleDeleteConfig = (config: Config) => {
    if (window.confirm(`Are you sure you want to delete ${config.key}?`)) {
      deleteConfig(namespace, group, config.key);
    }
  };

  // 打开克隆配置模态框
  const openCloneConfigModal = () => {
    setSourceNamespace(namespace);
    setTargetNamespace('');
    setSelectedConfigKeys([]);
    setOverwriteConfigs(false);
    setIsCloneModalOpen(true);
  };

  // 关闭克隆配置模态框
  const closeCloneConfigModal = () => {
    setIsCloneModalOpen(false);
  };

  // 处理克隆配置
  const handleCloneConfigs = async () => {
    if (!sourceNamespace || !targetNamespace || selectedConfigKeys.length === 0) {
      return;
    }

    setIsCloneLoading(true);
    try {
      const success = await configHook.cloneConfigs(sourceNamespace, targetNamespace, group, selectedConfigKeys, overwriteConfigs);
      if (success) {
        closeCloneConfigModal();
        // 如果克隆到当前命名空间，重新加载配置
        if (targetNamespace === namespace) {
          loadConfigs(namespace, group);
        }
      }
    } catch (error) {
      console.error('Failed to clone configs:', error);
    } finally {
      setIsCloneLoading(false);
    }
  };

  // 处理配置选择
  const handleConfigSelection = (key: string, isSelected: boolean) => {
    setSelectedConfigKeys(prev => {
      if (isSelected) {
        return [...prev, key];
      } else {
        return prev.filter(k => k !== key);
      }
    });
  };

  // 选择所有配置
  const selectAllConfigs = () => {
    const allKeys = configs.map(cfg => cfg.key);
    setSelectedConfigKeys(allKeys);
  };

  // 取消选择所有配置
  const deselectAllConfigs = () => {
    setSelectedConfigKeys([]);
  };

  return (
    <div className="config-management-container">
      <h2>Config Management</h2>
      <div className="filters">
        <div className="filter-group">
          <label htmlFor="namespace">Namespace:</label>
          <select
            id="namespace"
            value={namespace}
            onChange={(e) => setNamespace(e.target.value)}
          >
            {namespaces.map((ns) => (
              <option key={ns} value={ns}>
                {ns}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="group">Group:</label>
          <input
            type="text"
            id="group"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
          />
        </div>
        <button onClick={handleLoadConfigs} className="btn btn-primary">
          Load Configs
        </button>
      </div>

      <div className="configs-section">
        <div className="configs-header">
          <h3>Configs</h3>
          <div className="config-actions">
            <button
              type="button"
              onClick={openCreateConfigModal}
              className="btn btn-primary"
            >
              Create Config
            </button>
            <button type="button" onClick={openCloneConfigModal} className="btn btn-primary">
              Clone Configs
            </button>
          </div>
        </div>
        <ConfigList
          configs={configs}
          isLoading={isLoading}
          onEdit={openEditConfigModal}
          onHistory={handleShowHistory}
          onDelete={handleDeleteConfig}
        />
      </div>

      {/* 创建/编辑配置模态框 */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeCreateConfigModal}
        title={modalTitle}
      >
        <ConfigForm
          initialConfig={selectedConfig}
          onSave={handleSaveConfig}
          namespaces={namespaces}
          currentNamespace={namespace}
        />
        <div className="modal-footer">
          <button
            type="button"
            className="cancel-btn"
            onClick={closeCreateConfigModal}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="configForm"
            className="save-btn"
          >
            Save
          </button>
        </div>
      </Modal>

      {/* 配置历史模态框 */}
      <Modal
        isOpen={isHistoryModalOpen}
        onClose={closeHistoryModal}
        title={`Config History: ${selectedHistoryConfig?.key}`}
      >
        <table id="historyTable">
          <thead>
            <tr>
              <th>Version</th>
              <th>Value</th>
              <th>Op Type</th>
              <th>Date</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {isHistoryLoading ? (
              <tr>
                <td
                  colSpan={5}
                  style={{ textAlign: 'center', color: '#999', padding: '20px' }}
                >
                  <span className="loading"></span> Loading history...
                </td>
              </tr>
            ) : configHistory.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  style={{ textAlign: 'center', color: '#999', padding: '20px' }}
                >
                  No history found
                </td>
              </tr>
            ) : (
              configHistory.map((history: ConfigHistory) => (
                <tr key={history.version}>
                  <td>{history.version}</td>
                  <td>{history.value}</td>
                  <td>{history.op_type}</td>
                  <td>{new Date(history.created_at).toLocaleString()}</td>
                  <td>
                    {history.op_type !== 'DELETE' && (
                      <button
                        onClick={() => handleRollbackConfig(history.version)}
                      >
                        Rollback
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="modal-footer">
          <button
            type="button"
            className="cancel-btn"
            onClick={closeHistoryModal}
          >
            Close
          </button>
        </div>
      </Modal>

      {/* 克隆配置模态框 */}
      <Modal
        isOpen={isCloneModalOpen}
        onClose={closeCloneConfigModal}
        title="Clone Configs"
      >
        <div className="clone-modal-content">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="sourceNamespace">Source Namespace:</label>
              <select
                id="sourceNamespace"
                value={sourceNamespace}
                onChange={(e) => setSourceNamespace(e.target.value)}
                className="form-control"
              >
                {namespaces.map((ns) => (
                  <option key={ns} value={ns}>
                    {ns}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="targetNamespace">Target Namespace:</label>
              <select
                id="targetNamespace"
                value={targetNamespace}
                onChange={(e) => setTargetNamespace(e.target.value)}
                className="form-control"
              >
                <option value="" disabled>
                  Select target namespace
                </option>
                {namespaces.map((ns) => (
                  <option key={ns} value={ns}>
                    {ns}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="group">Group:</label>
              <input
                type="text"
                id="group"
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                className="form-control"
                placeholder="Enter group name"
              />
            </div>
          </div>

          <div className="config-selection">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <label>Select Configs to Clone:</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={selectAllConfigs}
                  className="btn-small"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={deselectAllConfigs}
                  className="btn-small"
                >
                  Deselect All
                </button>
              </div>
            </div>
            
            <div className="config-list-container">
              {isLoading ? (
                <div style={{ textAlign: 'center', color: '#999', padding: '20px' }}>
                  <span className="loading"></span> Loading configs...
                </div>
              ) : configs.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#999', padding: '20px' }}>
                  No configs found
                </div>
              ) : (
                <div className="config-checkbox-list">
                  {configs.map((config) => (
                    <div key={config.key} className="config-checkbox-item">
                      <input
                        type="checkbox"
                        id={`clone_${config.key}`}
                        checked={selectedConfigKeys.includes(config.key)}
                        onChange={(e) => handleConfigSelection(config.key, e.target.checked)}
                      />
                      <label htmlFor={`clone_${config.key}`}>
                        <div className="config-info">
                          <div className="config-key">{config.key}</div>
                          <div className="config-value">{config.value}</div>
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                id="overwriteConfigs"
                checked={overwriteConfigs}
                onChange={(e) => setOverwriteConfigs(e.target.checked)}
              />
              <label htmlFor="overwriteConfigs" style={{ marginBottom: '0' }}>
                Overwrite existing configs
              </label>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="cancel-btn"
            onClick={closeCloneConfigModal}
          >
            Cancel
          </button>
          <button
            type="button"
            className="save-btn"
            onClick={handleCloneConfigs}
            disabled={isCloneLoading || selectedConfigKeys.length === 0 || !targetNamespace}
          >
            {isCloneLoading ? (
              <>
                <span className="loading"></span> Cloning...
              </>
            ) : (
              'Clone'
            )}
          </button>
        </div>
      </Modal>


    </div>
  );
};

export default ConfigManagement;
