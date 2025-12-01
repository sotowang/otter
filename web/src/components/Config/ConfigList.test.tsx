import { render, screen, fireEvent } from '@testing-library/react';
import ConfigList from './ConfigList';
import type { Config } from '../../types';

// 模拟配置数据
const mockConfigs: Config[] = [
  {
    namespace: 'public',
    group: 'DEFAULT_GROUP',
    key: 'test_key_1',
    value: 'test_value_1',
    type: 'text',
    version: 1,
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
  },
  {
    namespace: 'public',
    group: 'DEFAULT_GROUP',
    key: 'test_key_2',
    value: 'test_value_2',
    type: 'json',
    version: 2,
    created_at: '2023-01-02T00:00:00Z',
    updated_at: '2023-01-02T00:00:00Z',
  },
];

// 模拟回调函数
const mockOnEdit = jest.fn();
const mockOnHistory = jest.fn();
const mockOnDelete = jest.fn();

describe('ConfigList Component', () => {
  // 重置模拟函数
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders loading state when isLoading is true', () => {
    render(
      <ConfigList
        configs={[]}
        isLoading={true}
        onEdit={mockOnEdit}
        onHistory={mockOnHistory}
        onDelete={mockOnDelete}
      />
    );

    // 检查加载文本是否显示
    expect(screen.getByText(/Loading configs.../i)).toBeInTheDocument();
  });

  test('renders empty state when configs is empty and isLoading is false', () => {
    render(
      <ConfigList
        configs={[]}
        isLoading={false}
        onEdit={mockOnEdit}
        onHistory={mockOnHistory}
        onDelete={mockOnDelete}
      />
    );

    // 检查空状态文本是否显示
    expect(screen.getByText(/No configs found/i)).toBeInTheDocument();
  });

  test('renders config list when configs is not empty', () => {
    render(
      <ConfigList
        configs={mockConfigs}
        isLoading={false}
        onEdit={mockOnEdit}
        onHistory={mockOnHistory}
        onDelete={mockOnDelete}
      />
    );

    // 检查配置项是否显示
    expect(screen.getByText('test_key_1')).toBeInTheDocument();
    expect(screen.getByText('test_value_1')).toBeInTheDocument();
    expect(screen.getByText('text')).toBeInTheDocument();
    expect(screen.getByText('test_key_2')).toBeInTheDocument();
    expect(screen.getByText('test_value_2')).toBeInTheDocument();
    expect(screen.getByText('json')).toBeInTheDocument();
  });

  test('calls onEdit when Edit button is clicked', () => {
    render(
      <ConfigList
        configs={mockConfigs}
        isLoading={false}
        onEdit={mockOnEdit}
        onHistory={mockOnHistory}
        onDelete={mockOnDelete}
      />
    );

    // 点击第一个配置项的Edit按钮
    const editButtons = screen.getAllByText('Edit');
    fireEvent.click(editButtons[0]);

    // 检查onEdit是否被调用，并且传递了正确的配置项
    expect(mockOnEdit).toHaveBeenCalledTimes(1);
    expect(mockOnEdit).toHaveBeenCalledWith(mockConfigs[0]);
  });

  test('calls onHistory when History button is clicked', () => {
    render(
      <ConfigList
        configs={mockConfigs}
        isLoading={false}
        onEdit={mockOnEdit}
        onHistory={mockOnHistory}
        onDelete={mockOnDelete}
      />
    );

    // 点击第一个配置项的History按钮
    const historyButtons = screen.getAllByText('History');
    fireEvent.click(historyButtons[0]);

    // 检查onHistory是否被调用，并且传递了正确的配置项
    expect(mockOnHistory).toHaveBeenCalledTimes(1);
    expect(mockOnHistory).toHaveBeenCalledWith(mockConfigs[0]);
  });

  test('calls onDelete when Delete button is clicked', () => {
    render(
      <ConfigList
        configs={mockConfigs}
        isLoading={false}
        onEdit={mockOnEdit}
        onHistory={mockOnHistory}
        onDelete={mockOnDelete}
      />
    );

    // 点击第一个配置项的Delete按钮
    const deleteButtons = screen.getAllByText('Delete');
    fireEvent.click(deleteButtons[0]);

    // 检查onDelete是否被调用，并且传递了正确的配置项
    expect(mockOnDelete).toHaveBeenCalledTimes(1);
    expect(mockOnDelete).toHaveBeenCalledWith(mockConfigs[0]);
  });
});
