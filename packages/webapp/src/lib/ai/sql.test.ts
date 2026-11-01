import { describe, expect, it } from 'vitest';
import { checkReadOnlySql } from './sql';

describe('checkReadOnlySql', () => {
  it.each([
    'SELECT * FROM runs',
    'with t as (select 1) select * from t;',
    'DESCRIBE events',
    'SUMMARIZE runs',
    '-- 勝率\nSELECT outcome, count(*) FROM runs GROUP BY outcome',
  ])('読むだけの文 %s を通す', (sql) => {
    expect(checkReadOnlySql(sql)).toBeNull();
  });

  it.each([
    'DROP VIEW events',
    'CREATE OR REPLACE VIEW runs AS SELECT 1',
    'INSERT INTO runs VALUES (1)',
    "COPY runs TO 'out.csv'",
    "ATTACH 'x.db'",
    '/* select */ DELETE FROM runs',
  ])('ビューやデータを書き換える文 %s を止める', (sql) => {
    expect(checkReadOnlySql(sql)).not.toBeNull();
  });

  it('読む文の後ろに続けた書き換えの文を止める', () => {
    expect(checkReadOnlySql('SELECT 1; DROP VIEW events')).not.toBeNull();
  });

  it('空の SQL を止める', () => {
    expect(checkReadOnlySql(' ; -- 何もない')).not.toBeNull();
  });
});
