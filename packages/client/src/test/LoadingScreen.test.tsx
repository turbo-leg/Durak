import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoadingScreen } from '../components/LoadingScreen';

describe('LoadingScreen component', () => {
  it('renders the default connecting message', () => {
    render(<LoadingScreen />);
    expect(screen.getByText('Connecting to Server...')).toBeInTheDocument();
  });

  it('renders a custom message', () => {
    render(<LoadingScreen message="Waiting for players..." />);
    expect(screen.getByText('Waiting for players...')).toBeInTheDocument();
  });

  it('shows a spinner when not in error state', () => {
    const { container } = render(<LoadingScreen />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('hides the spinner in error state', () => {
    const { container } = render(<LoadingScreen isError />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).not.toBeInTheDocument();
  });

  it('applies red text in error state', () => {
    render(<LoadingScreen isError message="Connection failed" />);
    const heading = screen.getByText('Connection failed');
    expect(heading).toHaveClass('text-red-500');
  });

  it('shows retry button in error state', () => {
    render(<LoadingScreen isError />);
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('retry button reloads the page', async () => {
    const user = userEvent.setup();
    const reload = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { reload },
      writable: true,
    });

    render(<LoadingScreen isError />);
    await user.click(screen.getByRole('button', { name: /retry/i }));

    expect(reload).toHaveBeenCalledOnce();
  });

  it('does not show retry button when not in error state', () => {
    render(<LoadingScreen />);
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
  });
});
