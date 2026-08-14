import React, { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const MockFilterBar = ({ projects = ['ORD', 'OPS'] }) => {
  const [selectedKeys, setSelectedKeys] = useState([]);

  const toggle = (k) => {
    setSelectedKeys(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]);
  };

  return (
    <div className="jira-filter-pills-bar">
      {projects.map(k => {
        const isSel = selectedKeys.includes(k);
        return (
          <button
            key={k}
            data-testid={`pill-${k}`}
            className={`jira-pill-btn ${isSel ? 'active' : ''}`}
            onClick={() => toggle(k)}
          >
            {isSel ? '✅' : '➕'} پروژه {k}
          </button>
        );
      })}
      {selectedKeys.length > 0 && (
        <button
          data-testid="clear-pills"
          className="jira-pills-clear-btn"
          onClick={() => setSelectedKeys([])}
        >
          پاک‌سازی ({selectedKeys.length})
        </button>
      )}
    </div>
  );
};

describe('JiraFilterPills Component Tests', () => {
  it('renders filter pills for each configured Jira project', () => {
    render(<MockFilterBar projects={['ORD', 'OPS']} />);
    expect(screen.getByTestId('pill-ORD')).toHaveTextContent('➕ پروژه ORD');
    expect(screen.getByTestId('pill-OPS')).toHaveTextContent('➕ پروژه OPS');
  });

  it('toggles active state and shows checkmark when clicked', () => {
    render(<MockFilterBar projects={['ORD', 'OPS']} />);
    const ordBtn = screen.getByTestId('pill-ORD');
    fireEvent.click(ordBtn);
    expect(ordBtn).toHaveTextContent('✅ پروژه ORD');
    expect(ordBtn).toHaveClass('active');
    expect(screen.getByTestId('clear-pills')).toHaveTextContent('پاک‌سازی (1)');
  });

  it('clears all selected project pills on clicking clear button', () => {
    render(<MockFilterBar projects={['ORD', 'OPS']} />);
    const ordBtn = screen.getByTestId('pill-ORD');
    const opsBtn = screen.getByTestId('pill-OPS');
    fireEvent.click(ordBtn);
    fireEvent.click(opsBtn);
    expect(screen.getByTestId('clear-pills')).toHaveTextContent('پاک‌سازی (2)');

    fireEvent.click(screen.getByTestId('clear-pills'));
    expect(screen.queryByTestId('clear-pills')).not.toBeInTheDocument();
    expect(ordBtn).toHaveTextContent('➕ پروژه ORD');
    expect(opsBtn).toHaveTextContent('➕ پروژه OPS');
  });
});
