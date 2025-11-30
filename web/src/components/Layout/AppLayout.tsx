import React, { useState } from 'react';
import Header from './Header';
import SideNav from './SideNav';

interface AppLayoutProps {
  username: string;
  onLogout: () => void;
  children: React.ReactNode;
  onPageChange: (page: string) => void;
}

const AppLayout: React.FC<AppLayoutProps> = ({
  username,
  onLogout,
  children,
}) => {
  const [activeSection, setActiveSection] = useState('config-management');
  const [activeSubsection, setActiveSubsection] = useState('config-list');

  const handleNavClick = (section: string, subsection?: string) => {
    setActiveSection(section);
    if (subsection) {
      setActiveSubsection(subsection);
    } else {
      setActiveSubsection('');
    }
    onPageChange(section);
  };

  return (
    <div id="mainContent">
      <SideNav
        activeSection={activeSection}
        activeSubsection={activeSubsection}
        onNavClick={handleNavClick}
      />
      <div className="main-content-area">
        <Header username={username} onLogout={onLogout} />
        {children}
      </div>
    </div>
  );
};

export default AppLayout;
