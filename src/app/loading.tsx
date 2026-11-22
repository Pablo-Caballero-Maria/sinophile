import { Skeleton } from "@/components/UI";

/** Skeleton of a page while it loads (also what a navigation shows at once, before the page arrives). */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Cargando">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-40 rounded-3xl" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
      <Skeleton className="h-56 rounded-3xl" />
    </div>
  );
}
