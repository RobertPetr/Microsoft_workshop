import type { APIRoute } from 'astro';
import {
	validateUsername,
	fetchGitHubContributionSvg,
	parseSvgContributions,
	calculateStats,
	ContribError,
	type ContributionsResponse,
	type ContributionData,
} from '../../../lib/github-contrib';
import { contributionsCache } from '../../../lib/cache';

export const prerender = false;

/**
 * GET /api/contributions/:username
 *
 * Fetches GitHub contribution data for a given username.
 * Returns parsed contribution data, stats, and cache metadata.
 *
 * Query Parameters:
 * - nocache (optional): Set to "true" to bypass cache and fetch fresh data
 *
 * Responses:
 * - 200: Success with contribution data
 * - 400: Invalid username format
 * - 404: User not found on GitHub
 * - 500: Server error (parsing, GitHub API error, etc.)
 * - 503: GitHub temporarily unavailable or network error
 */
export const GET: APIRoute = async ({ params, url }) => {
	const { username } = params;

	// Get nocache parameter from query string
	const nocache = url.searchParams.get('nocache') === 'true';
	// Get demo parameter to return mock data
	const demo = url.searchParams.get('demo') === 'true';

	// Validate username
	const validation = validateUsername(username);
	if (!validation.valid) {
		return new Response(
			JSON.stringify({
				error: validation.error,
				code: 'INVALID_USERNAME',
				status: 400,
			}),
			{
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			},
		);
	}

	try {
		// Check cache first (unless nocache is set)
		if (!nocache && !demo) {
			const cached = contributionsCache.get(username);
			if (cached) {
				const expiresAt = contributionsCache.getExpiresAt(username);
				return new Response(
					JSON.stringify({
						...cached,
						cached: true,
						expiresAt: expiresAt?.toISOString(),
					}),
					{
						status: 200,
						headers: { 'Content-Type': 'application/json' },
					},
				);
			}
		}

		// Demo mode: return mock data for testing
		if (demo) {
			const mockContributions = generateMockContributions(username);
			const { totalContributions, currentStreak, longestStreak } = calculateStats(mockContributions);

			const now = new Date();
			const expiresAt = new Date(now.getTime() + 3600 * 1000);

			const response: ContributionsResponse = {
				username,
				totalContributions,
				currentStreak,
				longestStreak,
				contributions: mockContributions,
				cached: false,
				fetchedAt: now.toISOString(),
				expiresAt: expiresAt.toISOString(),
			};

			return new Response(JSON.stringify(response), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		// Fetch SVG from GitHub
		const svg = await fetchGitHubContributionSvg(username);

		// Parse contributions from SVG
		const contributions = parseSvgContributions(svg);

		// Calculate statistics
		const { totalContributions, currentStreak, longestStreak } = calculateStats(contributions);

		const now = new Date();
		const expiresAt = new Date(now.getTime() + 3600 * 1000); // 1 hour from now

		const response: ContributionsResponse = {
			username,
			totalContributions,
			currentStreak,
			longestStreak,
			contributions,
			cached: false,
			fetchedAt: now.toISOString(),
			expiresAt: expiresAt.toISOString(),
		};

		// Store in cache
		contributionsCache.set(username, response);

		return new Response(JSON.stringify(response), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (error) {
		if (error instanceof ContribError) {
			return new Response(
				JSON.stringify({
					error: error.message,
					code: error.code,
					status: error.status,
				}),
				{
					status: error.status,
					headers: { 'Content-Type': 'application/json' },
				},
			);
		}

		// Unexpected error
		console.error('Unexpected error fetching contributions:', error);
		return new Response(
			JSON.stringify({
				error: 'An unexpected error occurred',
				code: 'UNEXPECTED_ERROR',
				status: 500,
			}),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' },
			},
		);
	}
};

/**
 * Generate mock contribution data for testing
 * Creates a realistic contribution pattern for the last year
 */
function generateMockContributions(username: string): ContributionData[] {
	const contributions: ContributionData[] = [];
	const today = new Date();
	const oneYearAgo = new Date(today);
	oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

	// Create a contribution for each day in the past year
	let currentDate = new Date(oneYearAgo);
	while (currentDate <= today) {
		const dayOfWeek = currentDate.getDay();
		// Weighted contribution pattern: more contributions on weekdays
		const isWeekday = dayOfWeek > 0 && dayOfWeek < 6;
		const hasContribution = Math.random() < (isWeekday ? 0.7 : 0.3);

		let count = 0;
		let level = 0;
		if (hasContribution) {
			count = Math.floor(Math.random() * 40) + 1;
			if (count < 5) level = 1;
			else if (count < 10) level = 2;
			else if (count < 20) level = 3;
			else level = 4;
		}

		contributions.push({
			date: currentDate.toISOString().split('T')[0],
			count,
			level,
		});

		currentDate.setDate(currentDate.getDate() + 1);
	}

	return contributions;
}
