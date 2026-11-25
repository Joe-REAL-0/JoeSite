import test from "node:test";
import assert from "node:assert/strict";
import { renderMarkdown, extractToc, summarize } from "../scripts/markdown.mjs";

test("表格：单元格与表头都渲染出来", () => {
  const html = renderMarkdown("| 名称 | 值 |\n| --- | --- |\n| A | 1 |\n| B | 2 |");
  assert.match(html, /<table>/);
  assert.match(html, /<th>名称<\/th>/);
  assert.match(html, /<td>A<\/td>/);
  assert.match(html, /<td>2<\/td>/);
});

test("围栏代码：保留缩进与语言类名，内容不再被当正文解析", () => {
  const html = renderMarkdown("```js\nconst a = 1;\n  const b = 2;\n```");
  assert.match(html, /<pre class="highlight"><code class="hljs language-js">/);
  // 高亮会插入 <span>，断言纯文本时要先去掉标签
  const text = html.replace(/<[^>]+>/g, "");
  assert.match(text, /const a = 1;/);
  assert.match(text, /\n  const b = 2;/);
});

test("围栏代码：没有语言或语言未知时，保留转义后的原文", () => {
  for (const lang of ["", "unknown-language"]) {
    const html = renderMarkdown(`\`\`\`${lang}\n<tag> & text\n\`\`\``);
    assert.match(html, /<pre class="highlight"><code class="hljs">&lt;tag&gt; &amp; text\n<\/code><\/pre>/);
  }
});

test("标题：生成锚点与可选目录条目", () => {
  const html = renderMarkdown("## 第一节\n\n正文\n\n### 细节\n\n更多");
  assert.match(html, /<h2 id="第一节"/);
  assert.match(html, /<h3 id="细节"/);

  const toc = extractToc(html);
  assert.deepEqual(toc.map((item) => ({ level: item.level, text: item.text })), [
    { level: "2", text: "第一节" },
    { level: "3", text: "细节" },
  ]);
  assert.equal(toc[0].id, "第一节");
});

test("公式：$ 与 $$ 内容原样保留，不被强调语法吃掉", () => {
  const html = renderMarkdown("行内 $a*b*c$ 与块级\n\n$$\nx_1 + y_2\n$$");
  assert.match(html, /<span class="math-inline">a\*b\*c<\/span>/);
  assert.match(html, /<div class="math-display">x_1 \+ y_2<\/div>/);
  assert.ok(!html.includes("<em>"), "公式里的星号不能变成强调");
});

test("站内图片：src 保留，属性不丢", () => {
  const html = renderMarkdown("![示意图](/images/x.png)");
  assert.match(html, /<img src="\/images\/x.png" alt="示意图"/);
});

test("安全：正文里的脚本不进产物，文字保留", () => {
  const html = renderMarkdown('<script>alert(1)</script>\n\n正常段落');
  assert.ok(!html.includes("<script"), "脚本标签必须被移除");
  assert.ok(!html.includes("alert(1)") || !html.includes("<script"), "不得以可执行形式输出");
  assert.match(html, /正常段落/);
});

test("安全：危险协议链接被丢弃", () => {
  const html = renderMarkdown("[点我](javascript:alert(1))");
  assert.ok(!/href="javascript:/i.test(html), "javascript: 协议必须被拒绝");
});

test("摘要：剥掉标记后取纯文本", () => {
  assert.equal(summarize("# 标题\n\n**粗体**与[链接](https://example.com)\n\n- 列表项"), "标题\n粗体与链接\n列表项");
  assert.equal(summarize("```\ncode\n```\n"), "");
});

test("空输入：不产生内容也不报错", () => {
  assert.equal(renderMarkdown(""), "");
  assert.equal(renderMarkdown(undefined), "");
  assert.deepEqual(extractToc(""), []);
});
