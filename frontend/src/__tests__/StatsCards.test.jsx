import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import StatsCards from '../components/Dashboard/StatsCards';

describe('StatsCards KPI Component Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const mockStats = {
    totalProjects: 10,
    activeProjects: 6,
    stoppedProjects: 3,
    waitingTasks: 4
  };

  it('renders KPI cards with correct metric labels', () => {
    render(
      <MemoryRouter>
        <StatsCards stats={mockStats} />
      </MemoryRouter>
    );
    expect(screen.getByText(/کل پروژه‌ها/i)).toBeInTheDocument();
    expect(screen.getByText(/در حال انجام/i)).toBeInTheDocument();
    expect(screen.getByText(/پروژه‌های منتظر \/ بلوکه/i)).toBeInTheDocument();
    expect(screen.getByText(/اسپرینت‌های فعال/i)).toBeInTheDocument();
  });

  it('displays accurate KPI numerical values after counter animation', () => {
    render(
      <MemoryRouter>
        <StatsCards stats={mockStats} />
      </MemoryRouter>
    );

    act(() => {
      vi.advanceTimersByTime(1200);
    });

    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });
});
