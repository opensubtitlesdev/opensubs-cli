import { callGuessit } from '../../src/Guessit';

// Real API calls — requires network access
// Run with: npm run test:integration

describe('Guessit API — movie detection', () => {
    it('parses Big Buck Bunny filename', async () => {
        const r = await callGuessit('Big.Buck.Bunny.2008.320x180.mp4');
        expect(r.type).toBe('movie');
        expect(r.year).toBe(2008);
    });

    it('extracts title from Big Buck Bunny filename', async () => {
        const r = await callGuessit('Big.Buck.Bunny.2008.320x180.mp4');
        expect(r.title?.toLowerCase()).toContain('big buck bunny');
    });

    it('does not confuse resolution as season/episode', async () => {
        const r = await callGuessit('Big.Buck.Bunny.2008.320x180.mp4');
        expect(r.season).toBeUndefined();
        expect(r.episode).toBeUndefined();
    });
});

describe('Guessit API — episode detection', () => {
    it('parses Pioneer One S01E01 filename', async () => {
        const r = await callGuessit('Pioneer.One.S01E01.480p.mp4');
        expect(r.type).toBe('episode');
        expect(r.season).toBe(1);
        expect(r.episode).toBe(1);
    });

    it('extracts title from Pioneer One filename', async () => {
        const r = await callGuessit('Pioneer.One.S01E01.480p.mp4');
        expect(r.title?.toLowerCase()).toContain('pioneer');
    });

    it('does not confuse resolution as season/episode for Pioneer One', async () => {
        const r = await callGuessit('Pioneer.One.S01E01.480p.mp4');
        expect(r.season).toBe(1);
        expect(r.episode).toBe(1);
    });

    it('parses Pioneer One S01E06 filename', async () => {
        const r = await callGuessit('Pioneer.One.S01E06.720p.mp4');
        expect(r.type).toBe('episode');
        expect(r.season).toBe(1);
        expect(r.episode).toBe(6);
    });
});

describe('Guessit API — noise stripping', () => {
    it('strips release quality tags from Big Buck Bunny', async () => {
        const r = await callGuessit('Big.Buck.Bunny.2008.1080p.BluRay.x264.mp4');
        expect(r.type).toBe('movie');
        expect(r.year).toBe(2008);
        expect(r.season).toBeUndefined();
    });

    it('strips release group from Pioneer One', async () => {
        const r = await callGuessit('Pioneer.One.S01E01.720p.WEB-DL.x264-GROUP.mkv');
        expect(r.season).toBe(1);
        expect(r.episode).toBe(1);
    });
});
