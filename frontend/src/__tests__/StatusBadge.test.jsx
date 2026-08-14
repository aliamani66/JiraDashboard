import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatusBadge from '../components/common/StatusBadge';

describe('StatusBadge Component Tests', () => {
  it('renders Done status badge with correct text', () => {
    render(<StatusBadge status="Done" />);
    expect(screen.getByText(/انجام شده/i)).toBeInTheDocument();
  });

  it('renders In Progress status badge correctly', () => {
    render(<StatusBadge status="In Progress" />);
    expect(screen.getByText(/در حال انجام/i)).toBeInTheDocument();
  });

  it('renders Waiting / OnHold badge with waiting styling', () => {
    render(<StatusBadge status="Waiting" />);
    expect(screen.getByText(/در انتظار/i)).toBeInTheDocument();
  });

  it('renders To Do status badge correctly', () => {
    render(<StatusBadge status="To Do" />);
    expect(screen.getByText(/برای انجام/i)).toBeInTheDocument();
  });
});
