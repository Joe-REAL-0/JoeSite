/**
 * 站点构建配置。
 *
 * 输入 src/，输出 dist/。dist/ 是唯一部署目录：只含 HTML、CSS、JS、媒体、XML、TXT，
 * 不含内容源（Markdown）、构建配置或任何备份。
 */
import path from "node:path";
import { loadFriends } from "./scripts/content.mjs";
import { formatChinaDate, formatRfc822 } from "./scripts/time.mjs";

const PASSTHROUGH = [
  "static/css/font.css",
  "static/css/global.css",
  "static/css/theme.css",
  "static/css/mobile-adaption.css",
  "static/css/animations/animation-global.css",
  "static/css/animations/animation-index.css",
  "static/css/animations/animation-blog.css",
  "static/css/animations/animation-oc_introduce.css",
  "static/css/animations/animation-friend_link.css",
  "static/css/html-style/index.css",
  "static/css/html-style/blog.css",
  "static/css/html-style/blog_detail.css",
  "static/css/html-style/oc_introduce.css",
  "static/css/html-style/friend_link.css",
  "static/css/html-style/cloud_drive.css",

  "static/js/theme-toggle.js",
  "static/js/global.js",
  "static/js/mobile-rail.js",
  "static/js/particles.js",
  "static/js/index.js",
  "static/js/oc_introduce.js",
  "static/js/blog_detail.js",
  "static/js/friend_link.js",

  "static/font/GunShi.otf",
  "static/font/Technonomicon.ttf",
  "static/font/ZhengQingKeLengKu.ttf",
  "static/font/valorax-lg25v.ttf",
  "static/font/yuanti.ttf",

  "static/images/favicon.ico",
  "static/images/backgrounds/bkg-h.png",
  "static/images/backgrounds/bkg-v.png",
  "static/images/button_image/sun.svg",
  "static/images/button_image/moon.svg",
  "static/images/button_image/arrow_up.svg",
  "static/images/button_image/back_home.svg",
  "static/images/link_image/QQ.svg",
  "static/images/link_image/bilibili.svg",
  "static/images/link_image/github.svg",
  "static/images/link_image/itch-io.svg",
  "static/images/link_image/minecraft.svg",
  "static/images/avatars/default_avatar.png",
  "static/images/avatars/shadow.jpg",
];

export default function (eleventyConfig) {
  // 资源按公开路径落到站点根：static/css/x.css -> /css/x.css
  for (const assetPath of PASSTHROUGH) {
    const publicPath = assetPath.replace(/^static\//, "");
    eleventyConfig.addPassthroughCopy({ [assetPath]: publicPath });
  }

  // 构建/预览时改内容立即生效。
  eleventyConfig.addWatchTarget("src/posts");
  eleventyConfig.addWatchTarget("src/oc");


  // 构建期时间：固定东八区，构建机器时区不影响产物。
  eleventyConfig.addGlobalData("buildTime", () => ({
    chinaDate: formatChinaDate(new Date()),
    rfc822: formatRfc822(new Date()),
  }));

  // 友链在构建开始即校验：网址非法、缺展示名直接让构建失败。
  loadFriends(path.join(import.meta.dirname, "src", "_data", "friends.json"));
  return {
    dir: {
      input: "src",
      output: "dist",
      includes: "_includes",
      data: "_data",
    },
    templateFormats: ["njk", "md", "html"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    pathPrefix: "/",
  };
}
