import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { type SortingState } from '@tanstack/react-table';
import { Plus, Search, Users } from 'lucide-react';
import { paths } from '@/config/paths.config';
import { useUsersQuery, type UserRole } from '../../lib/query';
import { UserRoleFilter } from '../../components/user-role-filter';
import { UsersDataTable } from '../../components/users-data-table';
import { SiteHeader } from '@/components/site-header';
import { buttonVariants } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Input } from '@/components/ui/input';

const PAGE_SIZE = 20;

export default function UsersIndexPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get('search') ?? '';
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'));
  const roles = searchParams.getAll('roles') as UserRole[];
  const sortBy = searchParams.get('sortBy') ?? '';
  const sortOrder = (searchParams.get('sortOrder') ?? 'asc') as 'asc' | 'desc';

  const sorting: SortingState = sortBy
    ? [{ id: sortBy, desc: sortOrder === 'desc' }]
    : [];

  const [draft, setDraft] = useState(search);
  useEffect(() => {
    setDraft(search);
  }, [search]);

  const { data, isLoading, isError, isFetching } = useUsersQuery({
    page,
    limit: PAGE_SIZE,
    search,
    roles,
    sortBy,
    sortOrder,
  });

  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;

  function commitSearch(value: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      value ? next.set('search', value) : next.delete('search');
      next.set('page', '1');
      return next;
    });
  }

  function handleRolesChange(next: UserRole[]) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.delete('roles');
      next.forEach((r) => params.append('roles', r));
      params.set('page', '1');
      return params;
    });
  }

  function handleSortingChange(next: SortingState) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (next.length > 0) {
        params.set('sortBy', next[0].id);
        params.set('sortOrder', next[0].desc ? 'desc' : 'asc');
      } else {
        params.delete('sortBy');
        params.delete('sortOrder');
      }
      params.set('page', '1');
      return params;
    });
  }

  function handlePageChange(p: number) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('page', String(p));
      return next;
    });
  }

  return (
    <div>
      <SiteHeader>
        <Link to={paths.core.userNew} className={buttonVariants()}>
          <Plus className="size-4" />
          Add user
        </Link>
      </SiteHeader>

      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="ps-9 w-64"
              placeholder="Search… (Enter)"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitSearch(draft.trim());
                if (e.key === 'Escape') {
                  setDraft('');
                  commitSearch('');
                }
              }}
            />
          </div>
          <UserRoleFilter value={roles} onChange={handleRolesChange} />
        </div>

        {isError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            Failed to load users. Please try again.
          </div>
        ) : !isLoading && data?.data.length === 0 ? (
          <Empty className="border py-16">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Users />
              </EmptyMedia>
              <EmptyTitle>
                {search || roles.length > 0
                  ? 'No users match your filters'
                  : 'No users yet'}
              </EmptyTitle>
              <EmptyDescription>
                {search || roles.length > 0
                  ? 'Try adjusting your search or role filter.'
                  : 'Get started by adding the first user.'}
              </EmptyDescription>
            </EmptyHeader>
            {!search && roles.length === 0 && (
              <EmptyContent>
                <Link to={paths.core.userNew} className={buttonVariants()}>
                  <Plus className="size-4" />
                  Add user
                </Link>
              </EmptyContent>
            )}
          </Empty>
        ) : (
          <UsersDataTable
            data={data?.data ?? []}
            isLoading={isLoading}
            isFetching={isFetching}
            sorting={sorting}
            onSortingChange={handleSortingChange}
            page={page}
            totalPages={totalPages}
            total={data?.total ?? 0}
            limit={data?.limit ?? PAGE_SIZE}
            onPageChange={handlePageChange}
          />
        )}
      </div>
    </div>
  );
}
