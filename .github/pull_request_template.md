<!--
master へのマージ用 PR の場合は、以下の Release Checklist を必ず実施してください。
dev/release への通常の PR の場合は Release Checklist は不要です。
-->

## Summary

<!-- 変更内容を簡潔に -->

## Test plan

- [ ] 

## Release Checklist (master 向け PR のみ)

- [ ] `CHANGELOG.md` に新バージョンのセクションを追加した
- [ ] `package.json` の `version` を Semantic Versioning に従ってバンプした
  - MAJOR: 後方互換性なしの変更
  - MINOR: 後方互換性ありの機能追加
  - PATCH: バグ修正のみ
- [ ] CHANGELOG の compare リンクを更新した
- [ ] PR タイトルにバージョン番号を含めた（例: `Release v1.0.3`）
