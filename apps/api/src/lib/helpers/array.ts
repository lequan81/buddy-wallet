/**
 * Array helper functions
 */

/**
 * Split array into chunks of specified size
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

/**
 * Group array items by a key function
 */
export function groupBy<T, K extends string | number>(array: T[], keyFn: (item: T) => K): Record<K, T[]> {
  const result = {} as Record<K, T[]>;
  for (const item of array) {
    const key = keyFn(item);
    if (!result[key]) {
      result[key] = [];
    }
    result[key].push(item);
  }
  return result;
}

/**
 * Remove duplicate values from array
 */
export function unique<T>(array: T[]): T[] {
  return [...new Set(array)];
}

/**
 * Remove duplicates by a key function
 */
export function uniqueBy<T, K>(array: T[], keyFn: (item: T) => K): T[] {
  const seen = new Set<K>();
  return array.filter(item => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Flatten nested arrays
 */
export function flatten<T>(arrays: T[][]): T[] {
  return arrays.flat();
}

/**
 * Get distinct values from an array of objects by property
 */
export function pluck<T, K extends keyof T>(array: T[], key: K): T[K][] {
  return array.map(item => item[key]);
}

/**
 * Partition array into two groups based on predicate
 */
export function partition<T>(array: T[], predicate: (item: T) => boolean): [T[], T[]] {
  const pass: T[] = [];
  const fail: T[] = [];
  for (const item of array) {
    if (predicate(item)) {
      pass.push(item);
    } else {
      fail.push(item);
    }
  }
  return [pass, fail];
}
