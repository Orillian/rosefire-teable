import { BaseNodeResourceType } from '@teable/openapi';
import type * as SdkHooks from '@teable/sdk/hooks';
import { render, screen } from '@/test-utils';
import { DashboardOperation } from './BaseNodeMore';

// DashboardOperation (and BaseNodeTree's canCreateDashboard) compute their
// rename/duplicate/create affordances from base permissions only. Neither
// consults the admin `disallowDashboard` setting anymore - see P7
// ("re-enable dashboard creation - neutralize disallowDashboard"). These
// tests guard against that gate being silently reintroduced.
const permissionMock = vi.hoisted(() => ({ current: {} as Record<string, boolean> }));

vi.mock('@teable/sdk/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof SdkHooks>();
  return {
    ...actual,
    useBasePermission: () => permissionMock.current,
  };
});

describe('DashboardOperation dashboard-create/duplicate gating (P7 regression)', () => {
  it('allows rename/duplicate purely from base|update permission', () => {
    permissionMock.current = { 'base|update': true };

    render(
      <DashboardOperation
        resourceType={BaseNodeResourceType.Dashboard}
        resourceId="dsbTest0000000001"
        open
        setOpen={vi.fn()}
      >
        <button type="button">trigger</button>
      </DashboardOperation>
    );

    expect(screen.getByText('table:import.menu.duplicate')).toBeInTheDocument();
    expect(screen.getByText('table:table.rename')).toBeInTheDocument();
  });

  it('hides rename/duplicate when base|update permission is absent, regardless of any dashboard setting', () => {
    permissionMock.current = {};

    render(
      <DashboardOperation
        resourceType={BaseNodeResourceType.Dashboard}
        resourceId="dsbTest0000000002"
        open
        setOpen={vi.fn()}
      >
        <button type="button">trigger</button>
      </DashboardOperation>
    );

    expect(screen.queryByText('table:import.menu.duplicate')).not.toBeInTheDocument();
    expect(screen.queryByText('table:table.rename')).not.toBeInTheDocument();
  });
});
