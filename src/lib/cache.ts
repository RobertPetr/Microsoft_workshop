/**
 * In-memory cache with TTL (Time To Live)
 * 
 * This simple in-memory cache stores contribution data with an expiration timestamp.
 * It's designed for server-side use where memory is shared across requests in a single
 * process. The cache automatically cleans up expired entries and implements a basic
 * eviction policy to prevent unbounded memory growth.
 * 
 * Performance characteristics:
 * - Set/Get/Has: O(1) - HashMap/dictionary lookup
 * - Cleanup: O(n) - Scans all entries, runs when size > 1000
 * 
 * Memory management:
 * - TTL: Entries expire after the configured number of seconds
 * - Eviction: When cache grows beyond 1000 entries, oldest ~100 are removed
 * - Thread-safe: Not designed for multi-threaded access; suitable for Node.js single-thread model
 */

export interface CacheEntry<T> {
	data: T;
	expiresAt: number; // Timestamp in milliseconds
}

export class Cache<T> {
	private store = new Map<string, CacheEntry<T>>();
	private readonly ttlMs: number;

	constructor(ttlSeconds: number = 3600) {
		this.ttlMs = ttlSeconds * 1000;
	}

	/**
	 * Set a value in the cache
	 */
	set(key: string, data: T): void {
		this.store.set(key, {
			data,
			expiresAt: Date.now() + this.ttlMs,
		});
		this.cleanup();
	}

	/**
	 * Get a value from the cache
	 * Returns null if not found or expired
	 */
	get(key: string): T | null {
		const entry = this.store.get(key);
		if (!entry) {
			return null;
		}

		// Check if expired
		if (entry.expiresAt < Date.now()) {
			this.store.delete(key);
			return null;
		}

		return entry.data;
	}

	/**
	 * Check if key exists and is not expired
	 */
	has(key: string): boolean {
		return this.get(key) !== null;
	}

	/**
	 * Get expiration time for a cached entry
	 * Returns null if not cached or expired
	 */
	getExpiresAt(key: string): Date | null {
		const entry = this.store.get(key);
		if (!entry) {
			return null;
		}

		// Check if expired
		if (entry.expiresAt < Date.now()) {
			this.store.delete(key);
			return null;
		}

		return new Date(entry.expiresAt);
	}

	/**
	 * Clear all expired entries from the cache
	 */
	private cleanup(): void {
		const now = Date.now();
		for (const [key, entry] of this.store.entries()) {
			if (entry.expiresAt < now) {
				this.store.delete(key);
			}
		}

		// If cache is growing too large, implement eviction
		// Keep max 1000 entries to prevent unbounded memory growth
		if (this.store.size > 1000) {
			let removed = 0;
			for (const [key, entry] of this.store.entries()) {
				if (removed > 100) break; // Remove ~100 entries at a time
				this.store.delete(key);
				removed++;
			}
		}
	}

	/**
	 * Clear a specific key
	 */
	delete(key: string): void {
		this.store.delete(key);
	}

	/**
	 * Clear all cache
	 */
	clear(): void {
		this.store.clear();
	}

	/**
	 * Get cache stats (useful for debugging)
	 */
	getStats(): { size: number; keys: string[] } {
		return {
			size: this.store.size,
			keys: Array.from(this.store.keys()),
		};
	}
}

// Global cache instance for contributions (1 hour TTL)
export const contributionsCache = new Cache<any>(3600);
