import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { render } from './test-utils';
import RoleBadge from './RoleBadge';

describe('RoleBadge', () => {
  it('does not label ordinary members', () => {
    const { container } = render(<RoleBadge role="MEMBER" />);
    expect(container).toBeEmptyDOMElement();
  });

  it.each(['ADMIN', 'TEACHER', 'VIEWER'] as const)('shows %s', (role) => {
    render(<RoleBadge role={role} />);
    expect(screen.getByText(role)).toBeInTheDocument();
  });
});
