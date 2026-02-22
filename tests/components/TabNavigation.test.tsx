/**
 * Unit tests for TabNavigation component
 *
 * Tests tab navigation functionality, keyboard accessibility, and visual states
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TabNavigation } from '@/popup/components/TabNavigation';

describe('TabNavigation', () => {
  describe('rendering', () => {
    it('should render both tabs', () => {
      const mockOnTabChange = vi.fn();
      render(
        <TabNavigation activeTab="libraries" onTabChange={mockOnTabChange} />
      );

      expect(screen.getByText('Workout Libraries')).toBeInTheDocument();
      expect(screen.getByText('Training Plans')).toBeInTheDocument();
    });

    it('should highlight active libraries tab', () => {
      const mockOnTabChange = vi.fn();
      render(
        <TabNavigation activeTab="libraries" onTabChange={mockOnTabChange} />
      );

      const librariesTab = screen.getByRole('button', {
        name: 'Workout Libraries',
      });
      expect(librariesTab).toHaveClass('border-blue-500');
      expect(librariesTab).toHaveClass('text-blue-600');
    });

    it('should highlight active plans tab', () => {
      const mockOnTabChange = vi.fn();
      render(<TabNavigation activeTab="plans" onTabChange={mockOnTabChange} />);

      const plansTab = screen.getByRole('button', { name: 'Training Plans' });
      expect(plansTab).toHaveClass('border-blue-500');
      expect(plansTab).toHaveClass('text-blue-600');
    });

    it('should show inactive styling for non-active tabs', () => {
      const mockOnTabChange = vi.fn();
      render(
        <TabNavigation activeTab="libraries" onTabChange={mockOnTabChange} />
      );

      const plansTab = screen.getByRole('button', { name: 'Training Plans' });
      expect(plansTab).toHaveClass('border-transparent');
      expect(plansTab).toHaveClass('text-gray-600');
    });
  });

  describe('interactions', () => {
    it('should call onTabChange when libraries tab clicked', async () => {
      const user = userEvent.setup();
      const mockOnTabChange = vi.fn();
      render(<TabNavigation activeTab="plans" onTabChange={mockOnTabChange} />);

      const librariesTab = screen.getByRole('button', {
        name: 'Workout Libraries',
      });
      await user.click(librariesTab);

      expect(mockOnTabChange).toHaveBeenCalledWith('libraries');
      expect(mockOnTabChange).toHaveBeenCalledTimes(1);
    });

    it('should call onTabChange when plans tab clicked', async () => {
      const user = userEvent.setup();
      const mockOnTabChange = vi.fn();
      render(
        <TabNavigation activeTab="libraries" onTabChange={mockOnTabChange} />
      );

      const plansTab = screen.getByRole('button', { name: 'Training Plans' });
      await user.click(plansTab);

      expect(mockOnTabChange).toHaveBeenCalledWith('plans');
      expect(mockOnTabChange).toHaveBeenCalledTimes(1);
    });

    it('should not call onTabChange when clicking active tab', async () => {
      const user = userEvent.setup();
      const mockOnTabChange = vi.fn();
      render(
        <TabNavigation activeTab="libraries" onTabChange={mockOnTabChange} />
      );

      const librariesTab = screen.getByRole('button', {
        name: 'Workout Libraries',
      });
      await user.click(librariesTab);

      expect(mockOnTabChange).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA roles', () => {
      const mockOnTabChange = vi.fn();
      render(
        <TabNavigation activeTab="libraries" onTabChange={mockOnTabChange} />
      );

      const librariesTab = screen.getByRole('button', {
        name: 'Workout Libraries',
      });
      const plansTab = screen.getByRole('button', { name: 'Training Plans' });

      expect(librariesTab).toHaveAttribute('role', 'button');
      expect(plansTab).toHaveAttribute('role', 'button');
    });

    it('should mark active tab with aria-selected', () => {
      const mockOnTabChange = vi.fn();
      render(
        <TabNavigation activeTab="libraries" onTabChange={mockOnTabChange} />
      );

      const librariesTab = screen.getByRole('button', {
        name: 'Workout Libraries',
      });
      expect(librariesTab).toHaveAttribute('aria-selected', 'true');
    });

    it('should mark inactive tab with aria-selected false', () => {
      const mockOnTabChange = vi.fn();
      render(
        <TabNavigation activeTab="libraries" onTabChange={mockOnTabChange} />
      );

      const plansTab = screen.getByRole('button', { name: 'Training Plans' });
      expect(plansTab).toHaveAttribute('aria-selected', 'false');
    });

    it('should support keyboard navigation with Enter key', async () => {
      const user = userEvent.setup();
      const mockOnTabChange = vi.fn();
      render(
        <TabNavigation activeTab="libraries" onTabChange={mockOnTabChange} />
      );

      const plansTab = screen.getByRole('button', { name: 'Training Plans' });
      plansTab.focus();
      await user.keyboard('{Enter}');

      expect(mockOnTabChange).toHaveBeenCalledWith('plans');
    });

    it('should support keyboard navigation with Space key', async () => {
      const user = userEvent.setup();
      const mockOnTabChange = vi.fn();
      render(
        <TabNavigation activeTab="libraries" onTabChange={mockOnTabChange} />
      );

      const plansTab = screen.getByRole('button', { name: 'Training Plans' });
      plansTab.focus();
      await user.keyboard(' ');

      expect(mockOnTabChange).toHaveBeenCalledWith('plans');
    });
  });
});
