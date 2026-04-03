/**
 * GitHub Contribution Data Fetcher and Parser
 * 
 * This module handles:
 * - Username validation (GitHub username rules: 1-39 chars, alphanumeric + hyphen, no leading/trailing hyphen)
 * - Fetching GitHub contribution SVG from user profiles
 * - Parsing SVG to extract structured contribution data (date, count, level)
 * - Calculating statistics (total, current streak, longest streak)
 * - Error handling with meaningful messages for different failure modes
 * 
 * Contribution levels range from 0-4:
 * - 0: No contributions
 * - 1-4: Increasing contribution intensity (based on count thresholds)
 */

// GitHub username rules: 1-39 chars, alphanumeric + hyphen, no leading/trailing hyphen
const USERNAME_PATTERN = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;
const MAX_USERNAME_LENGTH = 39;

/**
 * Validates a GitHub username according to GitHub's rules
 * @param username - The username to validate
 * @returns { valid: boolean; error?: string }
 */
export function validateUsername(username: string): { valid: boolean; error?: string } {
	if (!username) {
		return { valid: false, error: 'Username is required' };
	}

	if (typeof username !== 'string') {
		return { valid: false, error: 'Username must be a string' };
	}

	const trimmed = username.trim();

	if (trimmed.length === 0) {
		return { valid: false, error: 'Username cannot be empty' };
	}

	if (trimmed.length > MAX_USERNAME_LENGTH) {
		return { valid: false, error: `Username must not exceed ${MAX_USERNAME_LENGTH} characters` };
	}

	if (!USERNAME_PATTERN.test(trimmed)) {
		return {
			valid: false,
			error: 'Username must contain only alphanumeric characters and hyphens, and cannot start or end with a hyphen',
		};
	}

	return { valid: true };
}

export interface ContributionData {
	date: string; // YYYY-MM-DD
	count: number;
	level: number; // 0-4: no contribution to max contribution
}

export interface ContributionsResponse {
	username: string;
	totalContributions: number;
	currentStreak: number;
	longestStreak: number;
	contributions: ContributionData[];
	cached: boolean;
	fetchedAt: string; // ISO-8601
	expiresAt: string; // ISO-8601
}

export interface ContributionError {
	error: string;
	code: string;
	status: number;
}

/**
 * Fetches GitHub contribution SVG for a given username
 * 
 * Note: GitHub's contribution graph SVG is typically loaded via JavaScript on the browser.
 * This function attempts to fetch from the user's profile page and extract the SVG.
 * If that fails, it returns a meaningful error suggesting the profile may not have public contributions.
 * 
 * @param username - GitHub username
 * @returns SVG string or error
 */
export async function fetchGitHubContributionSvg(username: string): Promise<string> {
	// Try the direct endpoint first
	let url = `https://github.com/${username}.contrib`;
	let response = await fetch(url, {
		headers: {
			'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
			Accept: 'image/svg+xml',
		},
		signal: AbortSignal.timeout(5000),
	}).catch(() => null);

	// If that doesn't work, try the profile page
	if (!response || !response.ok) {
		url = `https://github.com/${username}`;
		response = await fetch(url, {
			headers: {
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
			},
			signal: AbortSignal.timeout(5000),
		});
	}

	try {
		if (!response.ok) {
			if (response.status === 404) {
				throw new ContribError('User not found', 'USER_NOT_FOUND', 404);
			}
			throw new ContribError(
				`GitHub returned status ${response.status}`,
				'GITHUB_API_ERROR',
				response.status,
			);
		}

		let content = await response.text();

		// If we got the direct SVG endpoint, return it directly
		if (content.includes('<svg') && content.includes('data-date')) {
			return content;
		}

		// Otherwise, we need to extract from HTML
		// Look for any SVG with contribution data
		const svgMatch = content.match(/<svg[^>]*>[\s\S]*?<\/svg>/g);
		if (svgMatch) {
			for (const svg of svgMatch) {
				if (svg.includes('data-date') || svg.includes('data-count')) {
					return svg;
				}
			}
		}

		// If we still haven't found it, the user might not have public contributions
		// Or GitHub's format has changed. Return a helpful error.
		throw new ContribError(
			'Could not find contribution graph. The user may not have public contributions or the page format may have changed.',
			'GRAPH_NOT_FOUND',
			500,
		);
	} catch (error) {
		if (error instanceof ContribError) {
			throw error;
		}

		if (error instanceof TypeError) {
			throw new ContribError('Network error while fetching GitHub data', 'NETWORK_ERROR', 503);
		}

		throw new ContribError('Failed to fetch contribution data', 'FETCH_ERROR', 500);
	}
}

/**
 * Parses GitHub contribution SVG and extracts structured data
 * 
 * GitHub's SVG contribution graph embeds contribution data in rect element attributes:
 * - data-date: YYYY-MM-DD format (the day of contribution)
 * - data-count: integer (number of contributions that day)
 * - data-level: 0-4 (visual level, though we calculate from count)
 * 
 * This function uses regex to efficiently extract all contribution data from the SVG.
 * The regex pattern matches the key attributes regardless of their order in the HTML.
 * 
 * @param svg - SVG string from GitHub
 * @returns Array of contribution data sorted by date (ascending)
 */
export function parseSvgContributions(svg: string): ContributionData[] {
	const contributions: ContributionData[] = [];

	// Regex to match rect elements with data-date and data-count attributes
	// Pattern explanation:
	// - data-date="YYYY-MM-DD": Matches ISO date format
	// - [^>]*: Allows for other attributes between data-date and data-count
	// - data-count="NUMBER": Matches contribution count
	// - data-level="[0-4]": Matches contribution level (0=none, 4=most)
	const rectPattern =
		/data-date="(\d{4}-\d{2}-\d{2})"\s+[^>]*data-count="(\d+)"\s+[^>]*data-level="([0-4])"/g;

	let match;
	while ((match = rectPattern.exec(svg)) !== null) {
		contributions.push({
			date: match[1],
			count: parseInt(match[2], 10),
			level: parseInt(match[3], 10),
		});
	}

	return contributions;
}

/**
 * Calculates contribution statistics from parsed contribution data
 * 
 * Statistics calculated:
 * - totalContributions: Sum of all contributions across the year
 * - currentStreak: Number of consecutive days with contributions (from today backwards)
 * - longestStreak: The longest consecutive contribution streak in the dataset
 * 
 * Streak definition: One or more consecutive days with contributions.
 * The current streak is calculated from the most recent data backwards to account
 * for days that may not have data yet in the current period.
 * 
 * @param contributions - Array of contribution data (should be sorted by date)
 * @returns Object with totalContributions, currentStreak, longestStreak
 */
export function calculateStats(contributions: ContributionData[]): {
	totalContributions: number;
	currentStreak: number;
	longestStreak: number;
} {
	let totalContributions = 0;
	let currentStreak = 0;
	let longestStreak = 0;
	let tempStreak = 0;

	// Sort by date descending (newest first) to find current streak
	const sorted = [...contributions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

	// Calculate total and find longest streak
	for (let i = 0; i < sorted.length; i++) {
		totalContributions += sorted[i].count;

		if (sorted[i].count > 0) {
			// Day has contribution
			if (i === 0 || daysDifference(new Date(sorted[i].date), new Date(sorted[i - 1].date)) === 1) {
				// Consecutive with previous day or first day
				tempStreak++;
				if (tempStreak > longestStreak) {
					longestStreak = tempStreak;
				}
			} else {
				// Gap in streak, start new one
				tempStreak = 1;
			}
		} else {
			// No contribution day
			if (i === 0 || daysDifference(new Date(sorted[i].date), new Date(sorted[i - 1].date)) === 1) {
				// Continue tracking but don't increment streak
				tempStreak++;
			} else {
				tempStreak = 0;
			}
		}
	}

	// Calculate current streak: count from today backwards
	// Only count days with contributions (count > 0)
	currentStreak = 0;
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	for (let i = 0; i < sorted.length; i++) {
		const dayDate = new Date(sorted[i].date);
		dayDate.setHours(0, 0, 0, 0);
		const daysBack = Math.floor((today.getTime() - dayDate.getTime()) / (1000 * 60 * 60 * 24));

		if (daysBack === i || (i > 0 && daysDifference(dayDate, new Date(sorted[i - 1].date)) === 1)) {
			if (sorted[i].count > 0) {
				// This day has contributions, increment streak
				currentStreak++;
			} else if (currentStreak === 0) {
				// Haven't started counting yet, skip this day
				continue;
			} else {
				// Hit a day without contributions after streak started, stop counting
				break;
			}
		} else {
			// Gap in the sequence
			break;
		}
	}

	return { totalContributions, currentStreak, longestStreak };
}

function daysDifference(date1: Date, date2: Date): number {
	return Math.floor((date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Custom error class for contribution-related errors
 */
export class ContribError extends Error {
	constructor(
		message: string,
		public code: string,
		public status: number,
	) {
		super(message);
		this.name = 'ContribError';
	}
}
