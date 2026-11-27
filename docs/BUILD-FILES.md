# 生产构建文件清单

## 图床上传文件

将下列文件上传至 `https://img.furryjoe.site/avatars/`，保持文件名大小写。

| 友链 | 上传文件 | 尺寸 | 质量 | 字节 |
| --- | --- | ---: | ---: | ---: |
| 炎天 | `upload/avatars/amfysky.avif` | 256×256 | 80 | 16,764 |
| Lie_Kong、缎金SatinAu | `upload/avatars/default.avif` | 32×32 | 80 | 1,077 |
| 悦悦 | `upload/avatars/furryyueyue.webp` | 256×256 | 75 | 8,668 |
| 纳纳 | `upload/avatars/NaTyphoon.avif` | 200×200 | 80 | 14,384 |
| 城城 | `upload/avatars/chengcheng.webp` | 256×256 | 75 | 10,932 |
| kzmillion | `upload/avatars/kzmillion.webp` | 256×256 | 75 | 6,066 |
| Shadow | `upload/avatars/shadow.avif` | 256×256 | 80 | 12,084 |
| 皪澄_Tiking | `upload/avatars/Tiking-owo.webp` | 256×256 | 75 | 14,338 |

## 全部构建产物

`npm run build` 共生成 48 个文件，共 541,280 字节；图床文件单独上传，不在 `dist/` 内。

| 文件 | 字节 |
| --- | ---: |
| `dist/404.html` | 10,908 |
| `dist/_astro/_id_.astro_astro_type_script_index_0_lang.CbGI2gSM.js` | 3,472 |
| `dist/_astro/_id_.QxMDRGb4.css` | 12,166 |
| `dist/_astro/animation-blog.CsXnbHQ8.css` | 2,679 |
| `dist/_astro/arrow_up.B73DQMTh.svg` | 214 |
| `dist/_astro/back_home.DBy8R7E3.svg` | 688 |
| `dist/_astro/Base.astro_astro_type_script_index_0_lang.DpI2eRW-.js` | 5,516 |
| `dist/_astro/base.CY6Vdirq.css` | 15,179 |
| `dist/_astro/bilibili.CQLd7XoF.svg` | 2,029 |
| `dist/_astro/bkg-h.DckkR5bx_8bwhe.avif` | 90,063 |
| `dist/_astro/bkg-v.C1SdAgry_1qrVDY.avif` | 114,806 |
| `dist/_astro/blog.C9eFpA36.css` | 9,858 |
| `dist/_astro/client.CMK08csQ.js` | 1,005 |
| `dist/_astro/client.CsQjBJhQ.js` | 37,622 |
| `dist/_astro/dom-ready.Dtx5ZVyj.js` | 123 |
| `dist/_astro/favicon.BYe_2SDU.ico` | 4,286 |
| `dist/_astro/github.CQQYG1r5.svg` | 1,208 |
| `dist/_astro/GunShi.D2wZVHGJ.woff2` | 6,440 |
| `dist/_astro/index.astro_astro_type_script_index_0_lang.C-nIsNS1.js` | 682 |
| `dist/_astro/index.astro_astro_type_script_index_0_lang.CjEdUuda.js` | 906 |
| `dist/_astro/index.astro_astro_type_script_index_0_lang.DHKKvQJZ.js` | 805 |
| `dist/_astro/index.B0ZZ0dh_.css` | 3,111 |
| `dist/_astro/index.B_bejLKa.css` | 836 |
| `dist/_astro/index.Bp7Qr2qX.css` | 8,847 |
| `dist/_astro/index.fDZH9EVq.css` | 3,276 |
| `dist/_astro/itch-io.BQgJn6RJ.svg` | 1,615 |
| `dist/_astro/minecraft.BTIgHRo_.svg` | 1,118 |
| `dist/_astro/moon.p7J21kT9.svg` | 1,144 |
| `dist/_astro/QQ.DqjePYbQ.svg` | 795 |
| `dist/_astro/sun.CKFKwbCu.svg` | 2,699 |
| `dist/_astro/Technonomicon.CO_jJ7Oq.woff2` | 1,956 |
| `dist/_astro/theme.Cbv_Xvns.css` | 7,410 |
| `dist/_astro/ThemeToggle.izKy2Wyb.js` | 1,292 |
| `dist/_astro/valorax-lg25v.O_EkQjdk.woff2` | 5,968 |
| `dist/_astro/yuanti.BjYeo2Ms.woff2` | 9,272 |
| `dist/_astro/ZhengQingKeLengKu.KvvjcmMS.woff2` | 12,116 |
| `dist/blog/6/index.html` | 15,228 |
| `dist/blog/7/index.html` | 27,375 |
| `dist/blog/8/index.html` | 25,754 |
| `dist/blog/index.html` | 16,822 |
| `dist/cloud/index.html` | 11,211 |
| `dist/feed.xml` | 4,976 |
| `dist/friend_link/index.html` | 14,446 |
| `dist/index.html` | 14,621 |
| `dist/oc_introduce/index.html` | 22,276 |
| `dist/robots.txt` | 83 |
| `dist/rss.xml` | 4,975 |
| `dist/sitemap.xml` | 1,403 |

## 站内位图

两张背景图保留原始尺寸，构建时编码为 AVIF q80。

| 源文件 | 产物 |
| --- | --- |
| `src/assets/images/backgrounds/bkg-h.png` | `dist/_astro/bkg-h.DckkR5bx_8bwhe.avif` |
| `src/assets/images/backgrounds/bkg-v.png` | `dist/_astro/bkg-v.C1SdAgry_1qrVDY.avif` |

## 资源源文件

```text
src/assets/css/animations/animation-blog.css
src/assets/css/animations/animation-friend_link.css
src/assets/css/animations/animation-global.css
src/assets/css/animations/animation-index.css
src/assets/css/animations/animation-oc_introduce.css
src/assets/css/base.css
src/assets/css/font.css
src/assets/css/global.css
src/assets/css/html-style/blog.css
src/assets/css/html-style/blog_detail.css
src/assets/css/html-style/cloud_drive.css
src/assets/css/html-style/friend_link.css
src/assets/css/html-style/index.css
src/assets/css/html-style/interactions.css
src/assets/css/html-style/oc_introduce.css
src/assets/css/mobile-adaption.css
src/assets/css/theme.css
src/assets/fonts/GunShi.woff2
src/assets/fonts/Technonomicon.woff2
src/assets/fonts/valorax-lg25v.woff2
src/assets/fonts/yuanti.woff2
src/assets/fonts/ZhengQingKeLengKu.woff2
src/assets/images/avatars/amfysky.png
src/assets/images/avatars/default_avatar.png
src/assets/images/avatars/furryyueyue.jpg
src/assets/images/avatars/NaTyphoon.png
src/assets/images/avatars/chengcheng.jpg
src/assets/images/avatars/kzmillion.png
src/assets/images/avatars/shadow.png
src/assets/images/avatars/Tiking-owo.png
src/assets/images/backgrounds/bkg-h.png
src/assets/images/backgrounds/bkg-v.png
src/assets/images/button_image/arrow_up.svg
src/assets/images/button_image/back_home.svg
src/assets/images/button_image/moon.svg
src/assets/images/button_image/sun.svg
src/assets/images/favicon.ico
src/assets/images/link_image/bilibili.svg
src/assets/images/link_image/github.svg
src/assets/images/link_image/itch-io.svg
src/assets/images/link_image/minecraft.svg
src/assets/images/link_image/QQ.svg
src/assets/js/blog_detail.js
src/assets/js/blog_interactions.js
src/assets/js/dom-ready.js
src/assets/js/friend_link.js
src/assets/js/global.js
src/assets/js/index.js
src/assets/js/mobile-rail.js
src/assets/js/oc_introduce.js
src/assets/js/particles.js
```
