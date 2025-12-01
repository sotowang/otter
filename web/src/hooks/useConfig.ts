import { useState, useCallback } from 'react';
import type { Config, ConfigHistory } from '../types';
import { configAPI } from '../services/api';

interface ConfigState {
  configs: Config[];
  isLoading: boolean;
  error: string | null;
  selectedConfig: Config | null;
  configHistory: ConfigHistory[];
  isHistoryLoading: boolean;
}

export const useConfig = () => {
  const [configState, setConfigState] = useState<ConfigState>({
    configs: [],
    isLoading: false,
    error: null,
    selectedConfig: null,
    configHistory: [],
    isHistoryLoading: false,
  });

  // 加载配置列表
  const loadConfigs = useCallback(async (namespace: string, group: string) => {
    setConfigState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    try {
      const configs = await configAPI.loadConfigs(namespace, group);
      setConfigState((prev) => ({
        ...prev,
        configs: configs || [], // 确保始终是数组，即使API返回null
        isLoading: false,
      }));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to load configs';
      setConfigState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
    }
  }, []);

  // 保存配置
  const saveConfig = useCallback(
    async (
      namespace: string,
      group: string,
      key: string,
      value: string,
      type: string
    ) => {
      setConfigState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
      }));

      try {
        const updatedConfig = await configAPI.saveConfig(
          namespace,
          group,
          key,
          value,
          type
        );

        // 更新配置列表
        setConfigState((prev) => {
          const configIndex = prev.configs.findIndex(
            (cfg) =>
              cfg.namespace === namespace &&
              cfg.group === group &&
              cfg.key === key
          );

          let updatedConfigs;
          if (configIndex >= 0) {
            // 更新现有配置
            updatedConfigs = [...prev.configs];
            updatedConfigs[configIndex] = updatedConfig;
          } else {
            // 添加新配置
            updatedConfigs = [...prev.configs, updatedConfig];
          }

          return {
            ...prev,
            configs: updatedConfigs,
            isLoading: false,
          };
        });

        return true;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to save config';
        setConfigState((prev) => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
        }));

        return false;
      }
    },
    []
  );

  // 删除配置
  const deleteConfig = useCallback(
    async (namespace: string, group: string, key: string) => {
      setConfigState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
      }));

      try {
        await configAPI.deleteConfig(namespace, group, key);

        // 从配置列表中移除
        setConfigState((prev) => ({
          ...prev,
          configs: prev.configs.filter(
            (cfg) =>
              !(
                cfg.namespace === namespace &&
                cfg.group === group &&
                cfg.key === key
              )
          ),
          isLoading: false,
        }));

        return true;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to delete config';
        setConfigState((prev) => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
        }));

        return false;
      }
    },
    []
  );

  // 查看配置历史
  const viewHistory = useCallback(
    async (namespace: string, group: string, key: string) => {
      setConfigState((prev) => ({
        ...prev,
        isHistoryLoading: true,
        error: null,
      }));

      try {
        const history = await configAPI.getConfigHistory(namespace, group, key);
        setConfigState((prev) => ({
          ...prev,
          configHistory: history || [], // 确保始终是数组，即使API返回null
          isHistoryLoading: false,
        }));

        return true;
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to load config history';
        setConfigState((prev) => ({
          ...prev,
          isHistoryLoading: false,
          error: errorMessage,
        }));

        return false;
      }
    },
    []
  );

  // 回滚配置
  const rollbackConfig = useCallback(
    async (namespace: string, group: string, key: string, version: number) => {
      setConfigState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
      }));

      try {
        const updatedConfig = await configAPI.rollbackConfig(
          namespace,
          group,
          key,
          version
        );

        // 更新配置列表
        setConfigState((prev) => {
          const configIndex = prev.configs.findIndex(
            (cfg) =>
              cfg.namespace === namespace &&
              cfg.group === group &&
              cfg.key === key
          );

          let updatedConfigs;
          if (configIndex >= 0) {
            // 更新现有配置
            updatedConfigs = [...prev.configs];
            updatedConfigs[configIndex] = updatedConfig;
          } else {
            // 添加新配置（如果不存在）
            updatedConfigs = [...prev.configs, updatedConfig];
          }

          return {
            ...prev,
            configs: updatedConfigs,
            isLoading: false,
          };
        });

        return true;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to rollback config';
        setConfigState((prev) => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
        }));

        return false;
      }
    },
    []
  );

  // 克隆配置
  const cloneConfigs = useCallback(
    async (
      sourceNamespace: string,
      targetNamespace: string,
      group: string,
      keys: string[],
      overwrite: boolean
    ) => {
      setConfigState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
      }));

      try {
        await configAPI.cloneConfigs(
          sourceNamespace,
          targetNamespace,
          group,
          keys,
          overwrite
        );
        setConfigState((prev) => ({
          ...prev,
          isLoading: false,
        }));

        return true;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to clone configs';
        setConfigState((prev) => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
        }));

        return false;
      }
    },
    []
  );

  // 选择配置
  const selectConfig = useCallback((config: Config) => {
    setConfigState((prev) => ({
      ...prev,
      selectedConfig: config,
    }));
  }, []);

  // 清除选择
  const clearSelectedConfig = useCallback(() => {
    setConfigState((prev) => ({
      ...prev,
      selectedConfig: null,
    }));
  }, []);

  return {
    ...configState,
    loadConfigs,
    saveConfig,
    deleteConfig,
    viewHistory,
    rollbackConfig,
    cloneConfigs,
    selectConfig,
    clearSelectedConfig,
  };
};
