import { checkCombination } from './requirements';

describe('checkCombination', () => {
  const eco = { required: ['ENG', 'MTH', 'ECO'], choose: [{ count: 1, from: ['GOV', 'GEO'] }] };

  it('accepts a valid combination', () => {
    expect(checkCombination(eco, ['ENG', 'MTH', 'ECO', 'GOV'])).toEqual({ ok: true, problems: [] });
  });

  it('reports missing required and choose-group subjects', () => {
    const res = checkCombination(eco, ['ENG', 'ECO', 'CRS', 'LIT']);
    expect(res.ok).toBe(false);
    expect(res.problems).toEqual(['Missing required subject MTH', 'Choose 1 of GOV, GEO']);
  });
});
