import Link from "next/link";
import { AssetImage } from "@/components/asset-image";

const HOW_STEPS = [
  {
    id: "01",
    title: "准备素材",
    description: "上传角色图，选择动画方向。",
    icon: "/assets/landing/how/step-upload.png",
    accentBg: "var(--primary-light)",
  },
  {
    id: "02",
    title: "选择动作",
    description: "挑选动作模板并生成像素序列。",
    icon: "/assets/landing/how/step-action.png",
    accentBg: "var(--secondary-light)",
  },
  {
    id: "03",
    title: "导出结果",
    description: "预览后下载精灵图与 GIF 成品。",
    icon: "/assets/landing/how/step-export.png",
    accentBg: "var(--mint-light)",
  },
];

const SHOWCASE_ITEMS = [
  { id: "custom", title: "自定义动作", tag: "生活化动作", image: "/assets/landing/cases/case-01.gif" },
  { id: "run", title: "奔跑循环", tag: "跑步节奏", image: "/assets/landing/cases/case-02.gif" },
  { id: "attack", title: "攻击动作", tag: "连击动作", image: "/assets/landing/cases/case-03.gif" },
  { id: "jump", title: "跳跃动作", tag: "弹跳过渡", image: "/assets/landing/cases/case-04.gif" },
  { id: "punch", title: "拳击动作", tag: "出拳节奏", image: "/assets/landing/cases/case-05.gif" },
  { id: "fall", title: "倒地动作", tag: "倒地反馈", image: "/assets/landing/cases/case-06.gif" },
];

const FEATURES = [
  {
    tag: "动作模板",
    title: "模板开箱即用",
    desc: "内置多动作，支持自定义。",
    icon: "/assets/icons/feature-flash.png",
    bg: "var(--primary-light)",
  },
  {
    tag: "小灵协作",
    title: "对话式打磨描述",
    desc: "和小灵聊想法优化提示词。",
    icon: "/assets/icons/feature-magic.png",
    bg: "var(--secondary-light)",
  },
  {
    tag: "结果交付",
    title: "编辑后双格式导出",
    desc: "删帧调速后导出精灵图与 GIF。",
    icon: "/assets/icons/transform-arrow.png",
    bg: "var(--mint-light)",
  },
];

export default function Home() {
  return (
    <section className="relative overflow-hidden fade-in-up">
      <div className="relative z-10 mx-auto max-w-6xl space-y-14 py-4 md:py-8">

        {/* ── Hero ── */}
        <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6 text-center md:text-left">

            {/* Badge */}
            <span className="pixel-badge">
              <AssetImage
                src="/assets/icons/feature-magic.png"
                alt="Workshop Badge Icon"
                className="h-3 w-3 pixelated"
                fallbackClassName="asset-fallback-sm"
              />
              <span className="pixel-badge-text">
                Pixel Gif Workshop
              </span>
            </span>

            {/* Title */}
            <h1 className="text-5xl font-black leading-tight tracking-tight md:text-7xl text-text-primary">
              <span className="text-primary-color">像素</span>
              <br className="hidden md:block" />
              魔法工坊
            </h1>

            {/* Subtitle */}
            <p className="mx-auto max-w-xl text-base leading-relaxed md:mx-0 md:text-lg text-text-muted">
              上传一张图，选择动作模板，快速得到可直接使用的像素动态表情包。
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-wrap justify-center gap-3 md:justify-start">
              <Link className="btn-hero btn-hero-pink" href="/create">
                立即开始
              </Link>
              <a className="btn-hero btn-hero-white" href="#showcase">
                查看案例
              </a>
            </div>
            <p className="text-sm text-text-muted">
              首次使用可先前往
              {" "}
              <Link href="/settings" className="text-primary-color underline underline-offset-2">
                配置入口
              </Link>
            </p>

            {/* Feature Tags */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1 md:justify-start">
              {["像素模板", "GIF 导出"].map((tag) => (
                <span key={tag} className="cyber-chip muted">{tag}</span>
              ))}
            </div>
          </div>

          {/* Hero Image */}
          <div className="relative mx-auto w-full max-w-[460px] hero-process-float">
            <div className="cute-panel p-3">
              <AssetImage
                src="/assets/landing/hero/workbench-main.png"
                alt="Workbench Main"
                className="h-64 w-full object-cover pixelated md:h-72"
                fallbackClassName="asset-fallback-lg"
              />
            </div>
            <div className="absolute -bottom-3 -right-3 hidden hero-float-card md:block">
              <div className="cute-panel p-2 shadow-pixel">
                <AssetImage
                  src="/assets/landing/hero/gif-preview.png"
                  alt="GIF"
                  className="h-16 w-16 object-cover pixelated"
                  fallbackClassName="asset-fallback-md"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── How It Works ── */}
        <div id="how" className="space-y-6">
          <div className="text-center">
            <p className="pixel-title text-sm md:text-base text-primary-color">
              使用流程
            </p>
            <p className="mt-3 text-base md:text-lg text-text-muted">
              三步完成你的像素动态制作
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {HOW_STEPS.map((step) => (
              <article key={step.id} className="cute-panel how-step-card">
                <div className="how-step-head">
                  <span className="how-step-pill">步骤 {step.id}</span>
                  <span className="how-step-icon" style={{ background: step.accentBg }}>
                    <AssetImage
                      src={step.icon}
                      alt={step.title}
                      className="h-7 w-7 pixelated"
                      fallbackClassName="asset-fallback-sm"
                    />
                  </span>
                </div>
                <p className="how-step-title text-text-primary">
                  {step.title}
                </p>
                <p className="how-step-desc text-text-muted">
                  {step.description}
                </p>
              </article>
            ))}
          </div>
        </div>

        {/* ── Showcase ── */}
        <div id="showcase" className="space-y-6">
          <div className="text-center">
            <p className="pixel-title text-sm md:text-base text-primary-color">
              案例展示
            </p>
            <p className="mt-3 text-base md:text-lg text-text-muted">
              看看不同动作下的生成效果
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SHOWCASE_ITEMS.map((item) => (
              <article key={item.id} className="cute-panel case-card p-3">
                <div className="showcase-card-media rounded-md p-3 border-dim-2">
                  <div className="mx-auto aspect-square w-full max-w-[360px]">
                    <AssetImage
                      src={item.image}
                      alt={item.title}
                      className="h-full w-full object-contain pixelated"
                      fallbackClassName="asset-fallback-lg"
                    />
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-base font-bold text-text-primary">
                    {item.title}
                  </p>
                  <span className="cyber-chip muted">{item.tag}</span>
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* ── Features ── */}
        <div className="space-y-8">
          <div className="text-center">
            <p className="pixel-title text-sm md:text-base text-primary-color">
              核心能力
            </p>
            <p className="mt-3 text-base md:text-lg text-text-muted">
              不是重复流程，而是让创作更顺手的三个能力模块
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {FEATURES.map((feat) => (
              <article
                key={feat.title}
                className="cute-panel feature-card"
                style={{ background: feat.bg }}
              >
                <div className="feature-card-head">
                  <span className="feature-pill">{feat.tag}</span>
                  <span className="feature-icon-shell">
                    <AssetImage
                      src={feat.icon}
                      alt={feat.tag}
                      className="h-6 w-6 pixelated"
                      fallbackClassName="asset-fallback-sm"
                    />
                  </span>
                </div>
                <p className="feature-title text-text-primary">
                  {feat.title}
                </p>
                <p className="feature-desc text-text-muted">
                  {feat.desc}
                </p>
              </article>
            ))}
          </div>

          {/* Bottom CTA */}
          <div className="text-center pt-2">
            <p className="mx-auto max-w-2xl text-base leading-relaxed md:text-lg text-text-muted">
              准备好开始制作你的像素表情包了吗，直接进入创作工作台吧！
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link className="btn-hero btn-hero-pink" href="/create">
                进入创作工作台
              </Link>
              <Link className="btn-hero btn-hero-white" href="/history">
                查看历史记录
              </Link>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
