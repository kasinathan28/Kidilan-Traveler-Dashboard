import React from 'react';
import { PAGE_SIZE_OPTIONS } from '../hooks/usePageSize';

interface PaginationProps {
  currentPage: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  // with this, a "Rows per page" picker is shown (also when everything fits on one page)
  onPageSizeChange?: (size: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({ currentPage, totalCount, pageSize, onPageChange, onPageSizeChange }) => {
  const totalPages = Math.ceil(totalCount / pageSize);

  if (totalCount === 0 || (totalPages <= 1 && !onPageSizeChange)) {
    return null;
  }

  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-6 px-2 py-4">
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          <p className="text-sm text-gray-600 hidden sm:block">
              Showing <span className="font-semibold">{(currentPage - 1) * pageSize + 1}</span> to <span className="font-semibold">{Math.min(currentPage * pageSize, totalCount)}</span> of <span className="font-semibold">{totalCount}</span> results
          </p>
          {onPageSizeChange && (
            <label className="flex items-center gap-2 text-sm text-gray-600">
              Rows per page
              <select
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                className="p-1.5 border border-gray-300 rounded-lg text-sm bg-white text-gray-800 focus:ring-2 focus:ring-[#2D7A79] focus:outline-none"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        {totalPages > 1 && (
        <div className="flex items-center space-x-2">
            <button
                onClick={handlePrevious}
                disabled={currentPage === 1}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Previous
            </button>
            <span className="text-sm text-gray-700 px-2 font-medium">
                Page {currentPage} of {totalPages}
            </span>
            <button
                onClick={handleNext}
                disabled={currentPage === totalPages}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Next
            </button>
        </div>
        )}
    </div>
  );
};

export default Pagination;
