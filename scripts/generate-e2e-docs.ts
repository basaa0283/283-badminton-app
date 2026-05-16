#!/usr/bin/env tsx
/**
 * e2e/*.spec.ts を静的にパースして docs/E2E_TEST_CASES.md を生成する。
 *
 * 使い方: npm run docs:e2e
 *
 * 注意: 単純な regex ベース。`test("...", ...)` および `test.describe("...", ...)` を抽出する。
 *      テンプレートリテラルや動的タイトルは含めない（純粋な文字列リテラルのみ対応）。
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, relative, basename } from "path";

const PROJECT_ROOT = process.cwd();
const E2E_DIR = join(PROJECT_ROOT, "e2e");
const OUTPUT = join(PROJECT_ROOT, "docs", "E2E_TEST_CASES.md");

interface TestCase {
  title: string;
  line: number;
}
interface DescribeBlock {
  title: string;
  tests: TestCase[];
}
interface SpecFile {
  path: string;
  topLevelTests: TestCase[];
  describes: DescribeBlock[];
}

function walk(dir: string, exts: string[]): string[] {
  const entries: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) entries.push(...walk(full, exts));
    else if (exts.some((e) => name.endsWith(e))) entries.push(full);
  }
  return entries;
}

function parseSpec(file: string): SpecFile {
  const src = readFileSync(file, "utf8");
  const lines = src.split("\n");

  // (describeStartLine, title) スタック。閉じ括弧は { カウントで判定。
  const describes: DescribeBlock[] = [];
  const topLevel: TestCase[] = [];
  // 現在ネストしている describe のインデックス（末尾が現在）
  const stack: { idx: number; depth: number }[] = [];
  let braceDepth = 0;

  const describeRe = /^\s*test\.describe\s*\(\s*(['"`])([^'"`]+)\1\s*,/;
  const testRe = /^\s*test\s*\(\s*(['"`])([^'"`]+)\1\s*,/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // describe?
    const dm = line.match(describeRe);
    if (dm) {
      const desc: DescribeBlock = { title: dm[2], tests: [] };
      describes.push(desc);
      stack.push({ idx: describes.length - 1, depth: braceDepth });
    } else {
      const tm = line.match(testRe);
      if (tm) {
        const tc: TestCase = { title: tm[2], line: i + 1 };
        if (stack.length > 0) {
          describes[stack[stack.length - 1].idx].tests.push(tc);
        } else {
          topLevel.push(tc);
        }
      }
    }

    // 中括弧の出入りで stack を pop する
    for (const ch of line) {
      if (ch === "{") braceDepth++;
      else if (ch === "}") {
        braceDepth--;
        while (stack.length > 0 && stack[stack.length - 1].depth >= braceDepth) {
          stack.pop();
        }
      }
    }
  }

  return { path: file, topLevelTests: topLevel, describes };
}

function render(specs: SpecFile[]): string {
  const total = specs.reduce(
    (n, s) => n + s.topLevelTests.length + s.describes.reduce((m, d) => m + d.tests.length, 0),
    0
  );

  const out: string[] = [];
  out.push("# E2E テストケース一覧");
  out.push("");
  out.push("> このドキュメントは `scripts/generate-e2e-docs.ts` で自動生成されています。");
  out.push("> 手動編集せず、`npm run docs:e2e` で再生成してください。");
  out.push("");
  out.push(`- 生成日時: ${new Date().toISOString()}`);
  out.push(`- テスト数: ${total}`);
  out.push(`- ファイル数: ${specs.length}`);
  out.push("");
  out.push("## ファイル別一覧");
  out.push("");

  for (const spec of specs) {
    const rel = relative(PROJECT_ROOT, spec.path);
    out.push(`### \`${rel}\``);
    out.push("");
    if (spec.topLevelTests.length > 0) {
      for (const t of spec.topLevelTests) {
        out.push(`- ${t.title}`);
      }
      out.push("");
    }
    for (const d of spec.describes) {
      out.push(`#### ${d.title}`);
      out.push("");
      for (const t of d.tests) {
        out.push(`- ${t.title}`);
      }
      out.push("");
    }
  }

  return out.join("\n");
}

function main() {
  const files = walk(E2E_DIR, [".spec.ts"]).sort();
  const specs = files.map(parseSpec);
  const md = render(specs);
  writeFileSync(OUTPUT, md);
  const total = specs.reduce(
    (n, s) => n + s.topLevelTests.length + s.describes.reduce((m, d) => m + d.tests.length, 0),
    0
  );
  console.log(`Generated ${relative(PROJECT_ROOT, OUTPUT)} (${total} tests across ${files.length} files)`);
  for (const f of files) console.log(`  ${basename(f)}`);
}

main();
