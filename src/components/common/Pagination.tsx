export type PaginationMeta = {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasPrevPage: boolean;
    hasNextPage: boolean;
    prevPage: number | null;
    nextPage: number | null;
};

type PaginationProps = {
    pagination: PaginationMeta | null;
    isLoading?: boolean;
    limitOptions?: number[];
    onPageChange: (page: number) => void;
    onLimitChange?: (limit: number) => void;
    className?: string;
};

function buildPageItems(currentPage: number, totalPages: number) {
    const items: Array<number | 'ellipsis'> = [];

    if (totalPages <= 7) {
        for (let page = 1; page <= totalPages; page += 1) {
            items.push(page);
        }

        return items;
    }

    items.push(1);

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    if (start > 2) {
        items.push('ellipsis');
    }

    for (let page = start; page <= end; page += 1) {
        items.push(page);
    }

    if (end < totalPages - 1) {
        items.push('ellipsis');
    }

    items.push(totalPages);

    return items;
}

export default function Pagination({
    pagination,
    isLoading = false,
    limitOptions = [10, 20, 50, 100],
    onPageChange,
    onLimitChange,
    className = '',
}: PaginationProps) {
    if (!pagination) return null;

    const {
        page,
        limit,
        total,
        totalPages,
        hasPrevPage,
        hasNextPage,
        prevPage,
        nextPage,
    } = pagination;

    if (total === 0) return null;

    const startItem = (page - 1) * limit + 1;
    const endItem = Math.min(page * limit, total);
    const pageItems = buildPageItems(page, totalPages);

    return (
        <div
            className={`flex flex-col gap-4 border-t border-base-300 px-4 py-4 md:flex-row md:items-center md:justify-between ${className}`}
        >
            <div className="text-sm text-base-content/70">
                Showing{' '}
                <span className="font-medium text-base-content">{startItem}</span> to{' '}
                <span className="font-medium text-base-content">{endItem}</span> of{' '}
                <span className="font-medium text-base-content">{total}</span> results
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                {onLimitChange && (
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-base-content/70">Rows</span>

                        <select
                            className="select select-bordered select-sm"
                            value={limit}
                            disabled={isLoading}
                            onChange={(e) => onLimitChange(Number(e.target.value))}
                        >
                            {limitOptions.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="join">
                    <button
                        type="button"
                        className="btn join-item btn-sm"
                        disabled={isLoading || !hasPrevPage}
                        onClick={() => onPageChange(1)}
                    >
                        «
                    </button>

                    <button
                        type="button"
                        className="btn join-item btn-sm"
                        disabled={isLoading || !hasPrevPage || !prevPage}
                        onClick={() => {
                            if (prevPage) onPageChange(prevPage);
                        }}
                    >
                        Prev
                    </button>

                    {pageItems.map((item, index) => {
                        if (item === 'ellipsis') {
                            return (
                                <button
                                    key={`ellipsis-${index}`}
                                    type="button"
                                    className="btn join-item btn-sm btn-disabled"
                                >
                                    ...
                                </button>
                            );
                        }

                        return (
                            <button
                                key={item}
                                type="button"
                                className={`btn join-item btn-sm ${item === page ? 'btn-active' : ''
                                    }`}
                                disabled={isLoading}
                                onClick={() => onPageChange(item)}
                            >
                                {item}
                            </button>
                        );
                    })}

                    <button
                        type="button"
                        className="btn join-item btn-sm"
                        disabled={isLoading || !hasNextPage || !nextPage}
                        onClick={() => {
                            if (nextPage) onPageChange(nextPage);
                        }}
                    >
                        Next
                    </button>

                    <button
                        type="button"
                        className="btn join-item btn-sm"
                        disabled={isLoading || !hasNextPage}
                        onClick={() => onPageChange(totalPages)}
                    >
                        »
                    </button>
                </div>
            </div>
        </div>
    );
}