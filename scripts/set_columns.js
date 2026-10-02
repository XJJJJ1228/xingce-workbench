/* ============================================================
 * set_columns.js —— 把数据文件里的 column 字段统一成指定栏目名
 * 用途：导入多套真题后，想把它们整集合并成一个文件级栏目时，
 *       一键把所有 column: "..." 改成同一个值（UI 会自动包裹成【…】）。
 *
 * 用法：
 *   node scripts/set_columns.js app/data/bank-xinshuo.js --value "欣说言语刷题集"
 *   node scripts/set_columns.js app/data/bank-guoxi.js   --value "2025郭熙100题"
 *   node scripts/set_columns.js                            # 无参数时使用内置默认文件（缺失则跳过）
 * ========================================================== */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_FILES = [
  path.join(ROOT, "app/data/bank-xinshuo.js"),
  path.join(ROOT, "app/data/bank-guoxi.js"),
];

function parseArgs(argv) {
  const files = [];
  let value = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--value") { value = argv[++i]; }
    else if (a.startsWith("--value=")) { value = a.slice("--value=".length); }
    else if (a.endsWith(".js")) { files.push(path.resolve(a)); }
  }
  return { files: files.length ? files : DEFAULT_FILES, value };
}

function setColumn(file, value) {
  if (!fs.existsSync(file)) {
    console.log(`  （跳过，文件不存在）${path.basename(file)}`);
    return;
  }
  let txt = fs.readFileSync(file, "utf8");
  const before = new Set((txt.match(/column:\s*"([^"]*)"/g) || [])
    .map((s) => s.replace(/column:\s*"|"/g, "")));
  txt = txt.replace(/column:\s*"[^"]*"/g, 'column: "' + value + '"');
  fs.writeFileSync(file, txt, "utf8");
  const after = new Set((txt.match(/column:\s*"([^"]*)"/g) || [])
    .map((s) => s.replace(/column:\s*"|"/g, "")));
  console.log(`\n[${path.basename(file)}]`);
  console.log("  改动前列名数:", before.size, [...before].slice(0, 5).join(", ") + (before.size > 5 ? " …" : ""));
  console.log("  改动后列名数:", after.size, [...after].join(", "));
}

function main() {
  const { files, value } = parseArgs(process.argv.slice(2));
  if (!value) {
    console.error("❌ 请通过 --value \"栏目名\" 指定要统一成的栏目名");
    process.exit(2);
  }
  files.forEach((f) => setColumn(f, value));
  console.log("OK");
}

main();
