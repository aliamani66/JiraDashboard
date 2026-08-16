import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MotionProvider, useMotion } from '../context/MotionContext';

const TestComponent = () => {
  const { reducedMotion, toggleReducedMotion } = useMotion();
  return (
    <div>
      <span data-testid="motion-status">{reducedMotion ? 'reduced' : 'normal'}</span>
      <button onClick={toggleReducedMotion} data-testid="toggle-btn">Toggle</button>
    </div>
  );
};

describe('MotionContext & Reduced Motion Mode', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-reduced-motion');
  });

  it('defaults to reduced motion (high performance mode) when localStorage is empty', () => {
    render(
      <MotionProvider>
        <TestComponent />
      </MotionProvider>
    );

    expect(screen.getByTestId('motion-status')).toHaveTextContent('reduced');
    expect(document.documentElement.getAttribute('data-reduced-motion')).toBe('true');
  });

  it('toggles reduced motion mode and persists in localStorage and html attribute', () => {
    render(
      <MotionProvider>
        <TestComponent />
      </MotionProvider>
    );

    const btn = screen.getByTestId('toggle-btn');
    fireEvent.click(btn);

    expect(screen.getByTestId('motion-status')).toHaveTextContent('normal');
    expect(document.documentElement.getAttribute('data-reduced-motion')).toBe('false');
    expect(localStorage.getItem('app-reduced-motion')).toBe('false');

    fireEvent.click(btn);
    expect(screen.getByTestId('motion-status')).toHaveTextContent('reduced');
    expect(document.documentElement.getAttribute('data-reduced-motion')).toBe('true');
    expect(localStorage.getItem('app-reduced-motion')).toBe('true');
  });
});
