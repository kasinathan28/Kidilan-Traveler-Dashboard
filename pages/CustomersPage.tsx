import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppContext } from '../contexts/AppContext';
import { Customer, CustomerDetail, CustomerStats, CustomerStatusFilter } from '../types';
import { getCustomers, getCustomerStats, getCustomer, setCustomerBlocked, deleteCustomer } from '../api/mockApi';
import { useDebounce } from '../hooks/useDebounce';
import { usePageSize } from '../hooks/usePageSize';
import Pagination from '../components/Pagination';
import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmationModal from '../components/ConfirmationModal';
import { DeleteIcon, StarIcon, XIcon } from '../components/icons';

// Shop customers: people who made an account on the storefront (Google or email + password).
// The admin can look them up, see their orders and reviews, block them or delete the account.

const STATUS_TABS: { key: CustomerStatusFilter; label: string }[] = [
  { key: '', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'blocked', label: 'Blocked' },
];

const fmtDate = (v?: string) =>
  v ? new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

const fmtAgo = (v?: string) => {
  if (!v) return 'Never';
  const days = Math.floor((Date.now() - new Date(v).getTime()) / 864e5);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  return fmtDate(v);
};

const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(n) || 0);

const Avatar: React.FC<{ c: Customer; size?: string }> = ({ c, size = 'w-10 h-10' }) => {
  const [broken, setBroken] = useState(false);
  const initial = (c.name || c.email || '?').trim().charAt(0).toUpperCase();
  return c.avatarUrl && !broken ? (
    <img src={c.avatarUrl} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} className={`${size} rounded-full object-cover flex-shrink-0`} />
  ) : (
    <span className={`${size} rounded-full bg-[#2D7A79] text-white font-bold flex items-center justify-center flex-shrink-0`} aria-hidden="true">
      {initial}
    </span>
  );
};

const ProviderBadge: React.FC<{ provider?: string }> = ({ provider }) =>
  provider === 'google' ? (
    <span className="px-2 py-0.5 text-[11px] font-semibold bg-blue-50 text-blue-700 rounded-full">Google</span>
  ) : (
    <span className="px-2 py-0.5 text-[11px] font-semibold bg-gray-100 text-gray-700 rounded-full">Email</span>
  );

const StatusBadge: React.FC<{ blocked: boolean }> = ({ blocked }) =>
  blocked ? (
    <span className="px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide bg-red-100 text-red-700 rounded-full">Blocked</span>
  ) : (
    <span className="px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide bg-green-100 text-green-800 rounded-full">Active</span>
  );

const StatCard: React.FC<{ label: string; value: React.ReactNode; hint?: string }> = ({ label, value, hint }) => (
  <div className="bg-white p-5 rounded-xl shadow-md">
    <p className="text-sm text-gray-500">{label}</p>
    <div className="mt-1 text-2xl font-bold text-gray-800">{value}</div>
    {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
  </div>
);

const ORDER_STATUS_STYLE: Record<string, string> = {
  delivered: 'bg-green-100 text-green-800',
  shipped: 'bg-blue-100 text-blue-800',
  out_for_delivery: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-red-100 text-red-700',
  returned: 'bg-red-100 text-red-700',
  refunded: 'bg-gray-200 text-gray-700',
};

// Right-hand panel: one customer's profile, orders and reviews, plus the block / delete actions.
const CustomerDrawer: React.FC<{
  customerId: string | null;
  busy: boolean;
  onClose: () => void;
  onToggleBlock: (c: Customer) => void;
  onDelete: (c: Customer) => void;
  refreshKey: number;
}> = ({ customerId, busy, onClose, onToggleBlock, onDelete, refreshKey }) => {
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!customerId) return;
    let alive = true;
    setError(null);
    setDetail((d) => (d && d.customer._id === customerId ? d : null));
    getCustomer(customerId)
      .then((d) => alive && setDetail(d))
      .catch((e) => alive && setError(e?.message || 'Could not load this customer.'));
    return () => {
      alive = false;
    };
  }, [customerId, refreshKey]);

  useEffect(() => {
    if (!customerId) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [customerId, onClose]);

  if (!customerId) return null;
  const c = detail?.customer;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="customer-drawer-title">
      <div className="absolute inset-0 bg-black bg-opacity-40" onClick={onClose} aria-hidden="true" />
      <aside className="relative h-full w-full max-w-md bg-white shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
          <h2 id="customer-drawer-title" className="text-lg font-bold text-gray-800">Customer</h2>
          <button type="button" onClick={onClose} className="p-1 text-gray-500 hover:text-gray-800" aria-label="Close">
            <XIcon className="w-6 h-6" />
          </button>
        </div>

        {error && <p className="p-6 text-red-600">{error}</p>}
        {!error && !c && (
          <div className="py-20 flex justify-center">
            <LoadingSpinner />
          </div>
        )}

        {c && detail && (
          <div className="p-6 space-y-8">
            <section className="flex items-start gap-4">
              <Avatar c={c} size="w-14 h-14" />
              <div className="min-w-0">
                <p className="text-lg font-bold text-gray-800 break-words">{c.name}</p>
                <p className="text-sm text-gray-500 break-all">{c.email || 'No email'}</p>
                {c.phone && <p className="text-sm text-gray-500">{c.phone}</p>}
                <div className="mt-2 flex flex-wrap gap-2">
                  <StatusBadge blocked={c.isBlocked} />
                  <ProviderBadge provider={c.authProvider} />
                </div>
              </div>
            </section>

            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-gray-500">Joined</dt>
                <dd className="font-semibold text-gray-800">{fmtDate(c.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Last sign-in</dt>
                <dd className="font-semibold text-gray-800">{fmtAgo(c.lastSignInAt)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">In bag now</dt>
                <dd className="font-semibold text-gray-800">{c.counts.cart} {c.counts.cart === 1 ? 'item' : 'items'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Wishlist</dt>
                <dd className="font-semibold text-gray-800">{c.counts.wishlist} saved</dd>
              </div>
            </dl>

            <section>
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3">Orders ({c.counts.orders})</h3>
              {detail.orders.length === 0 ? (
                <p className="text-sm text-gray-500">No orders while signed in.</p>
              ) : (
                <ul className="divide-y border rounded-lg">
                  {detail.orders.map((o) => (
                    <li key={o._id} className="px-4 py-3 flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800 truncate">{o.orderNumber || o._id.slice(0, 8)}</p>
                        <p className="text-gray-500">{fmtDate(o.placedAt || o.createdAt)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-800">{inr(o.totalAmount)}</p>
                        <span className={`inline-block mt-0.5 px-2 py-0.5 text-[11px] font-semibold rounded-full capitalize ${ORDER_STATUS_STYLE[o.status] || 'bg-amber-100 text-amber-800'}`}>
                          {o.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3">Reviews ({c.counts.reviews})</h3>
              {detail.reviews.length === 0 ? (
                <p className="text-sm text-gray-500">No reviews yet.</p>
              ) : (
                <ul className="space-y-3">
                  {detail.reviews.map((r) => (
                    <li key={r._id} className="border rounded-lg p-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex" aria-label={`${r.rating} out of 5`}>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <StarIcon key={n} className={`w-4 h-4 ${n <= r.rating ? 'text-amber-400' : 'text-gray-200'}`} />
                          ))}
                        </span>
                        <span className="text-gray-400">{fmtDate(r.createdAt)}</span>
                        {!r.isPublished && (
                          <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-gray-200 text-gray-600 rounded-full">Hidden</span>
                        )}
                      </div>
                      <p className="mt-1.5 text-gray-600 line-clamp-3 whitespace-pre-line">{r.comment}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="border-t pt-6 space-y-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => onToggleBlock(c)}
                className={`w-full px-5 py-2.5 rounded-lg font-semibold disabled:opacity-60 ${
                  c.isBlocked ? 'bg-[#2D7A79] text-white hover:bg-opacity-90' : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                }`}
              >
                {c.isBlocked ? 'Unblock account' : 'Block account'}
              </button>
              <p className="text-xs text-gray-500">
                {c.isBlocked
                  ? 'Unblocking lets them sign in, order, review and sync their bag again.'
                  : 'Blocked customers cannot sign in, and the shop refuses their account at once. Their orders and reviews stay.'}
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => onDelete(c)}
                className="w-full px-5 py-2.5 rounded-lg font-semibold text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-60"
              >
                Delete account
              </button>
            </section>
          </div>
        )}
      </aside>
    </div>
  );
};

const CustomersPage: React.FC = () => {
  const { searchQuery, showToast } = useContext(AppContext);
  const debouncedSearch = useDebounce(searchQuery, 400);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize('customers');
  const [status, setStatus] = useState<CustomerStatusFilter>('');
  const [sort, setSort] = useState('newest');

  const [openId, setOpenId] = useState<string | null>(null);
  const [drawerKey, setDrawerKey] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmBlock, setConfirmBlock] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState<Customer | null>(null);

  const filterKey = `${debouncedSearch}|${status}|${sort}|${pageSize}`;
  const lastFilterKey = useRef(filterKey);
  const requestId = useRef(0);

  const loadStats = useCallback(async () => {
    try {
      setStats(await getCustomerStats());
    } catch {
      /* the list still works without the totals */
    }
  }, []);

  const loadCustomers = useCallback(
    async (pageToFetch: number) => {
      const id = ++requestId.current;
      setIsLoading(true);
      setError(null);
      try {
        const data = await getCustomers({
          page: pageToFetch,
          limit: pageSize,
          search: debouncedSearch.trim() || undefined,
          status,
          sort,
        });
        if (id !== requestId.current) return;
        setCustomers(data.customers);
        setTotal(data.totalCount);
        const lastPage = Math.max(Math.ceil(data.totalCount / pageSize), 1);
        if (pageToFetch > lastPage) setPage(lastPage);
      } catch (err: any) {
        if (id !== requestId.current) return;
        setError(err?.message || 'Failed to load customers. Please try again.');
      } finally {
        if (id === requestId.current) setIsLoading(false);
      }
    },
    [debouncedSearch, status, sort, pageSize]
  );

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (lastFilterKey.current !== filterKey) {
      lastFilterKey.current = filterKey;
      if (page !== 1) {
        setPage(1);
        return;
      }
    }
    loadCustomers(page);
  }, [page, filterKey, loadCustomers]);

  const applyBlock = async (c: Customer, isBlocked: boolean) => {
    setBusyId(c._id);
    try {
      const saved = await setCustomerBlocked(c._id, isBlocked);
      setCustomers((prev) => prev.map((x) => (x._id === c._id ? { ...x, ...saved } : x)));
      setDrawerKey((k) => k + 1);
      showToast(isBlocked ? `${c.name} is blocked.` : `${c.name} can sign in again.`);
      loadStats();
    } catch (err: any) {
      showToast(err?.message || 'Could not change this account.');
    } finally {
      setBusyId(null);
    }
  };

  // Blocking asks first; unblocking does not.
  const toggleBlock = (c: Customer) => (c.isBlocked ? applyBlock(c, false) : setConfirmBlock(c));

  const confirmDelete = async () => {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    setBusyId(target._id);
    try {
      await deleteCustomer(target._id);
      showToast(`${target.name}'s account is deleted.`);
      if (openId === target._id) setOpenId(null);
      loadStats();
      loadCustomers(page);
    } catch (err: any) {
      showToast(err?.message || 'Could not delete this account.');
    } finally {
      setBusyId(null);
    }
  };

  const statusCount = (key: CustomerStatusFilter) => {
    if (!stats) return null;
    return key === '' ? stats.total : key === 'blocked' ? stats.blocked : stats.total - stats.blocked;
  };

  const renderRows = () => {
    if (isLoading && customers.length === 0) {
      return (
        <tr>
          <td colSpan={7} className="text-center py-16">
            <LoadingSpinner />
          </td>
        </tr>
      );
    }
    if (error) {
      return (
        <tr>
          <td colSpan={7} className="text-center py-16 text-red-500">{error}</td>
        </tr>
      );
    }
    if (customers.length === 0) {
      return (
        <tr>
          <td colSpan={7} className="text-center py-16 text-gray-500">
            {debouncedSearch.trim() || status ? 'No customers match these filters.' : 'No one has made an account yet.'}
          </td>
        </tr>
      );
    }
    return customers.map((c) => (
      <tr key={c._id} className={`border-b transition-colors hover:bg-gray-50 ${c.isBlocked ? 'bg-gray-50' : 'bg-white'}`}>
        <td data-label="Customer" className="px-4 py-4">
          <button type="button" onClick={() => setOpenId(c._id)} className="flex items-center gap-3 text-left group min-w-[200px]">
            <Avatar c={c} />
            <span className="min-w-0">
              <span className="block font-semibold text-gray-800 group-hover:text-[#2D7A79] group-hover:underline truncate">{c.name}</span>
              <span className="block text-gray-500 truncate">{c.email || 'No email'}</span>
            </span>
          </button>
        </td>
        <td data-label="Sign-in" className="px-4 py-4">
          <ProviderBadge provider={c.authProvider} />
        </td>
        <td data-label="Joined" className="px-4 py-4 whitespace-nowrap">{fmtDate(c.createdAt)}</td>
        <td data-label="Last seen" className="px-4 py-4 whitespace-nowrap">{fmtAgo(c.lastSignInAt)}</td>
        <td data-label="Orders / reviews" className="px-4 py-4 whitespace-nowrap">
          <span className="font-semibold text-gray-800">{c.counts.orders}</span> orders · {c.counts.reviews} reviews
        </td>
        <td data-label="Status" className="px-4 py-4">
          <StatusBadge blocked={c.isBlocked} />
        </td>
        <td data-label="Actions" className="px-4 py-4">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setOpenId(c._id)}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold text-[#2D7A79] hover:bg-gray-100"
            >
              View
            </button>
            <button
              type="button"
              disabled={busyId === c._id}
              onClick={() => toggleBlock(c)}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            >
              {c.isBlocked ? 'Unblock' : 'Block'}
            </button>
            <button
              type="button"
              disabled={busyId === c._id}
              onClick={() => setDeleting(c)}
              className="p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
              aria-label={`Delete ${c.name}'s account`}
            >
              <DeleteIcon className="w-5 h-5" />
            </button>
          </div>
        </td>
      </tr>
    ));
  };

  const selectClass = 'p-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#2D7A79] focus:outline-none';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Customers" value={stats ? stats.total : '-'} hint="Accounts made on the shop" />
        <StatCard label="New in 30 days" value={stats ? stats.newLast30 : '-'} />
        <StatCard
          label="Signed up with Google"
          value={stats ? stats.google : '-'}
          hint={stats && stats.total ? `${Math.round((stats.google / stats.total) * 100)}% of accounts` : undefined}
        />
        <StatCard label="Blocked" value={stats ? stats.blocked : '-'} hint="Cannot sign in" />
      </div>

      <div className="bg-white p-4 sm:p-6 rounded-xl shadow-md">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-5">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by status">
            {STATUS_TABS.map((t) => {
              const n = statusCount(t.key);
              const active = status === t.key;
              return (
                <button
                  key={t.key || 'all'}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setStatus(t.key)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    active ? 'bg-[#2D7A79] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {t.label}
                  {n !== null && <span className={`ml-2 text-xs ${active ? 'text-white/80' : 'text-gray-500'}`}>{n}</span>}
                </button>
              );
            })}
          </div>
          <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)} className={selectClass}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="lastSeen">Recently signed in</option>
            <option value="name">Name A-Z</option>
          </select>
        </div>

        <div className="overflow-x-auto responsive-table">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
              <tr>
                <th scope="col" className="px-4 py-3">Customer</th>
                <th scope="col" className="px-4 py-3">Sign-in</th>
                <th scope="col" className="px-4 py-3">Joined</th>
                <th scope="col" className="px-4 py-3">Last seen</th>
                <th scope="col" className="px-4 py-3">Activity</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className={isLoading && customers.length > 0 ? 'opacity-60' : ''}>{renderRows()}</tbody>
          </table>
        </div>

        {!error && total > 0 && (
          <Pagination currentPage={page} totalCount={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
        )}
      </div>

      <CustomerDrawer
        customerId={openId}
        refreshKey={drawerKey}
        busy={!!openId && busyId === openId}
        onClose={() => setOpenId(null)}
        onToggleBlock={toggleBlock}
        onDelete={(c) => setDeleting(c)}
      />

      <ConfirmationModal
        isOpen={!!confirmBlock}
        onClose={() => setConfirmBlock(null)}
        onConfirm={() => {
          const c = confirmBlock;
          setConfirmBlock(null);
          if (c) applyBlock(c, true);
        }}
        title="Block this customer?"
        message={
          confirmBlock
            ? `${confirmBlock.name} (${confirmBlock.email || 'no email'}) will be signed out and cannot sign in, order with this account, or write reviews. You can unblock them later.`
            : ''
        }
      />

      <ConfirmationModal
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Delete this account?"
        message={
          deleting
            ? `${deleting.name}'s account (${deleting.email || 'no email'}) is removed for good, with their saved bag and wishlist. Their orders and reviews stay but are no longer linked to anyone. This cannot be undone.`
            : ''
        }
      />
    </div>
  );
};

export default CustomersPage;
