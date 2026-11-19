/* AI 代码验收报告 - 确定性检查核心
 * 纯前端、无后端、不调用任何模型。所有检查均由代码本身算出,
 * 结果与"模型判断"严格分开,绝不把算出来的东西包装成模型结论。
 * UMD: 浏览器里挂 window.CodeChecker, Node 里 module.exports。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.CodeChecker = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = '1.0.0';

  /* ---------------- 工具 ---------------- */

  function trim(s) { return s.replace(/^\s+|\s+$/g, ''); }

  function escapeReg(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  /* ---------------- 语言检测 ---------------- */

  var LANG_RULES = [
    { lang: 'Python', rules: [
      [/\bdef\s+\w+\s*\(/, 4], [/\bimport\s+[\w.]+/, 2], [/\bfrom\s+[\w.]+\s+import\b/, 3],
      [/\bprint\s*\(/, 2], [/\belif\b/, 4], [/\bNone\b/, 2], [/\bself\b/, 2],
      [/\blambda\b/, 3], [/^\s*class\s+\w+\s*:/m, 2], [/\b__\w+__\b/, 2],
      [/^\s*if\s+__name__\s*==/, 4], [/\bexcept\b/, 2], [/\basync\s+def\b/, 4]
    ]},
    { lang: 'JavaScript', rules: [
      [/\bfunction\s+\w*\s*\(/, 3], [/\bconst\s+\w+\s*=/, 2], [/\blet\s+\w+\s*=/, 2],
      [/\bvar\s+\w+\s*=/, 2], [/=>/, 3], [/\bconsole\.\w+\s*\(/, 3],
      [/\brequire\s*\(/, 3], [/\bmodule\.exports\b/, 3], [/\bexport\s+(default\s+)?(function|const|class)\b/, 3],
      [/===|!==/, 2], [/\bdocument\.\w+/, 3], [/\bwindow\.\w+/, 2], [/\bprocess\.\w+/, 2]
    ]},
    { lang: 'TypeScript', rules: [
      [/\binterface\s+\w+\s*\{/, 5], [/\btype\s+\w+\s*=/, 4],
      [/:\s*(string|number|boolean|any|void|unknown)\b/, 3],
      [/\bimport\s+\{[^}]*\}\s+from\s+['"]/, 2], [/\bextends\s+\w+<[^>]+>/, 3],
      [/\bas\s+\w+/, 1], [/\benum\s+\w+\s*\{/, 4]
    ]},
    { lang: 'Java', rules: [
      [/\bpublic\s+class\s+\w+/, 5], [/\bpublic\s+static\s+void\s+main\b/, 5],
      [/\bSystem\.out\.print/, 4], [/\bprivate\s+\w+\s+\w+\s*;/, 2],
      [/\bimport\s+java\./, 4], [/\b@Override\b/, 3], [/\bString\[\]\s+args\b/, 4],
      [/\bnew\s+\w+\s*\(/, 1]
    ]},
    { lang: 'Go', rules: [
      [/^\s*package\s+\w+/m, 5], [/\bfunc\s+\w+\s*\(/, 4], [/\bfmt\.\w+\s*\(/, 3],
      [/:=/, 3], [/\bgo\s+func\b/, 4], [/\bdefer\b/, 2], [/\bchan\b/, 3]
    ]},
    { lang: 'Rust', rules: [
      [/\bfn\s+\w+\s*\(/, 4], [/\blet\s+mut\b/, 3], [/\bprintln!\s*\(/, 3],
      [/\bimpl\s+\w+/, 3], [/\buse\s+std::/, 4], [/\bmatch\s+\w+\s*\{/, 3],
      [/\bpub\s+(fn|struct|enum)\b/, 3]
    ]},
    { lang: 'C / C++', rules: [
      [/#include\s*[<"]/, 5], [/\bint\s+main\s*\(/, 4], [/\bstd::/, 4],
      [/\bprintf\s*\(/, 3], [/\bcout\s*<</, 4], [/\bnullptr\b/, 3],
      [/\btemplate\s*</, 3], [/\bnamespace\s+\w+/, 3]
    ]},
    { lang: 'Ruby', rules: [
      [/\bputs\s+/, 3], [/\bdef\s+\w+/, 2], [/\bend\s*$/, 1],
      [/\brequire\s+['"]/, 3], [/\battr_accessor\b/, 4], [/\bdo\s*\|/, 2]
    ]},
    { lang: 'PHP', rules: [
      [/<\?php/, 5], [/\$\w+\s*=/, 2], [/\becho\s+/, 2], [/\bfunction\s+\w+\s*\(/, 1],
      [/\$_GET|\$_POST|\$_SESSION/, 4]
    ]},
    { lang: 'Shell', rules: [
      [/^#!\/bin\/(ba)?sh/m, 5], [/^#!\/usr\/bin\/env\s+bash/m, 5],
      [/\becho\s+["']/, 2], [/\bif\s+\[\s/, 3], [/\bfi\s*$/, 2], [/\bdone\s*$/, 2]
    ]},
    { lang: 'SQL', rules: [
      [/\bSELECT\b.+?\bFROM\b/i, 5], [/\bINSERT\s+INTO\b/i, 4], [/\bCREATE\s+TABLE\b/i, 5],
      [/\bUPDATE\b.+?\bSET\b/i, 4], [/\bDELETE\s+FROM\b/i, 4], [/\bWHERE\b/i, 1]
    ]},
    { lang: 'HTML', rules: [
      [/<!DOCTYPE\s+html/i, 5], [/<html[\s>]/i, 4], [/<div[\s>]/i, 2],
      [/<script[\s>]/i, 2], [/<head[\s>]/i, 3], [/<body[\s>]/i, 3]
    ]},
    { lang: 'CSS', rules: [
      [/^\s*[\w.#:][^{]*\{[^}]*:\s*[^;]+;/m, 3], [/@media\s+/, 4],
      [/\bdisplay\s*:\s*(flex|grid|block)\b/, 3], [/\bmargin\s*:/, 1]
    ]}
  ];

  function detectLanguage(code) {
    var t = trim(code);
    if (!t) return { lang: '未知', confidence: 0 };
    if (t.charAt(0) === '{' || t.charAt(0) === '[') {
      try { JSON.parse(t); return { lang: 'JSON', confidence: 1 }; }
      catch (e) {
        // 解析失败,但形似 JSON(带引号的键),仍按 JSON 走,让 JSON 检查报出具体错误
        if (/^[\{\[][\s\S]*[\}\]]$/.test(t) && /"[A-Za-z0-9_ ]+"\s*:/.test(t)) {
          return { lang: 'JSON', confidence: 0.5 };
        }
      }
    }
    var best = null, bestScore = 0, second = 0;
    LANG_RULES.forEach(function (rule) {
      var score = 0;
      rule.rules.forEach(function (r) { if (r[0].test(code)) score += r[1]; });
      if (score > bestScore) { second = bestScore; bestScore = score; best = rule.lang; }
      else if (score > second) { second = score; }
    });
    if (!best || bestScore < 3) return { lang: '未知', confidence: 0 };
    var conf = bestScore >= 8 ? 0.95 : bestScore >= 5 ? 0.8 : 0.6;
    return { lang: best, confidence: conf };
  }

  /* ---------------- 清洗: 去字符串与注释,保留行号 ----------------
   * 返回 { cleanLines, unclosedStringLines, blockCommentOpen }
   * cleanLines: 与原文同行数,字符串内容与注释被替换为空格。
   */
  function cleanCode(code, lang) {
    var family = 'c';
    if (lang === 'Python' || lang === 'Ruby' || lang === 'Shell') family = 'hash';
    if (lang === 'SQL') family = 'sql';
    if (lang === 'HTML') family = 'html';
    if (lang === 'CSS') family = 'css';

    var out = [];
    var state = 'normal'; // normal | squote | dquote | bquote | tsquote | tdquote | lineComment | blockComment | htmlComment
    var unclosed = [];
    var cur = '';
    var i = 0, n = code.length;
    var line = 1;

    function pushLine() {
      out.push(cur); cur = ''; line++;
      if (state === 'lineComment') state = 'normal';
      if (state === 'squote' || state === 'dquote') {
        // 单双引号字符串跨行即未闭合,记下行号后复位
        if (unclosed.indexOf(line - 1) === -1) unclosed.push(line - 1);
        state = 'normal';
      }
    }

    while (i < n) {
      var ch = code[i], nx = code[i + 1] || '';
      if (ch === '\n') { pushLine(); i++; continue; }

      if (state === 'normal') {
        if (family === 'html' && ch === '<' && code.substr(i, 4) === '<!--') {
          state = 'htmlComment'; cur += '    '; i += 4; continue;
        }
        if ((family === 'c' || family === 'css') && ch === '/' && nx === '*') {
          state = 'blockComment'; cur += '  '; i += 2; continue;
        }
        if (family === 'sql' && ch === '/' && nx === '*') {
          state = 'blockComment'; cur += '  '; i += 2; continue;
        }
        if (family === 'c' && ch === '/' && nx === '/') {
          state = 'lineComment'; cur += '  '; i += 2; continue;
        }
        if ((family === 'hash' || family === 'sql') && ch === '#') {
          state = 'lineComment'; cur += ' '; i++; continue;
        }
        if (family === 'sql' && ch === '-' && nx === '-') {
          state = 'lineComment'; cur += '  '; i += 2; continue;
        }
        if (ch === "'") {
          if (family === 'hash' && code.substr(i, 3) === "'''") { state = 'tsquote'; cur += "'''"; i += 3; continue; }
          state = 'squote'; cur += "'"; i++; continue;
        }
        if (ch === '"') {
          if (family === 'hash' && code.substr(i, 3) === '"""') { state = 'tdquote'; cur += '"""'; i += 3; continue; }
          state = 'dquote'; cur += '"'; i++; continue;
        }
        if (ch === '`' && family === 'c') { state = 'bquote'; cur += '`'; i++; continue; }
        cur += ch; i++; continue;
      }

      if (state === 'lineComment') { cur += ' '; i++; continue; }

      if (state === 'blockComment') {
        if (ch === '*' && nx === '/') { state = 'normal'; cur += '  '; i += 2; continue; }
        cur += ' '; i++; continue;
      }

      if (state === 'htmlComment') {
        if (code.substr(i, 3) === '-->') { state = 'normal'; cur += '   '; i += 3; continue; }
        cur += ' '; i++; continue;
      }

      if (state === 'squote' || state === 'dquote') {
        var q = state === 'squote' ? "'" : '"';
        if (ch === '\\') { cur += '  '; i += 2; continue; }
        if (ch === q) { state = 'normal'; cur += q; i++; continue; }
        cur += ' '; i++; continue;
      }

      if (state === 'bquote') {
        if (ch === '\\') { cur += '  '; i += 2; continue; }
        if (ch === '`') { state = 'normal'; cur += '`'; i++; continue; }
        cur += ' '; i++; continue;
      }

      if (state === 'tsquote') {
        if (code.substr(i, 3) === "'''") { state = 'normal'; cur += "'''"; i += 3; continue; }
        cur += ' '; i++; continue;
      }

      if (state === 'tdquote') {
        if (code.substr(i, 3) === '"""') { state = 'normal'; cur += '"""'; i += 3; continue; }
        cur += ' '; i++; continue;
      }
    }
    out.push(cur);
    // 文件最后一行没有换行符时,上面 pushLine 里的检测不会触发,在此补上
    if (state === 'squote' || state === 'dquote') {
      if (unclosed.indexOf(line) === -1) unclosed.push(line);
    }
    return {
      cleanLines: out,
      unclosedStringLines: unclosed,
      blockCommentOpen: state === 'blockComment'
    };
  }

  /* ---------------- 括号平衡 ---------------- */

  function checkBrackets(cleanLines) {
    var stack = [];
    var pairs = { ')': '(', ']': '[', '}': '{' };
    var problems = [];
    cleanLines.forEach(function (line, idx) {
      var ln = idx + 1;
      for (var k = 0; k < line.length; k++) {
        var ch = line[k];
        if (ch === '(' || ch === '[' || ch === '{') stack.push({ ch: ch, line: ln });
        else if (pairs[ch]) {
          var top = stack.pop();
          if (!top) { problems.push({ type: 'extra-close', ch: ch, line: ln }); }
          else if (top.ch !== pairs[ch]) {
            problems.push({ type: 'mismatch', open: top.ch, openLine: top.line, close: ch, line: ln });
          }
        }
      }
    });
    stack.forEach(function (left) {
      problems.push({ type: 'unclosed', ch: left.ch, line: left.line });
    });
    return problems;
  }

  /* ---------------- 函数切分(估算) ---------------- */

  var FUNC_PATTERNS = {
    'JavaScript': [/^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)/, /^\s*(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/, /^\s*(?:async\s+)?(\w+)\s*\([^)]*\)\s*\{/],
    'TypeScript': [/^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)/, /^\s*(?:const|let|var)\s+(\w+)\s*[:=]/, /^\s*(?:public\s+|private\s+|protected\s+)?(?:async\s+)?(\w+)\s*\([^)]*\)\s*[:{]/],
    'Python': [/^(\s*)def\s+(\w+)\s*\(/],
    'Java': [/^\s*(?:public|private|protected)?\s*(?:static\s+)?[\w<>\[\]]+\s+(\w+)\s*\(/],
    'Go': [/^\s*func\s+(?:\(\w+\s+\*?\w+\)\s*)?(\w+)\s*\(/],
    'Rust': [/^\s*(?:pub\s+)?fn\s+(\w+)\s*\(/],
    'C / C++': [/^\s*[\w\*]+\s+(\w+)\s*\([^;]*\)\s*\{/],
    'Ruby': [/^\s*def\s+(\w+)/],
    'PHP': [/^\s*function\s+(\w+)\s*\(/]
  };

  function findFunctions(cleanLines, lang) {
    var pats = FUNC_PATTERNS[lang] || FUNC_PATTERNS['JavaScript'];
    var fns = [];
    cleanLines.forEach(function (line, idx) {
      var name = null;
      for (var p = 0; p < pats.length; p++) {
        var m = line.match(pats[p]);
        if (m) {
          if (lang === 'Python') { name = m[2]; }
          else { name = m[1]; }
          // 排除控制语句误判
          if (name && !/^(if|for|while|switch|catch|return|else)$/.test(name)) break;
          name = null;
        }
      }
      if (name) fns.push({ name: name, start: idx + 1, end: cleanLines.length });
    });
    fns.forEach(function (fn, i) {
      var end = (i + 1 < fns.length) ? fns[i + 1].start - 1 : cleanLines.length;
      // Python:函数在下一个顶格 def/class 处结束
      if (lang === 'Python') {
        for (var l = fn.start; l < cleanLines.length; l++) {
          if (/^\S/.test(cleanLines[l]) && /^(def|class)\s/.test(cleanLines[l])) { end = l; break; }
        }
      }
      fn.end = end;
      fn.lines = Math.max(1, end - fn.start + 1);
    });
    return fns;
  }

  /* ---------------- 复杂度(估算) ---------------- */

  function countDecisions(cleanLines, lang) {
    var kw;
    if (lang === 'Python' || lang === 'Ruby') {
      kw = /\b(if|elif|for|while|except|and|or)\b|&&|\|\|/g;
    } else {
      kw = /\b(if|else\s+if|for|while|case|catch|switch)\b|&&|\|\||\?\?/g;
    }
    var total = 0;
    var perLine = [];
    cleanLines.forEach(function (line, idx) {
      var m = line.match(kw);
      var c = m ? m.length : 0;
      // 三元运算符 ? : (排除 ?. 与 ??,已在上面排除 ?? 本身不计入三元)
      if (lang !== 'Python' && lang !== 'Ruby') {
        var tern = line.replace(/\?\./g, '').replace(/\?\?/g, '').match(/\?/g);
        if (tern) c += tern.length;
      }
      if (c > 0) perLine.push({ line: idx + 1, count: c });
      total += c;
    });
    return { total: total, perLine: perLine };
  }

  /* ---------------- 主分析 ---------------- */

  var SECRET_PATTERNS = [
    { name: '密码/密钥字面量', re: /(password|passwd|pwd|secret|api[_-]?key|access[_-]?token|private[_-]?key)\s*[:=]\s*['"][^'"]{4,}['"]/i },
    { name: 'OpenAI 风格密钥', re: /sk-[A-Za-z0-9]{16,}/ },
    { name: 'AWS Access Key', re: /AKIA[0-9A-Z]{16}/ },
    { name: 'GitHub Token', re: /(ghp_|gho_|github_pat_)[A-Za-z0-9_]{15,}/ },
    { name: 'Slack Token', re: /xox[baprs]-[A-Za-z0-9-]{10,}/ },
    { name: '私钥文件头', re: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ }
  ];

  function analyzeCode(code) {
    var rawLines = code.split('\n');
    var totalLines = rawLines.length;
    if (trim(code) === '') {
      return { empty: true, score: null, grade: null, language: '未知', checks: [], modelItems: modelItems(), metrics: null };
    }

    var langInfo = detectLanguage(code);
    var lang = langInfo.lang;
    var cleaned = cleanCode(code, lang);
    var cleanLines = cleaned.cleanLines;

    var checks = [];
    function add(id, title, status, detail, lines, evidence) {
      checks.push({ id: id, title: title, status: status, detail: detail || '', lines: lines || [], evidence: evidence || [] });
    }

    /* --- 度量 --- */
    var codeLines = 0, blankLines = 0, commentLines = 0;
    var maxLineLen = 0, maxLineNo = 0, charCount = code.length;
    rawLines.forEach(function (raw, idx) {
      var t = trim(raw), c = trim(cleanLines[idx] || '');
      if (t === '') blankLines++;
      else if (c === '' && t !== '') commentLines++;
      else codeLines++;
      if (raw.length > maxLineLen) { maxLineLen = raw.length; maxLineNo = idx + 1; }
    });
    var commentRatio = codeLines > 0 ? Math.round(commentLines / (codeLines + commentLines) * 100) : 0;
    var decisions = countDecisions(cleanLines, lang);
    var complexity = decisions.total + 1;
    var fns = findFunctions(cleanLines, lang);
    fns.forEach(function (fn) {
      var d = 0;
      for (var l = fn.start - 1; l < Math.min(fn.end, cleanLines.length); l++) {
        var m = (cleanLines[l] || '').match(/\b(if|elif|for|while|except|and|or|case|catch|switch)\b|&&|\|\|/g);
        if (m) d += m.length;
      }
      fn.decisions = d;
      fn.complexity = d + 1;
    });
    var maxFn = null;
    fns.forEach(function (fn) { if (!maxFn || fn.lines > maxFn.lines) maxFn = fn; });
    var avgFnLen = fns.length ? Math.round(fns.reduce(function (a, f) { return a + f.lines; }, 0) / fns.length) : 0;
    var maxFnComplexity = 0, maxFnCx = null;
    fns.forEach(function (fn) { if (fn.complexity > maxFnComplexity) { maxFnComplexity = fn.complexity; maxFnCx = fn; } });

    var metrics = {
      totalLines: totalLines, codeLines: codeLines, blankLines: blankLines,
      commentLines: commentLines, commentRatio: commentRatio, charCount: charCount,
      maxLineLength: maxLineLen, maxLineNo: maxLineNo,
      functionCount: fns.length, avgFunctionLength: avgFnLen,
      maxFunctionLength: maxFn ? maxFn.lines : 0, maxFunctionName: maxFn ? maxFn.name : null,
      complexity: complexity, decisionPoints: decisions.total,
      maxFunctionComplexity: maxFnComplexity,
      maxFunctionComplexityName: maxFnCx ? maxFnCx.name : null
    };

    /* --- 1 括号平衡 --- */
    var bracketProblems = checkBrackets(cleanLines);
    if (bracketProblems.length === 0) {
      add('brackets', '括号配对', 'pass', '圆括号、方括号、花括号全部配对,未发现多余或缺失。');
    } else {
      var bp = bracketProblems.slice(0, 5).map(function (p) {
        if (p.type === 'extra-close') return '第 ' + p.line + ' 行有多余的 ' + p.ch;
        if (p.type === 'mismatch') return '第 ' + p.openLine + ' 行的 ' + p.open + ' 与第 ' + p.line + ' 行的 ' + p.close + ' 不匹配';
        return '第 ' + p.line + ' 行的 ' + p.ch + ' 没有闭合';
      });
      add('brackets', '括号配对', 'fail', '发现 ' + bracketProblems.length + ' 处括号问题,代码很可能无法运行。',
        bracketProblems.slice(0, 5).map(function (p) { return p.line; }), bp);
    }

    /* --- 2 未闭合字符串 --- */
    if (cleaned.unclosedStringLines.length === 0 && !cleaned.blockCommentOpen) {
      add('strings', '字符串与注释闭合', 'pass', '未发现跨行未闭合的字符串,块注释均已闭合。');
    } else {
      var det = [];
      if (cleaned.unclosedStringLines.length) det.push('疑似未闭合字符串在第 ' + cleaned.unclosedStringLines.slice(0, 5).join('、') + ' 行');
      if (cleaned.blockCommentOpen) det.push('文件末尾仍有未闭合的块注释');
      add('strings', '字符串与注释闭合', 'fail', det.join(';') + '。',
        cleaned.unclosedStringLines.slice(0, 5), det);
    }

    /* --- 3 JSON 合法性 --- */
    if (lang === 'JSON') {
      try {
        JSON.parse(code);
        add('json', 'JSON 格式合法', 'pass', '可以被 JSON.parse 正常解析。');
      } catch (e) {
        add('json', 'JSON 格式合法', 'fail', '解析失败:' + (e.message || '格式错误') + '。', [], [String(e.message || '')]);
      }
    }

    /* --- 4 超长行 --- */
    var longLines = [];
    rawLines.forEach(function (raw, idx) { if (raw.length > 120) longLines.push({ line: idx + 1, len: raw.length }); });
    if (longLines.length === 0) {
      add('long-lines', '行长度', 'pass', '没有超过 120 字符的行,最长 ' + maxLineLen + ' 字符(第 ' + maxLineNo + ' 行)。');
    } else if (longLines.length <= 3 && maxLineLen <= 200) {
      add('long-lines', '行长度', 'warn', longLines.length + ' 行超过 120 字符,最长 ' + maxLineLen + ' 字符(第 ' + maxLineNo + ' 行),建议拆行。',
        longLines.map(function (l) { return l.line; }),
        longLines.slice(0, 5).map(function (l) { return '第 ' + l.line + ' 行:' + l.len + ' 字符'; }));
    } else {
      add('long-lines', '行长度', 'fail', longLines.length + ' 行超过 120 字符,最长 ' + maxLineLen + ' 字符(第 ' + maxLineNo + ' 行),可读性较差。',
        longLines.map(function (l) { return l.line; }),
        longLines.slice(0, 5).map(function (l) { return '第 ' + l.line + ' 行:' + l.len + ' 字符'; }));
    }

    /* --- 5 行尾空格 --- */
    var trailing = [];
    rawLines.forEach(function (raw, idx) { if (/[ \t]+$/.test(raw) && trim(raw) !== '') trailing.push(idx + 1); });
    if (trailing.length === 0) {
      add('trailing-ws', '行尾空白', 'pass', '没有行尾多余空格或制表符。');
    } else {
      add('trailing-ws', '行尾空白', 'warn', trailing.length + ' 行行尾有多余空白,提交前可用编辑器自动清理。',
        trailing.slice(0, 5), ['第 ' + trailing.slice(0, 5).join('、') + ' 行']);
    }

    /* --- 6 缩进混用 --- */
    var tabIndent = 0, spaceIndent = 0, mixedLines = [];
    rawLines.forEach(function (raw, idx) {
      var m = raw.match(/^(\s+)\S/);
      if (!m) return;
      var lead = m[1];
      if (lead.indexOf('\t') !== -1 && lead.replace(/\t/g, '').length > 0) mixedLines.push(idx + 1);
      if (lead.indexOf('\t') !== -1) tabIndent++;
      else if (lead.indexOf(' ') !== -1) spaceIndent++;
    });
    if (tabIndent > 0 && spaceIndent > 0) {
      add('indent', '缩进一致性', 'warn', '制表符缩进 ' + tabIndent + ' 行、空格缩进 ' + spaceIndent + ' 行混用,容易在不同编辑器里错位。',
        mixedLines.slice(0, 5), mixedLines.length ? ['混用示例:第 ' + mixedLines.slice(0, 3).join('、') + ' 行'] : []);
    } else {
      add('indent', '缩进一致性', 'pass', tabIndent > 0 ? '全篇使用制表符缩进。' : '全篇使用空格缩进。');
    }

    /* --- 7 TODO 扫描 --- */
    var todos = [];
    rawLines.forEach(function (raw, idx) {
      var m = raw.match(/\b(TODO|FIXME|HACK|XXX|BUG)\b\s*:?\s*(.*)/);
      if (m) todos.push({ line: idx + 1, tag: m[1], text: trim(m[2]).slice(0, 60) });
    });
    if (todos.length === 0) {
      add('todos', '待办标记扫描', 'pass', '没有 TODO、FIXME、HACK 等未处理标记。');
    } else {
      add('todos', '待办标记扫描', 'warn', '发现 ' + todos.length + ' 处待办标记,上线前确认是否都已处理。',
        todos.map(function (t) { return t.line; }),
        todos.slice(0, 5).map(function (t) { return '第 ' + t.line + ' 行 ' + t.tag + (t.text ? ': ' + t.text : ''); }));
    }

    /* --- 8 调试残留 --- */
    var debugPats = [];
    if (lang === 'JavaScript' || lang === 'TypeScript' || lang === '未知') {
      debugPats.push({ re: /\bconsole\.(log|debug|info|warn)\s*\(/, name: 'console.log 调试输出' });
      debugPats.push({ re: /\bdebugger\b/, name: 'debugger 断点' });
      debugPats.push({ re: /\balert\s*\(/, name: 'alert 弹窗' });
    }
    if (lang === 'Python') {
      debugPats.push({ re: /\bprint\s*\(/, name: 'print 调试输出' });
      debugPats.push({ re: /\bbreakpoint\s*\(/, name: 'breakpoint 断点' });
      debugPats.push({ re: /\bimport\s+pdb\b/, name: 'pdb 调试器' });
    }
    if (lang === 'Java') {
      debugPats.push({ re: /System\.out\.print/, name: 'System.out 调试输出' });
    }
    if (lang === 'Go') {
      debugPats.push({ re: /\bfmt\.Print/, name: 'fmt.Print 调试输出' });
    }
    var debugHits = [];
    cleanLines.forEach(function (line, idx) {
      debugPats.forEach(function (p) {
        if (p.re.test(line)) debugHits.push({ line: idx + 1, name: p.name });
      });
    });
    if (debugHits.length === 0) {
      add('debug', '调试代码残留', 'pass', '没有发现调试输出或断点残留。');
    } else {
      add('debug', '调试代码残留', 'warn', '发现 ' + debugHits.length + ' 处疑似调试代码,上线前建议清理。',
        debugHits.map(function (d) { return d.line; }),
        debugHits.slice(0, 5).map(function (d) { return '第 ' + d.line + ' 行: ' + d.name; }));
    }

    /* --- 9 空异常处理 --- */
    var emptyCatch = [];
    for (var ci = 0; ci < cleanLines.length; ci++) {
      var cl = cleanLines[ci];
      if (/\bcatch\s*\([^)]*\)\s*\{\s*$/.test(cl) || /\bcatch\s*:/.test(cl)) {
        var next = trim(cleanLines[ci + 1] || '');
        if (next === '}' || next === '') emptyCatch.push(ci + 1);
      }
      if (/^\s*except\s*:/.test(cl) || /^\s*except\s+\w+\s*:/.test(cl)) {
        var nx = trim(cleanLines[ci + 1] || '');
        if (nx === 'pass' || nx === '') emptyCatch.push(ci + 1);
      }
    }
    if (emptyCatch.length === 0) {
      add('empty-catch', '空异常处理', 'pass', '没有发现吞掉异常的空 catch / except 块。');
    } else {
      add('empty-catch', '空异常处理', 'warn', '发现 ' + emptyCatch.length + ' 处空异常处理,异常被静默吞掉,出问题难定位。',
        emptyCatch.slice(0, 5), ['第 ' + emptyCatch.slice(0, 5).join('、') + ' 行附近']);
    }

    /* --- 10 危险调用 --- */
    var dangerPats = [
      { re: /\beval\s*\(/, name: 'eval() 动态执行' },
      { re: /\bnew\s+Function\s*\(/, name: 'new Function() 动态执行' },
      { re: /\.innerHTML\s*=/, name: 'innerHTML 赋值(XSS 风险)' },
      { re: /\bdocument\.write\s*\(/, name: 'document.write()' },
      { re: /\.outerHTML\s*=/, name: 'outerHTML 赋值(XSS 风险)' }
    ];
    var dangerHits = [];
    cleanLines.forEach(function (line, idx) {
      dangerPats.forEach(function (p) { if (p.re.test(line)) dangerHits.push({ line: idx + 1, name: p.name }); });
    });
    if (dangerHits.length === 0) {
      add('danger', '危险调用', 'pass', '没有 eval、innerHTML 等高风险调用。');
    } else {
      add('danger', '危险调用', 'fail', '发现 ' + dangerHits.length + ' 处高风险调用,建议改用安全写法。',
        dangerHits.map(function (d) { return d.line; }),
        dangerHits.slice(0, 5).map(function (d) { return '第 ' + d.line + ' 行: ' + d.name; }));
    }

    /* --- 11 硬编码密钥 --- */
    var secretHits = [];
    rawLines.forEach(function (raw, idx) {
      var t = trim(raw);
      if (/^(\/\/|#|\*)/.test(t)) return;
      SECRET_PATTERNS.forEach(function (p) {
        if (p.re.test(raw)) secretHits.push({ line: idx + 1, name: p.name });
      });
    });
    if (secretHits.length === 0) {
      add('secrets', '硬编码密钥', 'pass', '没有发现疑似硬编码的密码、密钥或 Token。');
    } else {
      add('secrets', '硬编码密钥', 'fail', '发现 ' + secretHits.length + ' 处疑似硬编码密钥,绝不能提交到仓库,应改走环境变量或密钥管理。',
        secretHits.map(function (s) { return s.line; }),
        secretHits.slice(0, 5).map(function (s) { return '第 ' + s.line + ' 行: ' + s.name; }));
    }

    /* --- 12 宽松相等 --- */
    var looseHits = [];
    if (lang === 'JavaScript' || lang === 'TypeScript' || lang === '未知') {
      cleanLines.forEach(function (line, idx) {
        var stripped = line.replace(/===/g, '').replace(/!==/g, '');
        if (/[^=!]==[^=]/.test(stripped) || /[^=!]!=[^=]/.test(stripped)) looseHits.push(idx + 1);
      });
    }
    if (lang === 'Python') {
      cleanLines.forEach(function (line, idx) {
        if (/==\s*None\b/.test(line) || /!=\s*None\b/.test(line)) looseHits.push(idx + 1);
      });
    }
    if (looseHits.length === 0) {
      add('equality', '相等比较写法', 'pass', lang === 'Python' ? '与 None 的比较写法无问题。' : '未发现宽松相等 == / !=,建议保持使用 === / !==。');
    } else {
      add('equality', '相等比较写法', 'warn', '发现 ' + looseHits.length + ' 处宽松比较,可能因隐式类型转换出 bug。',
        looseHits.slice(0, 5), ['第 ' + looseHits.slice(0, 5).join('、') + ' 行']);
    }

    /* --- 13 圈复杂度(估算) --- */
    if (complexity <= 10) {
      add('complexity', '圈复杂度(估算)', 'pass', '整文件圈复杂度约 ' + complexity + ',分支结构简单,易读易测。');
    } else if (complexity <= 20) {
      add('complexity', '圈复杂度(估算)', 'warn', '整文件圈复杂度约 ' + complexity + ',分支偏多,建议拆分函数。',
        [], maxFnCx ? ['最复杂函数 ' + maxFnCx.name + ' 约 ' + maxFnCx.complexity] : []);
    } else {
      add('complexity', '圈复杂度(估算)', 'fail', '整文件圈复杂度约 ' + complexity + ',分支过多,强烈建议拆分。',
        [], maxFnCx ? ['最复杂函数 ' + maxFnCx.name + ' 约 ' + maxFnCx.complexity] : []);
    }

    /* --- 14 过长函数 --- */
    var longFns = fns.filter(function (f) { return f.lines > 50; });
    if (fns.length === 0) {
      add('long-fns', '函数长度', 'pass', '未识别到函数定义,跳过本项。');
    } else if (longFns.length === 0) {
      add('long-fns', '函数长度', 'pass', '共 ' + fns.length + ' 个函数,最长 ' + (maxFn ? maxFn.lines : 0) + ' 行(' + (maxFn ? maxFn.name : '') + '),均在 50 行内。');
    } else {
      add('long-fns', '函数长度', 'warn', longFns.length + ' 个函数超过 50 行,建议按职责拆分。',
        longFns.map(function (f) { return f.start; }),
        longFns.slice(0, 5).map(function (f) { return f.name + ': ' + f.lines + ' 行(第 ' + f.start + ' 行起)'; }));
    }

    /* --- 15 重复行 --- */
    var seen = {};
    cleanLines.forEach(function (line, idx) {
      var t = trim(line).replace(/\s+/g, ' ');
      if (t.length < 10) return;
      if (/^(import|from|require|#include|package|use)\b/.test(t)) return;
      if (/^[{}();,]+$/.test(t)) return;
      if (!seen[t]) seen[t] = [];
      seen[t].push(idx + 1);
    });
    var dupGroups = [];
    Object.keys(seen).forEach(function (k) {
      if (seen[k].length >= 3) dupGroups.push({ text: k.slice(0, 80), lines: seen[k] });
    });
    dupGroups.sort(function (a, b) { return b.lines.length - a.lines.length; });
    if (dupGroups.length === 0) {
      add('duplicates', '重复代码行', 'pass', '没有同一行代码出现 3 次以上的情况。');
    } else {
      add('duplicates', '重复代码行', 'warn', '发现 ' + dupGroups.length + ' 组重复行,出现 3 次以上的相同代码行建议抽成函数或常量。',
        dupGroups.slice(0, 3).reduce(function (a, g) { return a.concat(g.lines.slice(0, 3)); }, []),
        dupGroups.slice(0, 3).map(function (g) { return '"' + g.text + '" 出现 ' + g.lines.length + ' 次(第 ' + g.lines.slice(0, 3).join('、') + ' 行)'; }));
    }

    /* --- 16 魔法数字 --- */
    var magic = [];
    cleanLines.forEach(function (line, idx) {
      var m = line.match(/(?<![\w.])(-?\d+(?:\.\d+)?)(?![\w.])/g);
      if (!m) return;
      m.forEach(function (num) {
        var v = parseFloat(num);
        if ([0, 1, 2, 10, 100, 1000, -1].indexOf(v) !== -1) return;
        magic.push({ line: idx + 1, num: num });
      });
    });
    if (magic.length < 3) {
      add('magic-numbers', '魔法数字', 'pass', '未发现滥用的魔法数字。');
    } else {
      add('magic-numbers', '魔法数字', 'warn', '发现 ' + magic.length + ' 处魔法数字,建议用具名常量代替,改一处不用满文件找。',
        magic.slice(0, 5).map(function (x) { return x.line; }),
        magic.slice(0, 5).map(function (x) { return '第 ' + x.line + ' 行: ' + x.num; }));
    }

    /* --- 17 注释占比 --- */
    if (codeLines < 20) {
      add('comments', '注释占比', 'pass', '代码不足 20 行,注释占比不做要求。');
    } else if (commentRatio >= 5) {
      add('comments', '注释占比', 'pass', '注释占比 ' + commentRatio + '%(' + commentLines + '/' + (codeLines + commentLines) + ' 行)。');
    } else {
      add('comments', '注释占比', 'warn', '注释占比仅 ' + commentRatio + '%,复杂逻辑处建议补注释。');
    }

    /* --- 18 文件末尾换行 --- */
    if (code.charAt(code.length - 1) === '\n') {
      add('final-newline', '文件末尾换行', 'pass', '文件以换行符结尾,符合 POSIX 惯例。');
    } else {
      add('final-newline', '文件末尾换行', 'warn', '文件末尾缺少换行符,部分工具 diff 会显示异常。');
    }

    /* --- 19 SQL 拼接(跑在原始行上,因为 SQL 关键字在字符串里,清洗会去掉) --- */
    var sqlHits = [];
    rawLines.forEach(function (line, idx) {
      var t = trim(line);
      if (/^(\/\/|#|\*)/.test(t)) return;
      if (/\b(SELECT|INSERT|UPDATE|DELETE)\b/i.test(line) && /\+/.test(line)) sqlHits.push(idx + 1);
    });
    if (sqlHits.length === 0) {
      add('sql-concat', 'SQL 字符串拼接', 'pass', '没有发现 SQL 语句用 + 拼接变量(注入风险点)。');
    } else {
      add('sql-concat', 'SQL 字符串拼接', 'fail', '发现 ' + sqlHits.length + ' 处 SQL 语句拼接变量,存在注入风险,应改用参数化查询。',
        sqlHits.slice(0, 5), ['第 ' + sqlHits.slice(0, 5).join('、') + ' 行']);
    }

    /* --- 20 文件规模 --- */
    if (totalLines <= 1000) {
      add('size', '文件规模', 'pass', '共 ' + totalLines + ' 行,一次评审可以看完。');
    } else {
      add('size', '文件规模', 'warn', '共 ' + totalLines + ' 行,建议按模块拆文件再逐个验收。');
    }

    /* --- 评分 --- */
    var score = 100;
    checks.forEach(function (c) {
      if (c.status === 'fail') score -= 10;
      else if (c.status === 'warn') score -= 4;
    });
    score = Math.max(0, score);
    var grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : 'D';
    var passCount = checks.filter(function (c) { return c.status === 'pass'; }).length;
    var warnCount = checks.filter(function (c) { return c.status === 'warn'; }).length;
    var failCount = checks.filter(function (c) { return c.status === 'fail'; }).length;

    return {
      empty: false,
      language: lang,
      languageConfidence: langInfo.confidence,
      metrics: metrics,
      checks: checks,
      modelItems: modelItems(),
      score: score,
      grade: grade,
      counts: { pass: passCount, warn: warnCount, fail: failCount, total: checks.length }
    };
  }

  /* ---------------- 模型判断(未调用模型,仅列清单) ---------------- */

  function modelItems() {
    return [
      { title: '命名是否清晰', desc: '变量、函数、类名是否表达真实意图,有没有 a、b、tmp、data 这种含糊命名。' },
      { title: '逻辑是否正确', desc: '边界条件、空值、异常分支是否覆盖,核心算法有没有算错的可能。' },
      { title: '有没有结构性重复', desc: '多处相似逻辑是否应抽成公共函数,而不是只看字面相同的行。' },
      { title: '性能隐患', desc: '循环里有没有重复计算、重复查库,数据量大时会不会明显变慢。' },
      { title: '可读性与可维护性', desc: '函数职责是否单一,新人读这段代码要多久才能改得动。' },
      { title: '是否符合项目约定', desc: '目录结构、分层、错误处理方式是否和项目现有代码一致。' }
    ];
  }

  /* ---------------- 报告导出 Markdown ---------------- */

  function toMarkdown(code, result) {
    if (result.empty) return '# AI 代码验收报告\n\n未粘贴代码。\n';
    var L = [];
    L.push('# AI 代码验收报告');
    L.push('');
    L.push('- 语言: ' + result.language + (result.languageConfidence ? '(置信度约 ' + Math.round(result.languageConfidence * 100) + '%)' : ''));
    L.push('- 评分: ' + result.score + ' 分(' + result.grade + ' 级)');
    L.push('- 检查: ' + result.counts.total + ' 项,通过 ' + result.counts.pass + ' / 警告 ' + result.counts.warn + ' / 不通过 ' + result.counts.fail);
    L.push('- 规模: ' + result.metrics.totalLines + ' 行,代码 ' + result.metrics.codeLines + ' 行,注释 ' + result.metrics.commentLines + ' 行(' + result.metrics.commentRatio + '%),函数 ' + result.metrics.functionCount + ' 个,圈复杂度约 ' + result.metrics.complexity);
    L.push('');
    L.push('## 确定性检查(代码算的,共 ' + result.counts.total + ' 项)');
    L.push('');
    result.checks.forEach(function (c) {
      var mark = c.status === 'pass' ? '通过' : c.status === 'warn' ? '警告' : '不通过';
      L.push('### ' + mark + ' - ' + c.title);
      L.push('');
      L.push(c.detail);
      if (c.evidence && c.evidence.length) {
        L.push('');
        c.evidence.forEach(function (e) { L.push('- ' + e); });
      }
      L.push('');
    });
    L.push('## 模型判断(需 AI 模型判定,本页未调用模型,以下为待判定清单)');
    L.push('');
    result.modelItems.forEach(function (m) {
      L.push('- [ ] ' + m.title + ': ' + m.desc);
    });
    L.push('');
    L.push('---');
    L.push('说明:确定性检查由代码本身算出;模型判断需要把代码交给 AI 模型才能得出结论,本页不生成、不编造。');
    L.push('生成工具: AI 代码验收报告 v' + VERSION + '(静态页,本地运行,代码不上传)。');
    return L.join('\n');
  }

  function aiPrompt(code, result) {
    var L = [];
    L.push('请对下面这段代码做验收评审,按以下六点逐项给结论,每项写通过/不通过加一句话理由:');
    result.modelItems.forEach(function (m, i) { L.push((i + 1) + '. ' + m.title + ': ' + m.desc); });
    L.push('');
    L.push('确定性检查已经由工具算出,结果如下(供你参考,不用重复算):');
    result.checks.forEach(function (c) {
      var mark = c.status === 'pass' ? '通过' : c.status === 'warn' ? '警告' : '不通过';
      L.push('- [' + mark + '] ' + c.title + ': ' + c.detail);
    });
    L.push('');
    L.push('代码(' + result.language + ',约 ' + result.metrics.totalLines + ' 行):');
    L.push('```');
    L.push(code);
    L.push('```');
    return L.join('\n');
  }

  return {
    version: VERSION,
    analyzeCode: analyzeCode,
    detectLanguage: detectLanguage,
    toMarkdown: toMarkdown,
    aiPrompt: aiPrompt,
    modelItems: modelItems
  };
});
