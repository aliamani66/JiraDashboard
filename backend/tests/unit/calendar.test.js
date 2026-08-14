// Unit tests for Jalali / Gregorian conversion logic
function g2j(gy, gm, gd) {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let gy2 = (gm > 2) ? (gy + 1) : gy;
  let days = 355666 + (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + g_d_m[gm - 1];
  let jy = -1595 + (33 * Math.floor(days / 12053));
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  let jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
  return { jy, jm, jd };
}

function j2g(jy, jm, jd) {
  let gy = (jy <= 979) ? 621 : 1600;
  jy -= (jy <= 979) ? 0 : 979;
  let days = (365 * jy) + ((Math.floor(jy / 33)) * 8) + (Math.floor(((jy % 33) + 3) / 4)) + 78 + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
  gy += 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const sal_a = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  while (gm < 13 && days >= sal_a[gm]) {
    days -= sal_a[gm];
    gm++;
  }
  let gd = days + 1;
  return { gy, gm, gd };
}

describe('Calendar Conversion Unit Tests (Jalali <-> Gregorian)', () => {
  test('converts Nowruz (1405/01/01) to Gregorian correctly', () => {
    const greg = j2g(1405, 1, 1);
    expect(greg.gy).toBe(2026);
    expect(greg.gm).toBe(3);
    expect(greg.gd).toBe(21);
  });

  test('converts Gregorian back to Jalali correctly (Bi-directional idempotence)', () => {
    const jalali = g2j(2026, 3, 21);
    expect(jalali.jy).toBe(1405);
    expect(jalali.jm).toBe(1);
    expect(jalali.jd).toBe(1);
  });

  test('correctly converts end of Jalali 6-month period (1405/06/31)', () => {
    const greg = j2g(1405, 6, 31);
    expect(greg.gy).toBe(2026);
    expect(greg.gm).toBe(9);
    expect(greg.gd).toBe(22);
  });

  test('correctly converts winter month (1404/10/11)', () => {
    const greg = j2g(1404, 10, 11);
    expect(greg.gy).toBe(2026);
    expect(greg.gm).toBe(1);
    expect(greg.gd).toBe(1);
  });
});
