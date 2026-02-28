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
            <div className="inline-block hover:z-10 relative">
              <span className="pixel-badge">
                <AssetImage
                  src="/assets/icons/feature-flash.png"
                  alt="Workshop Badge Icon"
                  className="h-4 w-4 pixelated"
                  fallbackClassName="asset-fallback-sm"
                />
                <span className="pixel-badge-text">
                  Pixel Gif Workshop
                </span>
              </span>
            </div>

            {/* Title */}
            <h1 className="text-6xl font-black leading-[1.1] tracking-tighter md:text-[5.5rem] lg:text-8xl text-text-primary uppercase" style={{ textShadow: '4px 4px 0 var(--primary-light), 8px 8px 0 var(--border-dim)', WebkitTextStroke: '2px var(--border-dim)' }}>
              <span className="text-primary-color" style={{ textShadow: '4px 4px 0 #FFD6E8, 8px 8px 0 var(--border-dim)' }}>像素</span>
              <br className="hidden md:block" />
              魔法工坊
            </h1>

            {/* Subtitle */}
            <p className="mx-auto max-w-xl text-lg font-bold leading-relaxed md:mx-0 md:text-xl text-text-muted mt-8">
              上传一张图，选择动作模板，快速得到可直接使用的像素动态表情包。
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-wrap justify-center gap-4 md:justify-start pt-4">
              <Link className="btn-hero btn-hero-pink" href="/create">
                立即开始
              </Link>
              <a className="btn-hero btn-hero-white" href="#showcase">
                查看案例
              </a>
            </div>
            <p className="text-sm font-bold text-text-muted mt-4">
              首次使用可先前往
              {" "}
              <Link href="/settings" className="text-primary-color underline decoration-2 underline-offset-4 hover:bg-primary-light transition-colors px-1 rounded-sm">
                配置入口
              </Link>
            </p>

            {/* Feature Tags */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2 md:justify-start">
              {["像素模板", "GIF 导出"].map((tag) => (
                <span key={tag} className="cyber-chip">{tag}</span>
              ))}
            </div>
          </div>

          {/* Hero Image */}
          <div className="relative mx-auto w-full max-w-[460px] hero-process-float">
            <div className="cute-panel p-3 bg-yellow">
              <AssetImage
                src="/assets/landing/hero/workbench-main.png"
                alt="Workbench Main"
                className="h-64 w-full object-cover pixelated md:h-72 border-2 border-border-dim rounded-sm"
                fallbackClassName="asset-fallback-lg"
              />
            </div>
            <div className="absolute -bottom-6 -right-6 hidden hero-float-card md:block transition-transform hover:scale-110 hover:rotate-6">
              <div className="cute-panel p-2 shadow-pixel bg-mint-light rotate-[-6deg]">
                <AssetImage
                  src="/assets/landing/hero/gif-preview.png"
                  alt="GIF"
                  className="h-20 w-20 object-cover pixelated border-2 border-border-dim"
                  fallbackClassName="asset-fallback-md"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── How It Works ── */}
        <div id="how" className="space-y-6 mt-12">
          <div className="text-center">
            <p className="pixel-title text-sm md:text-base text-primary-color">
              使用流程
            </p>
            <p className="mt-3 text-lg font-bold md:text-xl text-text-muted">
              三步完成你的像素动态制作
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {HOW_STEPS.map((step) => (
              <article key={step.id} className="how-step-card border-border-dim rounded-md">
                <div className="how-step-head mb-4">
                  <span className="how-step-pill border-2 border-border-dim shadow-[2px_2px_0_var(--shadow)]">步骤 {step.id}</span>
                  <span className="how-step-icon border-2 border-border-dim shadow-[3px_3px_0_var(--shadow)]" style={{ background: step.accentBg }}>
                    <AssetImage
                      src={step.icon}
                      alt={step.title}
                      className="h-8 w-8 pixelated"
                      fallbackClassName="asset-fallback-sm"
                    />
                  </span>
                </div>
                <p className="how-step-title text-text-primary text-2xl font-black">
                  {step.title}
                </p>
                <p className="how-step-desc text-text-muted text-base font-bold mt-2">
                  {step.description}
                </p>
              </article>
            ))}
          </div>
        </div>

        {/* ── Showcase ── */}
        <div id="showcase" className="space-y-8 mt-16">
          <div className="text-center">
            <p className="pixel-title text-sm md:text-base text-primary-color">
              案例展示
            </p>
            <p className="mt-3 text-lg font-bold md:text-xl text-text-muted">
              看看不同动作下的生成效果
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {SHOWCASE_ITEMS.map((item) => (
              <article key={item.id} className="cute-panel case-card p-3 bg-white">
                <div className="showcase-card-media rounded-sm p-3 border-3 border-border-dim shadow-inner bg-[url('data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' viewBox=\'0 0 20 20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%231a0f2e\' fill-opacity=\'0.05\' fill-rule=\'evenodd\'%3E%3Ccircle cx=\'3\' cy=\'3\' r=\'3\'/%3E%3Ccircle cx=\'13\' cy=\'13\' r=\'3\'/%3E%3C/g%3E%3C/svg%3E')]">
                  <div className="mx-auto aspect-square w-full max-w-[360px]">
                    <AssetImage
                      src={item.image}
                      alt={item.title}
                      className="h-full w-full object-contain pixelated drop-shadow-[4px_4px_0_rgba(26,15,46,0.3)] transition-transform hover:scale-110"
                      fallbackClassName="asset-fallback-lg"
                    />
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 px-1">
                  <p className="text-lg font-black text-text-primary uppercase tracking-wide">
                    {item.title}
                  </p>
                  <span className="cyber-chip bg-yellow text-text-primary">{item.tag}</span>
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* ── Features ── */}
        <div className="space-y-8 mt-16">
          <div className="text-center">
            <p className="pixel-title text-sm md:text-base text-primary-color">
              核心能力
            </p>
            <p className="mt-3 text-lg font-bold md:text-xl text-text-muted">
              不是重复流程，而是让创作更顺手的三个能力模块
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {FEATURES.map((feat) => (
              <article
                key={feat.title}
                className="feature-card border-border-dim rounded-md"
                style={{ background: feat.bg }}
              >
                <div className="feature-card-head mb-4">
                  <span className="feature-pill border-2 border-border-dim shadow-[2px_2px_0_var(--shadow)] bg-white">{feat.tag}</span>
                  <span className="feature-icon-shell border-2 border-border-dim shadow-[3px_3px_0_var(--shadow)] bg-white">
                    <AssetImage
                      src={feat.icon}
                      alt={feat.tag}
                      className="h-8 w-8 pixelated"
                      fallbackClassName="asset-fallback-sm"
                    />
                  </span>
                </div>
                <p className="feature-title text-text-primary text-2xl font-black">
                  {feat.title}
                </p>
                <p className="feature-desc text-text-muted text-base font-bold mt-2">
                  {feat.desc}
                </p>
              </article>
            ))}
          </div>

          {/* Bottom CTA */}
          <div className="text-center pt-8 pb-12">
            <p className="mx-auto max-w-2xl text-lg font-bold leading-relaxed md:text-xl text-text-muted">
              准备好开始制作你的像素表情包了吗，直接进入创作工作台吧！
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
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
