import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { render } from './test-utils';
import ViewToggle from './ViewToggle';

describe('ViewToggle', () => {
  it('changes views and ignores an empty selection', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ViewToggle value="list" onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Calendar view' }));
    expect(onChange).toHaveBeenCalledWith('calendar');
  });
});
