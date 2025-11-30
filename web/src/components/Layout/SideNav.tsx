import React, { useState } from 'react';
import type { NavItem, NavSubItem } from '../../types';

interface SideNavProps {
  activeSection: string;
  activeSubsection: string;
  onNavClick: (section: string, subsection?: string) => void;
}

const SideNav: React.FC<SideNavProps> = ({
  activeSection,
  activeSubsection,
  onNavClick,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems: NavItem[] = [
    {
      id: 'config-management',
      title: 'Config Management',
      icon: '⚙️',
      path: '/config-management',
      subItems: [
        {
          id: 'config-list',
          title: 'Config List',
          path: '/config-management/config-list',
        },
      ],
    },
    {
      id: 'namespace-management',
      title: 'Namespace Management',
      icon: '📦',
      path: '/namespace-management',
    },
  ];

  const handleNavClick = (item: NavItem, subItem?: NavSubItem) => {
    if (subItem) {
      onNavClick(item.id, subItem.id);
    } else {
      onNavClick(item.id);
    }
    setIsMobileMenuOpen(false);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <>
      <button
        className={`mobile-menu-btn ${isMobileMenuOpen ? 'active' : ''}`}
        onClick={toggleMobileMenu}
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      <nav className={`side-nav ${isMobileMenuOpen ? 'active' : ''}`}>
        <div className="nav-header">
          <h2>Otter Config</h2>
        </div>
        <ul className="nav-menu">
          {navItems.map((item) => (
            <li key={item.id} className="nav-item">
              <a
                href="#"
                className={`nav-link ${activeSection === item.id ? 'active' : ''}`}
                onClick={() => handleNavClick(item)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-text">{item.title}</span>
              </a>
              {item.subItems && item.subItems.length > 0 && (
                <ul className="nav-submenu">
                  {item.subItems.map((subItem) => (
                    <li key={subItem.id}>
                      <a
                        href="#"
                        className={`nav-subitem ${activeSubsection === subItem.id ? 'active' : ''}`}
                        onClick={() => handleNavClick(item, subItem)}
                      >
                        {subItem.title}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
};

export default SideNav;
