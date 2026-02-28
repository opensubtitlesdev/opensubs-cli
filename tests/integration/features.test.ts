import { fetchFeatures } from '../../src/LookupFeature';

// Real API calls — requires network access
// Run with: npm run test:integration

const BBB_IMDB_ID      = 1254207;  // Big Buck Bunny (2008) — tt1254207 — CC-BY 3.0
const PIONEER_IMDB_ID  = 1748166;  // Pioneer One (2010)    — tt1748166 — CC-BY-NC-SA

// ─── Big Buck Bunny (movie) ───────────────────────────────────────────────────

describe('Features API — Big Buck Bunny (tt1254207)', () => {
    let results: Awaited<ReturnType<typeof fetchFeatures>>;

    beforeAll(async () => {
        results = await fetchFeatures('Big Buck Bunny', 'movie');
    });

    it('returns at least one result', () => {
        expect(results.length).toBeGreaterThan(0);
    });

    it('includes Big Buck Bunny (tt1254207) in the results', () => {
        const ids = results.map(r => r.attributes.imdb_id);
        expect(ids).toContain(BBB_IMDB_ID);
    });

    it('first result is Big Buck Bunny (tt1254207)', () => {
        expect(results[0]?.attributes?.imdb_id).toBe(BBB_IMDB_ID);
    });

    it('result has year 2008', () => {
        const bbb = results.find(r => r.attributes.imdb_id === BBB_IMDB_ID);
        expect(Number(bbb?.attributes?.year)).toBe(2008);
    });

    it('result type is Movie', () => {
        const bbb = results.find(r => r.attributes.imdb_id === BBB_IMDB_ID);
        const typeStr = (bbb?.attributes?.feature_type ?? bbb?.type ?? '').toLowerCase();
        expect(typeStr).toMatch(/movie/);
    });

    it('result has a url to opensubtitles.com', () => {
        const bbb = results.find(r => r.attributes.imdb_id === BBB_IMDB_ID);
        expect(bbb?.attributes?.url).toMatch(/opensubtitles\.com/);
    });
});

// ─── Pioneer One (TV show) ────────────────────────────────────────────────────

describe('Features API — Pioneer One (tt1748166)', () => {
    let results: Awaited<ReturnType<typeof fetchFeatures>>;

    beforeAll(async () => {
        results = await fetchFeatures('Pioneer One', 'tvshow');
    });

    it('returns at least one result', () => {
        expect(results.length).toBeGreaterThan(0);
    });

    it('includes Pioneer One (tt1748166) in the results', () => {
        const ids = results.map(r => r.attributes.imdb_id);
        expect(ids).toContain(PIONEER_IMDB_ID);
    });

    it('first result is Pioneer One (tt1748166)', () => {
        expect(results[0]?.attributes?.imdb_id).toBe(PIONEER_IMDB_ID);
    });

    it('result has year 2010', () => {
        const p = results.find(r => r.attributes.imdb_id === PIONEER_IMDB_ID);
        expect(Number(p?.attributes?.year)).toBe(2010);
    });

    it('result type is Tvshow', () => {
        const p = results.find(r => r.attributes.imdb_id === PIONEER_IMDB_ID);
        const typeStr = (p?.attributes?.feature_type ?? p?.type ?? '').toLowerCase();
        expect(typeStr).toMatch(/tvshow|tv show|series/);
    });

    it('result has a url to opensubtitles.com', () => {
        const p = results.find(r => r.attributes.imdb_id === PIONEER_IMDB_ID);
        expect(p?.attributes?.url).toMatch(/opensubtitles\.com/);
    });
});

// ─── Type filter ─────────────────────────────────────────────────────────────

describe('Features API — type filter', () => {
    it('"Big Buck Bunny" tvshow query does not return the movie result', async () => {
        const results = await fetchFeatures('Big Buck Bunny', 'tvshow');
        const hasBBBMovie = results.some(
            r => r.attributes.imdb_id === BBB_IMDB_ID
                && (r.attributes.feature_type ?? r.type ?? '').toLowerCase().includes('movie')
        );
        expect(hasBBBMovie).toBe(false);
    });

    it('"Pioneer One 2010" still finds tt1748166', async () => {
        const results = await fetchFeatures('Pioneer One 2010', 'tvshow');
        const ids = results.map(r => r.attributes.imdb_id);
        expect(ids).toContain(PIONEER_IMDB_ID);
    });
});
