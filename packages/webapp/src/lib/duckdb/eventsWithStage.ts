// イベントに「現在の stage_type / stage_id」を window 関数で前方フィルした CTE を生成するヘルパ。
// stage_type / stage_id は StageEnter 行の値のみを引き継ぐ
// (BattleStart の stageId は "Layer0_0_Battle" のように suffix が付くため、
//  StageEnter 値で上書きしないようマスクが必要)。

export function withStageFilledCte(eventsFromExpr: string, where: string): string {
  return `
    WITH ev AS (
      SELECT
        event_slug, device_slug, run_id, seq, event_type, payload, timestamp,
        CASE WHEN event_type = 'StageEnter'
             THEN json_extract_string(payload, '$.stageType') END AS enter_stage_type,
        CASE WHEN event_type = 'StageEnter'
             THEN json_extract_string(payload, '$.stageId') END AS enter_stage_id
      FROM ${eventsFromExpr}
      ${where}
    ),
    filled AS (
      SELECT
        *,
        LAST_VALUE(enter_stage_type IGNORE NULLS) OVER (
          PARTITION BY event_slug, device_slug, run_id
          ORDER BY seq ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS stage_type,
        LAST_VALUE(enter_stage_id IGNORE NULLS) OVER (
          PARTITION BY event_slug, device_slug, run_id
          ORDER BY seq ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS stage_id
      FROM ev
    )
  `;
}
