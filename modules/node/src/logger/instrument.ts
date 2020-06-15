export async function instrument<T>(name: string, cb: () => Promise<T>) {
  const start = Date.now();
  const res = await cb();
  console.log(`[BENCH] [${name}] ${Date.now() - start}`);
  return res;
}