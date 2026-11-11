import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const Layout: React.FC = () => {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { label: 'Overview', path: '/' },
    { label: 'Incidents', path: '/incidents' },
    { label: 'Settings', path: '/settings' },
  ];

  return (
    <div className="layout-container">
      {/* 232px Left Rail */}
      <aside className={`rail ${mobileMenuOpen ? 'open' : ''}`}>
        {/* Brand Wordmark with SVG Pulse-Line Mark */}
        <div className="brand-header">
          <div className="brand-mark" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M2 13H6L9 5L14 19L17 11L19 13H22"
                stroke="var(--color-accent)"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span className="brand-name">UpWatch</span>
        </div>

        {/* Navigation */}
        <nav className="rail-nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User Menu at Bottom */}
        <div className="user-menu">
          <div className="user-info">
            <div className="user-name">{user?.name || 'Student'}</div>
            <div className="user-email">{user?.email}</div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="sign-out-btn"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Top Bar for Mobile (< 900px) */}
      <header className="mobile-header">
        <div className="brand-header">
          <div className="brand-mark" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M2 13H6L9 5L14 19L17 11L19 13H22"
                stroke="var(--color-accent)"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span className="brand-name">UpWatch</span>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-expanded={mobileMenuOpen}
          aria-label="Toggle navigation menu"
          className="mobile-menu-btn"
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>
      </header>

      {/* Main Content Area */}
      <main className="main-content">
        <div className="content-inner">
          <Outlet />
        </div>
      </main>

      <style>{`
        .layout-container {
          display: flex;
          min-height: 100vh;
          background-color: var(--color-paper);
        }
        .rail {
          width: var(--rail-width);
          min-width: var(--rail-width);
          background-color: var(--color-surface);
          border-right: 1px solid var(--color-line);
          display: flex;
          flex-direction: column;
          position: sticky;
          top: 0;
          height: 100vh;
          padding: 24px 16px;
          z-index: 100;
        }
        .brand-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 8px 24px 8px;
        }
        .brand-mark {
          display: flex;
          align-items: center;
          justifyContent: center;
        }
        .brand-name {
          font-size: var(--text-lg);
          font-weight: 600;
          letter-spacing: -0.3px;
          color: var(--color-ink);
        }
        .rail-nav {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
        }
        .nav-link {
          display: block;
          padding: 8px 12px;
          border-radius: var(--radius-md);
          font-size: var(--text-sm);
          font-weight: 500;
          color: var(--color-muted);
          text-decoration: none;
          transition: background-color 0.15s ease, color 0.15s ease;
        }
        .nav-link:hover {
          background-color: var(--color-paper);
          color: var(--color-ink);
        }
        .nav-link.active {
          background-color: var(--color-paper);
          color: var(--color-accent);
          font-weight: 600;
        }
        .user-menu {
          padding-top: 16px;
          border-top: 1px solid var(--color-line);
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .user-info {
          padding: 0 4px;
        }
        .user-name {
          font-size: var(--text-sm);
          font-weight: 600;
          color: var(--color-ink);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .user-email {
          font-size: var(--text-xs);
          color: var(--color-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sign-out-btn {
          width: 100%;
          padding: 6px 12px;
          background: transparent;
          border: 1px solid var(--color-line);
          border-radius: var(--radius-md);
          font-size: var(--text-xs);
          font-weight: 500;
          color: var(--color-muted);
          cursor: pointer;
          text-align: center;
          transition: border-color 0.15s ease, color 0.15s ease;
        }
        .sign-out-btn:hover {
          color: var(--color-ink);
          border-color: var(--color-muted);
        }
        .mobile-header {
          display: none;
        }
        .main-content {
          flex: 1;
          min-width: 0;
          padding: 32px 40px;
        }
        .content-inner {
          max-width: var(--max-content-width);
          margin: 0;
        }
        @media (max-width: 900px) {
          .layout-container {
            flex-direction: column;
          }
          .mobile-header {
            display: flex;
            align-items: center;
            justifyContent: space-between;
            padding: 12px 20px;
            background-color: var(--color-surface);
            border-bottom: 1px solid var(--color-line);
            position: sticky;
            top: 0;
            z-index: 200;
          }
          .mobile-header .brand-header {
            padding: 0;
          }
          .mobile-menu-btn {
            background: none;
            border: none;
            font-size: 20px;
            color: var(--color-ink);
            cursor: pointer;
            padding: 4px;
          }
          .rail {
            display: none;
            position: fixed;
            top: 53px;
            left: 0;
            right: 0;
            width: 100%;
            height: calc(100vh - 53px);
            z-index: 150;
            border-right: none;
          }
          .rail.open {
            display: flex;
          }
          .main-content {
            padding: 20px 16px;
          }
        }
      `}</style>
    </div>
  );
};
