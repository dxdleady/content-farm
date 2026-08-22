/** Run async jobs with a bounded number in flight, preserving result order. */
export async function pool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, i: number) => Promise<R> | R,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      // The bounds check above is the guard; noUncheckedIndexedAccess cannot see it.
      results[i] = await worker(items[i]!, i);
    }
  });
  await Promise.all(runners);
  return results;
}
