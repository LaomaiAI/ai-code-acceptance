"""AI 代码验收报告 - 渲染与交互验证
用法: python3 verify/verify.py
用 Playwright 自带 Chromium 打开本地 index.html,做真实交互并截图。
断言失败即退出码 1。
"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "verify"
OUT.mkdir(exist_ok=True)

failures = []


def check(name, cond, extra=""):
    print(("PASS  " if cond else "FAIL  ") + name + ("" if cond else "  <- " + extra))
    if not cond:
        failures.append(name)


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        errors = []
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))

        page.goto((ROOT / "index.html").as_uri())
        page.wait_for_timeout(500)
        check("页面标题正确", "AI 代码验收报告" in page.title())
        check("输入框存在", page.locator("#codeInput").count() == 1)
        check("报告初始隐藏", page.locator("#reportPanel").is_hidden())
        page.screenshot(path=str(OUT / "01-initial.png"))

        # 空输入点验收:应提示,不出报告
        page.click("#runBtn")
        page.wait_for_timeout(300)
        check("空输入不出报告", page.locator("#reportPanel").is_hidden())
        check("空输入有提示", page.locator("#toast").is_visible())

        # 问题示例:自动跑出报告
        page.click('[data-sample="bad"]')
        page.wait_for_timeout(500)
        check("问题示例出报告", page.locator("#reportPanel").is_visible())
        score = page.locator("#scoreNum").inner_text()
        check("问题示例评分低于 60", score.isdigit() and int(score) < 60, "score=" + score)
        grade = page.locator("#gradeBadge").inner_text()
        check("问题示例等级为 D", "D" in grade, "grade=" + grade)
        counts = page.locator("#countsRow").inner_text()
        check("问题示例有不通过项", "不通过" in counts, counts)
        n_checks = page.locator("#checkList .check-item").count()
        check("确定性检查 19 项通用全部渲染", n_checks == 19, f"got {n_checks}")
        n_model = page.locator("#modelList .model-item").count()
        check("模型判断 6 项全部渲染", n_model == 6, f"got {n_model}")
        body = page.locator("body").inner_text()
        check("报告含硬编码密钥项", "硬编码密钥" in body)
        check("报告含括号配对不通过", "括号配对" in body)
        check("报告含模型未判定说明", "本页未判定" in body)
        check("密钥明文未出现在页面", "sk-abcdef" not in body)
        check("度量格 8 项", page.locator("#metricsGrid .metric").count() == 8)
        page.screenshot(path=str(OUT / "02-bad-sample.png"), full_page=True)

        # 导出下载:点下载,检查文件内容
        with page.expect_download() as dl_info:
            page.click("#downloadBtn")
        dl = dl_info.value
        tmp = OUT / "downloaded-report.md"
        dl.save_as(tmp)
        md = tmp.read_text(encoding="utf-8")
        check("下载的报告含确定性检查", "确定性检查" in md)
        check("下载的报告含模型判断", "模型判断" in md)
        check("下载的报告声明未调用模型", "未调用模型" in md)
        check("下载的报告含评分", "评分" in md)

        # JS 示例:评分应回升
        page.click('[data-sample="js"]')
        page.wait_for_timeout(500)
        score2 = page.locator("#scoreNum").inner_text()
        check("JS 示例评分高于问题示例", score2.isdigit() and int(score2) > int(score),
              f"js={score2} bad={score}")
        lang = page.locator("#langHint").inner_text()
        check("JS 示例识别语言", "JavaScript" in lang, lang)
        page.screenshot(path=str(OUT / "03-js-sample.png"), full_page=True)

        # Python 示例
        page.click('[data-sample="python"]')
        page.wait_for_timeout(500)
        lang3 = page.locator("#langHint").inner_text()
        check("Python 示例识别语言", "Python" in lang3, lang3)

        # JSON 示例
        page.click('[data-sample="json"]')
        page.wait_for_timeout(500)
        body4 = page.locator("body").inner_text()
        check("JSON 示例跑 JSON 检查", "JSON 格式合法" in body4)
        check("JSON 代码时检查为 20 项(含 JSON 专项)", page.locator("#checkList .check-item").count() == 20)

        # 移动端
        mob = browser.new_page(viewport={"width": 390, "height": 844})
        mob.goto((ROOT / "index.html").as_uri())
        mob.wait_for_timeout(400)
        mob.click('[data-sample="js"]')
        mob.wait_for_timeout(500)
        check("移动端报告可见", mob.locator("#reportPanel").is_visible())
        overflow = mob.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth")
        check("移动端无横向溢出", not overflow)
        mob.screenshot(path=str(OUT / "04-mobile.png"), full_page=True)

        check("无控制台错误", len(errors) == 0, "; ".join(errors[:3]))
        browser.close()

    print(f"\n{len(failures)} 个失败" if failures else "\n全部验证通过")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
