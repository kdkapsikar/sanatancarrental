/** Skeleton while a destination page streams in. */
export default function Loading() {
  return (
    <div className="mx-auto grid max-w-6xl animate-pulse gap-10 px-4 pt-10 sm:px-6 lg:grid-cols-[1fr_1.1fr]" aria-busy="true">
      <div className="space-y-4">
        <div className="h-4 w-32 rounded-full bg-sand-200" />
        <div className="size-14 rounded-2xl bg-sand-200" />
        <div className="h-12 w-3/4 rounded-2xl bg-sand-200" />
        <div className="h-6 w-1/2 rounded-full bg-sand-200" />
        <div className="h-20 w-full rounded-2xl bg-sand-100" />
      </div>
      <div className="aspect-[640/420] rounded-[28px] bg-sand-100" />
    </div>
  );
}
