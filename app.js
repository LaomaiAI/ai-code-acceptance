/* AI 代码验收报告 - 界面逻辑(纯前端,代码不上传) */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var input = $('codeInput'), runBtn = $('runBtn'), clearBtn = $('clearBtn');
  var reportPanel = $('reportPanel'), toast = $('toast');
  var lastCode = '', lastResult = null;

  var SAMPLES = {
    js: [
      'function calcTotal(items) {',
      '  // 按数量与单价算总价,满 100 减 10',
      '  let total = 0;',
      '  for (const item of items) {',
      '    total += item.price * item.qty;',
      '  }',
      '  if (total >= 100) {',
      '    total -= 10;',
      '  }',
      '  return total;',
      '}',
      '',
      'const items = [',
      '  { price: 39.9, qty: 2 },',
      '  { price: 12.5, qty: 1 }',
      '];',
      'console.log(calcTotal(items));'
    ].join('\n'),
    python: [
      'def fib(n):',
      '    """返回第 n 个斐波那契数。"""',
      '    if n <= 1:',
      '        return n',
      '    a, b = 0, 1',
      '    for _ in range(n - 1):',
      '        a, b = b, a + b',
      '    return b',
      '',
      '',
      'if __name__ == "__main__":',
      '    print(fib(10))'
    ].join('\n'),
    bad: [
      'const apiKey = "sk-abcdefghijklmnopqrstuv";',
      'function calc(x) {',
      '  // TODO: 边界情况还没处理',
      '  if (x == null) {',
      '    return 0;',
      '  }',
      '  let fee = x * 0.1375 + 42.5;',
      '  console.log("fee", fee);',
      '  try {',
      '    risky();',
      '  } catch (e) {',
      '  }',
      '  eval("fee * 2");',
      '  const q = "SELECT * FROM users WHERE id = " + x;',
      '  const a = 1;',
      '  const a = 1;',
      '  const a = 1;',
      '  return fee;',
      '',
      'const s = "oops;'
    ].join('\n'),
    json: [
      '{',
      '  "name": "ai-code-acceptance",',
      '  "version": "1.0.0",',
      '  "checks": 19,',
      '  "modelItems": 6,',
      '  "tags": ["code-review", "static", "no-backend"]',
      '}'
    ].join('\n')
  };

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function showToast(msg) {
    toast.textContent = msg;
    toast.hidden = false;
    setTimeout(function () { toast.hidden = true; }, 3000);
  }

  function updateMeta() {
    var code = input.value;
    var lines = code === '' ? 0 : code.split('\n').length;
    $('inputMeta').textContent = lines + ' 行 · ' + code.length + ' 字符';
    if (code.trim() !== '') {
      var lang = CodeChecker.detectLanguage(code).lang;
      $('langHint').textContent = '语言:' + lang;
    } else {
      $('langHint').textContent = '语言:未检测';
    }
  }

  function statusLabel(status) {
    return status === 'pass' ? '通过' : status === 'warn' ? '警告' : '不通过';
  }

  function render(result) {
    reportPanel.hidden = false;
    var m = result.metrics;
    $('scoreNum').textContent = result.score;
    var gradeEl = $('gradeBadge');
    gradeEl.textContent = result.grade + ' 级';
    gradeEl.className = 'grade g-' + result.grade;
    $('scoreSub').textContent = '语言:' + result.language +
      (result.languageConfidence ? '(置信度约 ' + Math.round(result.languageConfidence * 100) + '%)' : '') +
      ' · 共 ' + m.totalLines + ' 行';
    $('countsRow').innerHTML =
      '<b class="pass">通过 ' + result.counts.pass + '</b> · ' +
      '<b class="warn">警告 ' + result.counts.warn + '</b> · ' +
      '<b class="fail">不通过 ' + result.counts.fail + '</b> · 共 ' + result.counts.total + ' 项';
    $('reportMeta').textContent = '本地算出,用时不到 1 秒';

    var metricsHtml = [
      ['总行数', m.totalLines, '代码 ' + m.codeLines + ' 行'],
      ['注释占比', m.commentRatio + '%', m.commentLines + ' 行注释'],
      ['函数数', m.functionCount, '平均 ' + m.avgFunctionLength + ' 行/个'],
      ['最长函数', m.maxFunctionLength + ' 行', m.maxFunctionName ? m.maxFunctionName : '-'],
      ['圈复杂度', '约 ' + m.complexity, '决策点 ' + m.decisionPoints + ' 个'],
      ['最复杂函数', '约 ' + m.maxFunctionComplexity, m.maxFunctionComplexityName ? m.maxFunctionComplexityName : '-'],
      ['最长行', m.maxLineLength + ' 字符', '第 ' + m.maxLineNo + ' 行'],
      ['总字符', m.charCount, '含空白与注释']
    ].map(function (x) {
      return '<div class="metric"><div class="m-label">' + x[0] + '</div>' +
        '<div class="m-value">' + escapeHtml(String(x[1])) + '</div>' +
        '<div class="m-sub">' + escapeHtml(String(x[2])) + '</div></div>';
    }).join('');
    $('metricsGrid').innerHTML = metricsHtml;

    var checksHtml = result.checks.map(function (c) {
      var ev = '';
      if (c.evidence && c.evidence.length) {
        ev = '<ul class="evidence">' + c.evidence.map(function (e) {
          return '<li>' + escapeHtml(e) + '</li>';
        }).join('') + '</ul>';
      }
      return '<li class="check-item">' +
        '<div class="check-head"><span class="status ' + c.status + '">' + statusLabel(c.status) + '</span>' +
        '<span class="check-title">' + escapeHtml(c.title) + '</span></div>' +
        '<p class="check-detail">' + escapeHtml(c.detail) + '</p>' + ev + '</li>';
    }).join('');
    $('checkList').innerHTML = checksHtml;

    $('modelList').innerHTML = result.modelItems.map(function (item) {
      return '<li class="model-item">' +
        '<div class="check-head"><span class="status pending">待判定</span>' +
        '<span class="check-title">' + escapeHtml(item.title) + '</span></div>' +
        '<p class="check-detail">' + escapeHtml(item.desc) + '</p></li>';
    }).join('');

    reportPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function run() {
    var code = input.value;
    if (code.trim() === '') { showToast('请先粘贴代码。'); input.focus(); return; }
    lastCode = code;
    lastResult = CodeChecker.analyzeCode(code);
    render(lastResult);
  }

  function copyText(text, okMsg) {
    function done() { showToast(okMsg); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
    } else { fallbackCopy(text); done(); }
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* 忽略 */ }
    document.body.removeChild(ta);
  }

  runBtn.addEventListener('click', run);
  clearBtn.addEventListener('click', function () {
    input.value = '';
    reportPanel.hidden = true;
    lastCode = ''; lastResult = null;
    updateMeta();
    input.focus();
  });
  input.addEventListener('input', updateMeta);
  input.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); run(); }
  });
  document.querySelectorAll('[data-sample]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      input.value = SAMPLES[btn.getAttribute('data-sample')] || '';
      updateMeta();
      run();
    });
  });
  $('copyMdBtn').addEventListener('click', function () {
    if (!lastResult) return;
    copyText(CodeChecker.toMarkdown(lastCode, lastResult), '报告已复制,可直接粘贴到文档或笔记里。');
  });
  $('downloadBtn').addEventListener('click', function () {
    if (!lastResult) return;
    var blob = new Blob([CodeChecker.toMarkdown(lastCode, lastResult)], { type: 'text/markdown;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '代码验收报告.md';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    showToast('报告已下载。');
  });
  $('copyPromptBtn').addEventListener('click', function () {
    if (!lastResult) return;
    copyText(CodeChecker.aiPrompt(lastCode, lastResult), '提示词已复制,粘贴给任意 AI 模型可继续评审模型判断六项。');
  });

  updateMeta();
})();
