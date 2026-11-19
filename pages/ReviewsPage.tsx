import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppContext } from '../contexts/AppContext';
import { Review, ReviewStats, ReviewStatusFilter } from '../types';
import { getReviews, getReviewStats, updateReview, deleteReview } from '../api/mockApi';
import { useDebounce } from '../hooks/useDebounce';
import { usePageSize } from '../hooks/usePageSize';
import Pagination from '../components/Pagination';
import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmationModal from '../components/ConfirmationModal';
import { EditIcon, DeleteIcon, StarIcon, XIcon } from '../components/icons';


const STATUS_TABS: { key: ReviewStatusFilter; label: string }[] = [
  { key: '', label: 'All' },
  { key: 'published', label: 'Published' },
  { key: 'hidden', label: 'Hidden' },
  { key: 'featured', label: 'On home page' },
];

const Stars: React.FC<{ value: number; size?: string }> = ({ value, size = 'w-4 h-4' }) => (
  <span className="inline-flex" aria-label={`${value} out of 5`}>
    {[1, 2, 3, 4, 5].map((n) => (
      <StarIcon key={n} className={`${size} ${n <= Math.round(value) ? 'text-amber-400' : 'text-gray-200'}`} />
    ))}
  </span>
);

const Toggle: React.FC<{ checked: boolean; disabled?: boolean; onChange: () => void; label: string; title?: string }> = ({
  checked,
  disabled,
  onChange,
  label,
  title,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    title={title}
    disabled={disabled}
    onClick={onChange}
    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#2D7A79] focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40 ${
      checked ? 'bg-[#2D7A79]' : 'bg-gray-300'
    }`}
  >
    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
  </button>
);

const StatCard: React.FC<{ label: string; value: React.ReactNode; hint?: string }> = ({ label, value, hint }) => (
  <div className="bg-white p-5 rounded-xl shadow-md">
    <p className="text-sm text-gray-500">{label}</p>
    <div className="mt-1 text-2xl font-bold text-gray-800">{value}</div>
    {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
  </div>
);

// Edit a review's wording, name, rating and verified badge.
const EditReviewModal: React.FC<{
  review: Review | null;
  onClose: () => void;
  onSave: (patch: { name: string; comment: string; rating: number; isVerified: boolean }) => Promise<void>;
}> = ({ review, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [comment, setComment] = useState('');
  const [rating, setRating] = useState(5);
  const [isVerified, setIsVerified] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!review) return;
    setName(review.name || '');
    setComment(review.comment || '');
    setRating(review.rating);
    setIsVerified(!!review.isVerified);
    setError(null);
  }, [review]);

  useEffect(() => {
    if (!review) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [review, onClose]);

  if (!review) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) {
      setError('Review text cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      await onSave({ name: name.trim(), comment: comment.trim(), rating, isVerified });
    } catch (err: any) {
      setError(err?.message || 'Could not save the review.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" role="dialog" aria-modal="true" aria-labelledby="edit-review-title">
      <form onSubmit={submit} className="bg-white rounded-xl shadow-2xl p-6 sm:p-8 w-full max-w-lg relative">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800" aria-label="Close">
          <XIcon className="w-6 h-6" />
        </button>
        <h2 id="edit-review-title" className="text-xl font-bold text-gray-800">Edit review</h2>
        <p className="text-sm text-gray-500 mt-1 mb-5">For {review.product?.name || 'a deleted product'}</p>

        <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="rv-name">Reviewer name</label>
        <input
          id="rv-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D7A79] focus:outline-none mb-4"
        />

        <p className="block text-sm font-semibold text-gray-700 mb-1">Rating</p>
        <div className="flex gap-1 mb-4" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} star${n > 1 ? 's' : ''}`}
              onClick={() => setRating(n)}
              className="p-0.5 rounded focus:outline-none focus:ring-2 focus:ring-[#2D7A79]"
            >
              <StarIcon className={`w-7 h-7 ${n <= rating ? 'text-amber-400' : 'text-gray-200'}`} />
            </button>
          ))}
        </div>

        <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="rv-comment">Review</label>
        <textarea
          id="rv-comment"
          rows={5}
          value={comment}
          onChange={(e) => {
            setComment(e.target.value);
            if (error) setError(null);
          }}
          className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D7A79] focus:outline-none"
        />

        <label className="mt-4 flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={isVerified} onChange={(e) => setIsVerified(e.target.checked)} className="h-4 w-4 accent-[#2D7A79]" />
          Show the "Verified buyer" badge
        </label>

        {error && <p className="text-red-600 text-sm mt-3">{error}</p>}

        <div className="flex justify-end gap-3 mt-6">
          <button type="button" onClick={onClose} className="px-5 py-2 rounded-lg text-gray-700 bg-gray-200 hover:bg-gray-300 font-semibold">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="px-5 py-2 rounded-lg text-white font-semibold bg-[#2D7A79] hover:bg-opacity-90 disabled:opacity-60">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
};

const ReviewsPage: React.FC = () => {
  const { searchQuery, showToast } = useContext(AppContext);
  const debouncedSearch = useDebounce(searchQuery, 400);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize('reviews');
  const [status, setStatus] = useState<ReviewStatusFilter>('');
  const [productId, setProductId] = useState('');
  const [rating, setRating] = useState<number | ''>('');
  const [sort, setSort] = useState('newest');

  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Review | null>(null);
  const [deleting, setDeleting] = useState<Review | null>(null);

  // any change of filter, sort or rows per page goes back to page 1
  const filterKey = `${debouncedSearch}|${status}|${productId}|${rating}|${sort}|${pageSize}`;
  const lastFilterKey = useRef(filterKey);
  const requestId = useRef(0);

  const loadStats = useCallback(async () => {
    try {
      setStats(await getReviewStats());
    } catch {
      /* the list still works without the totals */
    }
  }, []);

  const loadReviews = useCallback(
    async (pageToFetch: number) => {
      const id = ++requestId.current;
      setIsLoading(true);
      setError(null);
      try {
        const data = await getReviews({
          page: pageToFetch,
          limit: pageSize,
          search: debouncedSearch.trim() || undefined,
          productId: productId || undefined,
          rating,
          status,
          sort,
        });
        if (id !== requestId.current) return;
        setReviews(data.reviews);
        setTotal(data.totalCount);
        const lastPage = Math.max(Math.ceil(data.totalCount / pageSize), 1);
        if (pageToFetch > lastPage) setPage(lastPage);
      } catch {
        if (id !== requestId.current) return;
        setError('Failed to load reviews. Please try again.');
      } finally {
        if (id === requestId.current) setIsLoading(false);
      }
    },
    [debouncedSearch, productId, rating, status, sort, pageSize]
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
    loadReviews(page);
  }, [page, filterKey, loadReviews]);

  // Optimistic change of one review, put back if the server says no.
  const patchReview = async (review: Review, patch: Partial<Review>, message: string) => {
    setBusyId(review._id);
    setReviews((prev) => prev.map((r) => (r._id === review._id ? { ...r, ...patch } : r)));
    try {
      const saved = await updateReview(review._id, patch);
      setReviews((prev) => prev.map((r) => (r._id === review._id ? { ...r, ...saved } : r)));
      showToast(message);
      loadStats();
    } catch (err: any) {
      setReviews((prev) => prev.map((r) => (r._id === review._id ? review : r)));
      showToast(err?.message || 'Could not update the review.');
    } finally {
      setBusyId(null);
    }
  };

  const togglePublished = (r: Review) =>
    patchReview(r, { isPublished: !r.isPublished }, r.isPublished ? 'Review hidden from the shop.' : 'Review published.');

  const toggleFeatured = (r: Review) =>
    patchReview(r, { isFeatured: !r.isFeatured }, r.isFeatured ? 'Removed from the home page.' : 'Review added to the home page.');

  const saveEdit = async (patch: { name: string; comment: string; rating: number; isVerified: boolean }) => {
    if (!editing) return;
    const saved = await updateReview(editing._id, patch);
    setReviews((prev) => prev.map((r) => (r._id === editing._id ? { ...r, ...saved } : r)));
    setEditing(null);
    showToast('Review saved.');
    loadStats();
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    setBusyId(target._id);
    try {
      await deleteReview(target._id);
      showToast('Review deleted.');
      loadStats();
      loadReviews(page);
    } catch (err: any) {
      showToast(err?.message || 'Could not delete the review.');
    } finally {
      setBusyId(null);
    }
  };

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const hasFilters = !!(productId || rating || status || debouncedSearch.trim());
  const resetFilters = () => {
    setProductId('');
    setRating('');
    setStatus('');
    setSort('newest');
  };

  const statusCount = (key: ReviewStatusFilter) => {
    if (!stats) return null;
    return key === '' ? stats.total : key === 'published' ? stats.published : key === 'hidden' ? stats.hidden : stats.featured;
  };

  const renderRows = () => {
    if (isLoading && reviews.length === 0) {
      return (
        <tr>
          <td colSpan={6} className="text-center py-16">
            <LoadingSpinner />
          </td>
        </tr>
      );
    }
    if (error) {
      return (
        <tr>
          <td colSpan={6} className="text-center py-16 text-red-500">{error}</td>
        </tr>
      );
    }
    if (reviews.length === 0) {
      return (
        <tr>
          <td colSpan={6} className="text-center py-16 text-gray-500">
            {hasFilters ? 'No reviews match these filters.' : 'No reviews yet.'}
          </td>
        </tr>
      );
    }
    return reviews.map((r) => {
      const long = (r.comment || '').length > 110;
      const open = expanded.has(r._id);
      const thumb = r.product?.imageThumbs?.[0] || r.product?.images?.[0];
      return (
        <tr key={r._id} className={`border-b transition-colors ${r.isPublished ? 'bg-white hover:bg-gray-50' : 'bg-gray-50'}`}>
          <td data-label="Product" className={`px-4 py-4 align-top ${r.isPublished ? '' : 'opacity-50'}`}>
            <div className="flex items-center gap-3 min-w-[140px] max-w-[220px]">
              <div className="w-12 h-12 rounded-lg border bg-white flex-shrink-0 overflow-hidden">
                {thumb && <img src={thumb} alt="" className="w-full h-full object-contain" />}
              </div>
              {r.product ? (
                <button
                  type="button"
                  onClick={() => setProductId(r.product!._id)}
                  className="text-left font-medium text-gray-800 hover:text-[#2D7A79] hover:underline"
                  title="Show only this product's reviews"
                >
                  {r.product.name}
                </button>
              ) : (
                <span className="italic">Deleted product</span>
              )}
            </div>
          </td>
          <td data-label="Review" className={`px-4 py-4 align-top min-w-[220px] ${r.isPublished ? '' : 'opacity-60'}`}>
            <div className="flex flex-wrap items-center gap-2">
              <Stars value={r.rating} />
              <span className="font-semibold text-gray-800">{r.name || 'Anonymous'}</span>
              {r.userId && typeof r.userId === 'object' && r.userId.email ? (
                <span className="text-xs text-gray-500" title="Written while signed in to this account">{r.userId.email}</span>
              ) : (
                !r.userId && <span className="text-xs text-gray-400" title="Written before customer accounts existed">guest</span>
              )}
              {r.editedAt && <span className="text-xs text-gray-400">edited</span>}
              {r.isVerified && (
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-green-100 text-green-800 rounded-full">Verified</span>
              )}
              {!r.isPublished && (
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-gray-200 text-gray-600 rounded-full">Hidden</span>
              )}
            </div>
            <p className={`mt-1.5 text-gray-600 whitespace-pre-line ${long && !open ? 'line-clamp-2' : ''}`}>{r.comment}</p>
            {long && (
              <button type="button" onClick={() => toggleExpand(r._id)} className="mt-1 text-xs font-semibold text-[#2D7A79] hover:underline">
                {open ? 'Show less' : 'Read all'}
              </button>
            )}
          </td>
          <td data-label="Date" className="px-4 py-4 align-top whitespace-nowrap">
            {new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </td>
          <td data-label="On shop" className="px-4 py-4 align-top">
            <Toggle
              checked={r.isPublished}
              disabled={busyId === r._id}
              onChange={() => togglePublished(r)}
              label={r.isPublished ? 'Hide this review from the shop' : 'Publish this review'}
            />
          </td>
          <td data-label="Home page" className="px-4 py-4 align-top">
            <Toggle
              checked={r.isFeatured}
              disabled={busyId === r._id || (!r.isPublished && !r.isFeatured)}
              onChange={() => toggleFeatured(r)}
              label={r.isFeatured ? 'Remove from the home page' : 'Show on the home page'}
              title={!r.isPublished ? 'Publish the review first' : undefined}
            />
          </td>
          <td data-label="Actions" className="px-4 py-4 align-top">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setEditing(r)}
                disabled={busyId === r._id}
                className="p-2 rounded-lg text-gray-500 hover:text-[#2D7A79] hover:bg-gray-100"
                aria-label={`Edit review by ${r.name}`}
              >
                <EditIcon className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => setDeleting(r)}
                disabled={busyId === r._id}
                className="p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50"
                aria-label={`Delete review by ${r.name}`}
              >
                <DeleteIcon className="w-5 h-5" />
              </button>
            </div>
          </td>
        </tr>
      );
    });
  };

  const selectClass = 'p-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#2D7A79] focus:outline-none';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="All reviews" value={stats ? stats.total : '-'} hint={stats ? `${stats.products.length} products reviewed` : undefined} />
        <StatCard
          label="Average rating"
          value={
            stats ? (
              <span className="flex items-center gap-2">
                {stats.avgRating.toFixed(1)} <Stars value={stats.avgRating} />
              </span>
            ) : (
              '-'
            )
          }
          hint="Published reviews only"
        />
        <StatCard label="Hidden" value={stats ? stats.hidden : '-'} hint="Not shown on the shop" />
        <StatCard label="On home page" value={stats ? stats.featured : '-'} hint="Up to 8 are shown" />
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
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="Product" value={productId} onChange={(e) => setProductId(e.target.value)} className={`${selectClass} max-w-[240px]`}>
              <option value="">All products</option>
              {stats?.products.map((p) => (
                <option key={p.productId} value={p.productId}>
                  {p.name} ({p.count})
                </option>
              ))}
            </select>
            <select aria-label="Rating" value={rating} onChange={(e) => setRating(e.target.value ? Number(e.target.value) : '')} className={selectClass}>
              <option value="">All ratings</option>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n} star{n > 1 ? 's' : ''}
                </option>
              ))}
            </select>
            <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)} className={selectClass}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="highest">Highest rating</option>
              <option value="lowest">Lowest rating</option>
            </select>
            {(productId || rating || status || sort !== 'newest') && (
              <button type="button" onClick={resetFilters} className="text-sm font-semibold text-[#2D7A79] hover:underline px-2">
                Clear filters
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto responsive-table">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
              <tr>
                <th scope="col" className="px-4 py-3">Product</th>
                <th scope="col" className="px-4 py-3 w-[45%]">Review</th>
                <th scope="col" className="px-4 py-3">Date</th>
                <th scope="col" className="px-4 py-3">On shop</th>
                <th scope="col" className="px-4 py-3">Home page</th>
                <th scope="col" className="px-4 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className={isLoading && reviews.length > 0 ? 'opacity-60' : ''}>{renderRows()}</tbody>
          </table>
        </div>

        {!error && total > 0 && (
          <Pagination currentPage={page} totalCount={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
        )}
      </div>

      <EditReviewModal review={editing} onClose={() => setEditing(null)} onSave={saveEdit} />

      <ConfirmationModal
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Delete this review?"
        message={
          deleting
            ? `The review by ${deleting.name} for ${deleting.product?.name || 'a deleted product'} will be removed for good. To keep it but take it off the shop, turn "On shop" off instead.`
            : ''
        }
      />
    </div>
  );
};

export default ReviewsPage;
