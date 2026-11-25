import { defineConfig } from "astro/config";
import svelte from "@astrojs/svelte";
import { viteStaticCopy } from "vite-plugin-static-copy";
import site from "./src/_data/site.json" with { type: "json" };

// Only these files from static/ are public, at their original root-relative URLs.
const publicFiles = [
  "css/font.css",
  "css/global.css",
  "css/theme.css",
  "css/mobile-adaption.css",
  "css/animations/animation-global.css",
  "css/animations/animation-index.css",
  "css/animations/animation-blog.css",
  "css/animations/animation-oc_introduce.css",
  "css/animations/animation-friend_link.css",
  "css/html-style/index.css",
  "css/html-style/blog.css",
  "css/html-style/blog_detail.css",
  "css/html-style/oc_introduce.css",
  "css/html-style/friend_link.css",
  "css/html-style/cloud_drive.css",

  "js/global.js",
  "js/mobile-rail.js",
  "js/particles.js",
  "js/index.js",
  "js/oc_introduce.js",
  "js/blog_detail.js",
  "js/friend_link.js",

  "font/GunShi.otf",
  "font/Technonomicon.ttf",
  "font/ZhengQingKeLengKu.ttf",
  "font/valorax-lg25v.ttf",
  "font/yuanti.ttf",

  "images/favicon.ico",
  "images/backgrounds/bkg-h.png",
  "images/backgrounds/bkg-v.png",
  "images/button_image/sun.svg",
  "images/button_image/moon.svg",
  "images/button_image/arrow_up.svg",
  "images/button_image/back_home.svg",
  "images/link_image/QQ.svg",
  "images/link_image/bilibili.svg",
  "images/link_image/github.svg",
  "images/link_image/itch-io.svg",
  "images/link_image/minecraft.svg",
  "images/avatars/default_avatar.png",
  "images/avatars/shadow.jpg",
];

export default defineConfig({
  site: site.url,
  output: "static",
  integrations: [svelte()],
  vite: {
    plugins: [viteStaticCopy({
      targets: [{ src: publicFiles.map((file) => `static/${file}`), dest: ".", rename: { stripBase: 1 } }],
    })],
  },
});
