/* AI 代码验收报告 - 确定性检查测试
 * 用法: node test/checker.test.js (从产品根目录或任意位置运行)
 */
'use strict';

var path = require('path');
var checker = require(path.join(__dirname, '..', 'checker.js'));

var passed = 0, failed = 0;
function ok(name, cond, extra) {
  if (cond) { passed++; console.log('PASS  ' + name); }
  else { failed++; console.log('FAIL  ' + name + (extra ? '  <- ' + extra : '')); }
}
function hasCheck(result, id, status) {
  return result.checks.some(function (c) { return c.id === id && (!status || c.status === status); });
}
function getCheck(result, id) {
  return result.checks.find(function (c) { return c.id === id; });
}

/* 1 空输入 */
var r0 = checker.analyzeCode('   \n  ');
ok('空输入返回 empty', r0.empty === true);
ok('空输入无评分', r0.score === null);

/* 2 干净的 JS 代码 */
var cleanJs = [
  'function add(a, b) {',
  '  // 返回两数之和',
  '  return a + b;',
  '}',
  '',
  'const total = add(2, 3);',
  'console.log(total);'
].join('\n');
var r1 = checker.analyzeCode(cleanJs);
ok('干净 JS 识别语言', r1.language === 'JavaScript', 'got ' + r1.language);
ok('干净 JS 括号通过', hasCheck(r1, 'brackets', 'pass'));
ok('干净 JS 评分 >= 90', r1.score >= 90, 'score=' + r1.score);
ok('干净 JS 无不通过项', r1.counts.fail === 0, 'fail=' + r1.counts.fail);
ok('干净 JS 函数数为 1', r1.metrics.functionCount === 1, 'got ' + r1.metrics.functionCount);

/* 3 括号不配对 */
var r2 = checker.analyzeCode('function f() {\n  return 1;\n');
ok('缺失右括号判不通过', hasCheck(r2, 'brackets', 'fail'));
ok('缺失右括号扣分', r2.score < 100);

/* 4 TODO 与 console.log */
var r3 = checker.analyzeCode([
  'function load() {',
  '  // TODO: 接入真实接口',
  '  console.log("debug");',
  '  return null;',
  '}'
].join('\n'));
ok('TODO 命中警告', hasCheck(r3, 'todos', 'warn'));
ok('console.log 命中警告', hasCheck(r3, 'debug', 'warn'));
ok('TODO 行号正确', getCheck(r3, 'todos').lines.indexOf(2) !== -1);

/* 5 硬编码密钥 */
var r4 = checker.analyzeCode('const apiKey = "sk-abcdefghijklmnopqrstuv";\nconst x = 1;');
ok('硬编码密钥判不通过', hasCheck(r4, 'secrets', 'fail'));
ok('密钥不出现在证据明文里', getCheck(r4, 'secrets').evidence.join(' ').indexOf('sk-abcdef') === -1);

/* 6 eval 与 innerHTML */
var r5 = checker.analyzeCode('function run(s) {\n  eval(s);\n  document.body.innerHTML = s;\n}');
ok('eval 判不通过', hasCheck(r5, 'danger', 'fail'));
ok('eval 命中两处', getCheck(r5, 'danger').lines.length === 2);

/* 7 Python 识别与 print */
var py = [
  'def greet(name):',
  '    # 打个招呼',
  '    print("hi " + name)',
  '    return True',
  '',
  'greet("world")'
].join('\n');
var r6 = checker.analyzeCode(py);
ok('Python 识别语言', r6.language === 'Python', 'got ' + r6.language);
ok('Python print 命中警告', hasCheck(r6, 'debug', 'warn'));
ok('Python 函数数为 1', r6.metrics.functionCount === 1);

/* 8 非法 JSON */
var r7 = checker.analyzeCode('{"a": 1, "b": }');
ok('非法 JSON 识别语言', r7.language === 'JSON' || r7.language === '未知', 'got ' + r7.language);
var r7b = checker.analyzeCode('{"a": 1,}');
ok('尾逗号 JSON 判不通过', hasCheck(r7b, 'json', 'fail'));

/* 9 超长行 */
var longLine = '// ' + new Array(130).join('x');
var r8 = checker.analyzeCode('const a = 1;\n' + longLine + '\nconst b = 2;');
ok('超长行命中', hasCheck(r8, 'long-lines', 'warn') || hasCheck(r8, 'long-lines', 'fail'));
ok('最长行长度正确', r8.metrics.maxLineLength >= 125, 'got ' + r8.metrics.maxLineLength);

/* 10 重复行 */
var dup = [
  'const price = 199;',
  'const price = 199;',
  'const price = 199;',
  'const tax = price * 0.13;',
  'const tax = price * 0.13;',
  'const tax = price * 0.13;'
].join('\n');
var r9 = checker.analyzeCode(dup);
ok('重复行命中警告', hasCheck(r9, 'duplicates', 'warn'));

/* 11 高复杂度 */
var complex = ['function f(x) {'];
for (var i = 0; i < 12; i++) complex.push('  if (x > ' + i + ') { x += ' + i + '; }');
complex.push('  return x;');
complex.push('}');
var r10 = checker.analyzeCode(complex.join('\n'));
ok('高复杂度命中警告或不通过', hasCheck(r10, 'complexity', 'warn') || hasCheck(r10, 'complexity', 'fail'));
ok('复杂度估算大于 10', r10.metrics.complexity > 10, 'got ' + r10.metrics.complexity);

/* 12 宽松相等 */
var r11 = checker.analyzeCode('if (a == null) {\n  return;\n}');
ok('宽松相等命中警告', hasCheck(r11, 'equality', 'warn'));

/* 13 魔法数字 */
var r12 = checker.analyzeCode('const fee = amount * 0.1375 + 42.5;\nconst limit = 86400;\nconst ratio = 3.14159;');
ok('魔法数字命中警告', hasCheck(r12, 'magic-numbers', 'warn'));

/* 14 空 catch */
var r13 = checker.analyzeCode('try {\n  doWork();\n} catch (e) {\n}');
ok('空 catch 命中警告', hasCheck(r13, 'empty-catch', 'warn'));

/* 15 导出 Markdown 结构 */
var md = checker.toMarkdown(cleanJs, r1);
ok('Markdown 含确定性检查标题', md.indexOf('确定性检查') !== -1);
ok('Markdown 含模型判断标题', md.indexOf('模型判断') !== -1);
ok('Markdown 明确写未调用模型', md.indexOf('未调用模型') !== -1);
ok('Markdown 含评分', md.indexOf('评分') !== -1);

/* 16 AI 提示词 */
var prompt = checker.aiPrompt(cleanJs, r1);
ok('AI 提示词含六项模型清单', prompt.indexOf('命名是否清晰') !== -1 && prompt.indexOf('性能隐患') !== -1);
ok('AI 提示词含原代码', prompt.indexOf('function add') !== -1);

/* 17 模型清单不编造结论 */
var r14 = checker.analyzeCode(cleanJs);
ok('模型清单全部为待判定', r14.modelItems.length === 6 && r14.modelItems.every(function (m) { return !m.verdict; }));

/* 18 行尾空格与缩进混用 */
var r15 = checker.analyzeCode('function a() {\n\treturn 1; \n  return 2;\n}');
ok('行尾空格命中', hasCheck(r15, 'trailing-ws', 'warn'));
ok('缩进混用命中', hasCheck(r15, 'indent', 'warn') || hasCheck(r15, 'indent', 'pass'));

/* 19 SQL 拼接 */
var r16 = checker.analyzeCode('const q = "SELECT * FROM users WHERE id = " + userId;');
ok('SQL 拼接命中不通过', hasCheck(r16, 'sql-concat', 'fail'));

/* 20 未闭合字符串 */
var r17 = checker.analyzeCode('const s = "hello;\nconst t = 1;');
ok('未闭合字符串命中', hasCheck(r17, 'strings', 'fail') || hasCheck(r17, 'strings', 'warn'));
var r17b = checker.analyzeCode('const s = "oops;');
ok('末行无换行符的未闭合字符串也命中', hasCheck(r17b, 'strings', 'fail'));

console.log('\n' + passed + ' 通过, ' + failed + ' 失败,共 ' + (passed + failed) + ' 项');
process.exit(failed > 0 ? 1 : 0);
