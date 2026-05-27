import React, { useState, useEffect } from 'react';
import LoginPage from './components/LoginPage';
import MainApp from './components/MainApp';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem('mortgage_ai_token');
    if (stored) {
      setToken(stored);
      setIsAuthenticated(true);
    }
  }, []);

  function handleLogin(tok) {
    localStorage.setItem('mortgage_ai_token', tok);
    setToken(tok);
    setIsAuthenticated(true);
  }

  function handleLogout() {
    localStorage.removeItem('mortgage_ai_token');
    setToken(null);
    setIsAuthenticated(false);
  }

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return <MainApp token={token} onLogout={handleLogout} />;
}
