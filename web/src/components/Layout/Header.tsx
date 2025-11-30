import React from 'react';

interface HeaderProps {
  username: string;
  onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ username, onLogout }) => {
  return (
    <header className="header">
      <h1>Otter Config Center</h1>
      <div className="header-actions">
        <span className="username-display">Welcome, {username}</span>
        <button onClick={onLogout}>Logout</button>
      </div>
    </header>
  );
};

export default Header;
