interface ResultsCountProps {
  count: number;
  total: number;
}

export function ResultsCount({ count, total }: ResultsCountProps) {
  if (count === total) {
    return (
      <p className="text-sm text-gray-500">
        Showing <span className="font-semibold text-gray-800">{total}</span> alumni
      </p>
    );
  }
  return (
    <p className="text-sm text-gray-500">
      Showing <span className="font-semibold text-gray-800">{count}</span> of{' '}
      <span className="font-semibold text-gray-800">{total}</span> alumni
    </p>
  );
}
