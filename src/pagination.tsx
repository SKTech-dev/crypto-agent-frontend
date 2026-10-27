import { useState } from "react";

const initialPage = { page: 0, pageSize: 10 };

export function usePagination() {
  const [state, setState] = useState(initialPage);
  return {
    ...state,
    offset: state.page * state.pageSize,
    setPage: (page: number) => setState((s) => ({ ...s, page })),
    setPageSize: (pageSize: number) => setState({ page: 0, pageSize }),
    reset: () => setState(initialPage),
  };
}

export function Pagination({
  label,
  page,
  pageSize,
  count,
  hasNext,
  loading,
  error,
  onPageChange,
  onPageSizeChange,
}: {
  label: string;
  page: number;
  pageSize: number;
  count: number;
  hasNext: boolean;
  loading: boolean;
  error?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  return (
    <nav
      className="pagination"
      aria-label={`${label} pagination`}
      aria-busy={loading}
    >
      <label className="pagination-size">
        Rows per page
        <select
          aria-label={`${label} rows per page`}
          value={pageSize}
          disabled={loading}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
        >
          {[10, 25, 50].map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
      <span className="pagination-summary" role="status">
        Page {page + 1} ·{" "}
        {loading && count === 0
          ? "Loading…"
          : count
            ? `Records ${page * pageSize + 1}–${page * pageSize + count}`
            : "No records on this page"}
      </span>
      <div className="pagination-actions">
        <button
          disabled={page === 0 || loading}
          onClick={() => onPageChange(0)}
        >
          First
        </button>
        <button
          disabled={page === 0 || loading}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </button>
        <button
          disabled={!hasNext || loading || error}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </nav>
  );
}
