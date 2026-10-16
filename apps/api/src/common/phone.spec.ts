import { maskPhone, normaliseNigerianPhone } from './phone';

describe('normaliseNigerianPhone', () => {
  it.each([
    ['08031234567', '+2348031234567'],
    ['0803 123 4567', '+2348031234567'],
    ['0803-123-4567', '+2348031234567'],
    ['+2348031234567', '+2348031234567'],
    ['2348031234567', '+2348031234567'],
    ['07012345678', '+2347012345678'],
    ['08112345678', '+2348112345678'],
    ['09012345678', '+2349012345678'],
    ['09112345678', '+2349112345678'],
  ])('accepts %s', (input, expected) => {
    expect(normaliseNigerianPhone(input)).toBe(expected);
  });

  it.each([
    ['0803123456'], // too short
    ['080312345678'], // too long
    ['06012345678'], // disallowed prefix
    ['+14155552671'], // not Nigerian
    ['abc'],
    [''],
  ])('rejects %s', (input) => {
    expect(normaliseNigerianPhone(input)).toBeNull();
  });
});

describe('maskPhone', () => {
  it('masks the middle digits', () => {
    expect(maskPhone('+2348031234567')).toBe('0803 *** 4567');
  });
});
