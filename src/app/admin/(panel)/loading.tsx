import { TableSkeleton } from "@/components/admin/AdminUi";

export default function Loading() {
  return (
    <div>
      <div className="skeleton mb-6 h-9 w-48 rounded" aria-hidden="true" />
      <TableSkeleton />
    </div>
  );
}
