import React, { useState, Suspense } from 'react';
import { useAuth } from './hooks/useAuth';
import Login from './components/Auth/Login';
import './styles/global.css';

// 使用React.lazy实现代码分割和懒加载
const ConfigManagement = React.lazy(() => import('./pages/ConfigManagement'));
const NamespaceManagement = React.lazy(
  () => import('./pages/NamespaceManagement')
);

const App: React.FC = () => {
  const { isAuthenticated, isLoading, username, logout } = useAuth();
  const [activePage, setActivePage] = useState('config-management');
  const [activeSubsection, setActiveSubsection] = useState('config-list');

  // 加载中状态
  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <div className="loading-spinner"></div>
        <span style={{ marginLeft: '10px', fontSize: '16px', color: '#666' }}>
          Loading...
        </span>
      </div>
    );
  }

  // 未认证状态显示登录页面
  if (!isAuthenticated) {
    return <Login />;
  }

  // 处理导航点击
  const handleNavClick = (section: string, subsection?: string) => {
    setActivePage(section);
    if (subsection) {
      setActiveSubsection(subsection);
    } else {
      setActiveSubsection('');
    }
  };

  // 已认证状态显示主应用
  return (
    <Suspense
      fallback={
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
          }}
        >
          <div className="loading-spinner"></div>
          <span style={{ marginLeft: '10px', fontSize: '16px', color: '#666' }}>
            Loading...
          </span>
        </div>
      }
    >
      <div id="mainContent">
        {/* Side Navigation */}
        <button
          className="mobile-menu-btn"
          onClick={() => {
            const sideNav = document.getElementById('sideNav');
            const mobileMenuBtn = document.getElementById('mobileMenuBtn');
            if (sideNav && mobileMenuBtn) {
              sideNav.classList.toggle('active');
              mobileMenuBtn.classList.toggle('active');
            }
          }}
          id="mobileMenuBtn"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        <nav className="side-nav" id="sideNav">
          <div className="nav-header">
            <h2>Otter Config</h2>
          </div>
          <ul className="nav-menu">
            <li className="nav-item">
              <a
                href="#"
                className={`nav-link ${activePage === 'config-management' ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick('config-management', 'config-list');
                }}
              >
                <span className="nav-icon">⚙️</span>
                <span className="nav-text">Config Management</span>
              </a>
              <ul className="nav-submenu">
                <li>
                  <a
                    href="#"
                    className={`nav-subitem ${activeSubsection === 'config-list' ? 'active' : ''}`}
                    onClick={(e) => {
                      e.preventDefault();
                      handleNavClick('config-management', 'config-list');
                    }}
                  >
                    Config List
                  </a>
                </li>
              </ul>
            </li>
            <li className="nav-item">
              <a
                href="#"
                className={`nav-link ${activePage === 'namespace-management' ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick('namespace-management');
                }}
              >
                <span className="nav-icon">📦</span>
                <span className="nav-text">Namespace Management</span>
              </a>
            </li>
          </ul>
        </nav>

        {/* Main Content Area */}
        <div className="main-content-area">
          {/* Header */}
          <div className="header">
            <h1>Otter Config Center</h1>
            <div className="header-actions">
              <span className="username-display">Welcome, {username}</span>
              <button onClick={logout} className="logout-btn">
                Logout
              </button>
            </div>
          </div>

          {/* Page Content */}
          {activePage === 'config-management' && <ConfigManagement />}
          {activePage === 'namespace-management' && <NamespaceManagement />}
        </div>
      </div>
    </Suspense>
  );
};

export default App;
