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
        <div className="flex flex-col md:flex-row items-center justify-between gap-12 lg:gap-20 pt-8 pb-16">
          <div className="flex-1 space-y-8 text-center md:text-left relative z-10 w-full md:max-w-xl">

            {/* Badge */}
            <div className="inline-block hover:z-10 relative">
              <span className="pixel-badge border-4 shadow-[5px_5px_0_var(--shadow)] bg-yellow">
                <AssetImage
                  src="/assets/icons/feature-flash.png"
                  alt="Workshop Badge Icon"
                  className="h-5 w-5 pixelated"
                  fallbackClassName="asset-fallback-sm"
                />
                <span className="pixel-badge-text text-sm ml-1">
                  ARCADE EDITION
                </span>
              </span>
            </div>

            {/* Title - Asymmetric and Massive */}
            <h1 className="font-title font-black leading-[0.9] tracking-tighter uppercase relative z-20">
              <span className="block text-6xl md:text-[5.5rem] lg:text-[7rem] text-primary-color" style={{ textShadow: '6px 6px 0 var(--shadow), 12px 12px 0 var(--mint-light)', WebkitTextStroke: '3px var(--border-dim)' }}>
                像素
              </span>
              <span className="block text-5xl md:text-[4.5rem] lg:text-[6rem] text-text-primary mt-2 ml-0 md:ml-12" style={{ textShadow: '5px 5px 0 var(--secondary-light), 10px 10px 0 var(--border-dim)', WebkitTextStroke: '2px var(--border-dim)' }}>
                魔法工坊
              </span>
            </h1>

            {/* Subtitle */}
            <p className="mx-auto max-w-lg text-lg font-bold leading-relaxed md:mx-0 md:text-xl text-text-muted mt-8 p-4 bg-white border-3 border-border-dim rounded-md shadow-[4px_4px_0_var(--primary-light)] transform -rotate-1 relative lg:ml-8">
              上传一张图，选择动作模板，快速得到可直接使用的像素动态表情包。
              <span className="absolute -bottom-3 -right-3 h-6 w-6 bg-secondary border-2 border-border-dim rounded-full shadow-pixel-sm"></span>
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-wrap justify-center gap-5 md:justify-start pt-6 lg:ml-8">
              <Link className="btn-hero bg-primary text-white text-lg w-full sm:w-auto" href="/create">
                立即开始 START
              </Link>
              <a className="btn-hero bg-secondary text-text-primary text-lg w-full sm:w-auto" href="#showcase">
                查看案例 GALLERY
              </a>
            </div>
          </div>

          {/* Hero Image - Escaping container */}
          <div className="flex-1 w-full relative z-0 mt-10 md:mt-0 hero-process-float">
            {/* Background geometric accents */}
            <div className="absolute inset-0 -m-8 border-4 border-dashed border-primary-light rounded-[32px] transform rotate-3 -z-10"></div>

            <div className="cute-panel p-4 bg-secondary-light border-4 shadow-[12px_12px_0_var(--shadow)] transform -rotate-2">
              <AssetImage
                src="/assets/landing/hero/workbench-main.png"
                alt="Workbench Main"
                className="h-64 sm:h-80 w-full object-cover pixelated border-3 border-border-dim rounded-sm"
                fallbackClassName="asset-fallback-lg"
              />
            </div>

            {/* Floating smaller cards */}
            <div className="absolute -bottom-10 -right-4 md:-right-10 z-20 transition-transform duration-200 hover:-translate-y-4">
              <div className="cute-panel p-3 border-4 shadow-[8px_8px_0_var(--shadow)] bg-primary-light rotate-6">
                <AssetImage
                  src="/assets/landing/hero/gif-preview.png"
                  alt="GIF"
                  className="h-24 w-24 object-cover pixelated border-3 border-border-dim bg-white"
                  fallbackClassName="asset-fallback-md"
                />
              </div>
            </div>

            <div className="absolute -top-8 -left-6 z-20 hidden md:block transition-transform duration-200 hover:-translate-y-2">
              <div className="cyber-chip bg-yellow border-3 shadow-[4px_4px_0_var(--shadow)] -rotate-6 text-sm px-4 py-2 uppercase text-text-primary">
                Ready Player 1
              </div>
            </div>
          </div>
        </div>

        {/* ── Section Divider ── */}
        <div className="w-full h-8 mt-10 mb-20 px-4">
          <div className="w-full h-full" style={{
            backgroundImage: "repeating-linear-gradient(45deg, var(--shadow) 0, var(--shadow) 8px, transparent 8px, transparent 16px)",
            opacity: 0.3
          }}></div>
        </div>

        {/* ── How It Works ── */}
        <div id="how" className="space-y-10 relative">
          <div className="text-center bg-white border-4 border-border-dim shadow-[8px_8px_0_var(--primary)] max-w-xl mx-auto rounded-md py-6 transform rotate-1">
            <p className="pixel-title text-base md:text-lg text-primary-color tracking-[0.2em]">
              /// SELECT STAGE ///
            </p>
            <h2 className="mt-2 text-3xl font-black text-text-primary uppercase" style={{ WebkitTextStroke: '1px var(--shadow)' }}>
              三步完成制作
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3 pt-6 relative">
            <div className="hidden md:block absolute top-[40%] left-[15%] right-[15%] h-2 border-y-4 border-dashed border-primary-light z-0"></div>

            {HOW_STEPS.map((step, idx) => (
              <article key={step.id} className={`how-step-card border-4 border-border-dim rounded-md z-10 ${idx === 1 ? 'md:translate-y-8' : ''}`}>
                <div className="how-step-head mb-5">
                  <span className="how-step-pill border-3 border-border-dim shadow-[3px_3px_0_var(--shadow)] text-sm px-3 py-1">STAGE {step.id}</span>
                  <span className="how-step-icon border-3 border-border-dim shadow-[4px_4px_0_var(--shadow)] h-12 w-12" style={{ background: step.accentBg }}>
                    <AssetImage
                      src={step.icon}
                      alt={step.title}
                      className="h-7 w-7 pixelated"
                      fallbackClassName="asset-fallback-sm"
                    />
                  </span>
                </div>
                <p className="how-step-title text-text-primary text-2xl font-black bg-white inline-block px-2 rounded-sm border-2 border-border-dim -ml-2 mb-2">
                  {step.title}
                </p>
                <p className="how-step-desc text-text-muted text-base font-bold bg-[#f4fbff] px-2 py-1 rounded-sm border-l-4 border-primary mt-3">
                  {step.description}
                </p>
              </article>
            ))}
          </div>
        </div>

        {/* ── Section Divider ── */}
        <div className="w-full h-8 mt-24 mb-16 px-4">
          <div className="w-full border-t-8 border-b-8 border-border-dim h-full bg-secondary-light"></div>
        </div>

        {/* ── Showcase ── */}
        <div id="showcase" className="space-y-10">
          <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4 border-b-4 border-border-dim pb-4">
            <div>
              <p className="pixel-title text-base sm:text-lg text-secondary tracking-[0.2em]">
                /// CHARACTER SELECT ///
              </p>
              <h2 className="mt-2 text-4xl sm:text-5xl font-black text-text-primary uppercase" style={{ textShadow: '4px 4px 0 var(--secondary-light)', WebkitTextStroke: '2px var(--shadow)' }}>
                案例展示
              </h2>
            </div>
            <div className="cyber-chip bg-mint text-text-primary border-4 shadow-pixel font-black text-lg py-2">
              PLAYER ROSTER
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {SHOWCASE_ITEMS.map((item, idx) => {
              // Alternate background colors for a pop-art feel
              const bgs = ['bg-primary-light', 'bg-secondary-light', 'bg-mint-light'];
              const bgClass = bgs[idx % 3];

              return (
                <article key={item.id} className={`cute-panel case-card p-4 ${bgClass}`}>
                  <div className="showcase-card-media rounded-sm p-4 border-4 border-border-dim shadow-inner bg-white bg-[url('data:image/svg+xml,%3Csvg width=\'16\' height=\'16\' viewBox=\'0 0 16 16\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M8 0h8v8H8z\' fill=\'%231a0f2e\' fill-opacity=\'0.03\' fill-rule=\'evenodd\'/%3E%3C/svg%3E')]">
                    <div className="mx-auto aspect-square w-full max-w-[360px]">
                      <AssetImage
                        src={item.image}
                        alt={item.title}
                        className="h-full w-full object-contain pixelated drop-shadow-[5px_5px_0_rgba(26,15,46,0.25)] transition-transform duration-200 hover:scale-110"
                        fallbackClassName="asset-fallback-lg"
                      />
                    </div>
                  </div>
                  <div className="mt-5 flex items-center justify-between gap-2 px-1 bg-white border-3 border-border-dim rounded-sm p-2 shadow-[3px_3px_0_var(--shadow)]">
                    <p className="text-xl font-black text-text-primary uppercase tracking-wide">
                      {item.title}
                    </p>
                    <span className="cyber-chip border-2 bg-yellow text-text-primary text-xs px-2 py-1">{item.tag}</span>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        {/* ── Section Divider ── */}
        <div className="w-full flex justify-center mt-24 mb-16">
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="w-6 h-6 bg-primary border-3 border-border-dim shadow-[2px_2px_0_var(--shadow)] -skew-x-12"></div>
            ))}
          </div>
        </div>

        {/* ── Features ── */}
        <div className="space-y-10 relative">
          <div className="text-center absolute -top-8 left-1/2 -translate-x-1/2 z-10 w-full px-4">
            <span className="inline-block bg-text-primary text-white text-3xl font-black uppercase px-6 py-3 border-4 border-text-primary shadow-[6px_6px_0_var(--primary)] -rotate-2">
              POWER-UPS
            </span>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3 pt-12">
            {FEATURES.map((feat) => (
              <article
                key={feat.title}
                className="feature-card border-4 border-border-dim rounded-md"
                style={{ background: feat.bg }}
              >
                <div className="feature-card-head mb-5">
                  <span className="feature-pill border-3 border-border-dim shadow-[3px_3px_0_var(--shadow)] bg-white px-3 py-1 font-black">{feat.tag}</span>
                  <span className="feature-icon-shell border-3 border-border-dim shadow-[4px_4px_0_var(--shadow)] bg-white h-12 w-12 rounded-full">
                    <AssetImage
                      src={feat.icon}
                      alt={feat.tag}
                      className="h-6 w-6 pixelated"
                      fallbackClassName="asset-fallback-sm"
                    />
                  </span>
                </div>
                <div className="bg-white p-3 border-3 border-border-dim rounded-sm shadow-[4px_4px_0_var(--shadow)] flex-1 flex flex-col justify-center">
                  <p className="feature-title text-text-primary text-2xl font-black -mt-1">
                    {feat.title}
                  </p>
                  <p className="feature-desc text-text-muted text-base font-bold mt-2">
                    {feat.desc}
                  </p>
                </div>
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
