import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() && password.trim()) {
      await login(username, password);
    }
  };

  return (
    <div id="loginSection" className="container">
      <div className="login-box">
        <h2>Otter Config Center</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username:</label>
            <input
              type="text"
              id="username"
              placeholder="Enter username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password:</label>
            <input
              type="password"
              id="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
            />
          </div>
          {error && (
            <div
              style={{
                color: '#ff4d4f',
                marginBottom: '16px',
                fontSize: '14px',
              }}
            >
              {error}
            </div>
          )}
          <button type="submit" className="save-btn" disabled={isLoading}>
            {isLoading ? (
              <>
                <span className="loading"></span> Logging in...
              </>
            ) : (
              'Login'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
