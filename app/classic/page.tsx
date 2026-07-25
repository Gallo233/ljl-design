"use client";

import "../../redesign.css";
import "../../styles.css";
import "../../experience.css";

import Script from "next/script";
import { JoiMapNativeDemo, JoiNativeDemo } from "../../components/NativeProjectDemos";
import { Live2DGate } from "../../components/Live2DGate";
import { ParticlePrologue } from "../../components/ParticlePrologue";
import { ScrambleText } from "../../components/ScrambleText";
import { SiteAudio } from "../../components/SiteAudio";

const manifestoLines = [
  "AI becomes interesting",
  "when it stops being",
  "only a feature.",
];

function CharacterManifesto() {
  return (
    <div
      className="manifesto-copy character-manifesto"
      data-character-reveal
      aria-label={manifestoLines.join(" ")}
    >
      {manifestoLines.map((line) => (
        <span className="character-line" aria-hidden="true" key={line}>
          {line.split(" ").map((word, wordIndex) => (
            <span className="character-word" key={`${word}-${wordIndex}`}>
              {[...word].map((character, characterIndex) => (
                <span data-character key={`${character}-${characterIndex}`}>{character}</span>
              ))}
            </span>
          ))}
        </span>
      ))}
    </div>
  );
}

export default function Page() {
  return (
    <>
      <Live2DGate />
      <SiteAudio />
      <ParticlePrologue />
      <main className="site-home gallo-experience" id="siteHome" tabIndex={-1}>
        <canvas className="shader-canvas" id="shaderCanvas" aria-hidden="true" />
        <header className="gallo-hud" aria-label="Main navigation">
          <a className="gallo-wordmark magnetic" href="#top">GALLO</a>
          <nav>
            <a className="magnetic" href="#work">WORK</a>
            <a className="magnetic" href="#thoughts">THOUGHTS</a>
            <a className="magnetic" href="#about">ABOUT</a>
          </nav>
          <a className="replay-button magnetic" href="https://github.com/Gallo233" target="_blank" rel="noreferrer">GITHUB ↗</a>
        </header>

        <section className="gallo-hero" id="home" data-joi-narration="欢迎来到 Gallo 的世界。我们从这里开始。">
          <div className="gallo-hero-sticky">
            <p className="hero-index">AI PRODUCT · PRODUCT DESIGN / 2026</p>
            <h1 aria-label="I design how AI enters human life">
              <span>I DESIGN</span>
              <span>HOW AI ENTERS</span>
              <span>HUMAN LIFE.</span>
            </h1>
            <div className="hero-question">
              <span>TECHNOLOGY × PEOPLE</span>
              <p>Shall we see how far a personality can travel?</p>
            </div>
            <a className="hero-enter magnetic" href="#work">ENTER THE WORK <span>↓</span></a>
          </div>
        </section>

        <section className="manifesto" id="thoughts" data-joi-narration="一个人格不只是皮肤。它需要连续性、边界和被打断的能力。">
          <p className="section-tag">01 / THOUGHT</p>
          <CharacterManifesto />
          <div className="manifesto-note">
            <p>有思想深度，有好奇心，愿意拥抱新事物。</p>
            <p>My long-term subject is the changing boundary between technology and people.</p>
          </div>
        </section>

        <section className="work-intro" id="work">
          <p className="section-tag">02 / SELECTED WORK</p>
          <h2>Two products.<br />One continuous question.</h2>
          <p>What happens when a virtual personality becomes a presence—and then begins to reach the physical world?</p>
        </section>

        <section className="project-stack" aria-label="Joi projects from presence to reach">
          <article className="native-project native-project-dark" data-stack-card data-joi-card="joi" data-accent="0.18" data-joi-narration="这是 Joi。她先让自己的意图和行动变得可见。">
            <div className="native-project-sticky">
              <header className="project-header">
                <span>01</span><h3>JOI / PRESENCE</h3><p>WINDOWS-FIRST MULTIMODAL COMPANION</p>
              </header>
              <div className="project-live-stage">
                <JoiNativeDemo />
              </div>
              <footer className="project-footer">
                <p>A local companion that observes context, asks before acting, and keeps every action legible.</p>
                <div><a className="magnetic" href="https://github.com/Gallo233/Joi" target="_blank" rel="noreferrer">GITHUB ↗</a><a className="magnetic" href="/joi">CASE STUDY →</a></div>
              </footer>
            </div>
          </article>

          <article className="native-project native-project-light" data-stack-card data-joi-card="map" data-accent="0.82" data-joi-narration="这是 Joi Map。人格开始学习地点、视野与真实世界的节奏。">
            <div className="native-project-sticky">
              <header className="project-header">
                <span>02</span><h3>JOI MAP / REACH</h3><p>SWIFTUI · MAPKIT · VISION · VOICE</p>
              </header>
              <div className="project-live-stage">
                <JoiMapNativeDemo />
              </div>
              <footer className="project-footer">
                <p>A world-facing guide connecting place, vision, narration and memory into one continuous presence.</p>
                <div><a className="magnetic" href="https://github.com/Gallo233/joi-map-ios" target="_blank" rel="noreferrer">GITHUB ↗</a><a className="magnetic" href="/joi-map">CASE STUDY →</a></div>
              </footer>
            </div>
          </article>
        </section>

        <section className="about-section" id="about" data-joi-narration="最后是 Gallo。他在做的，是让陌生的技术变得可以共同生活。">
          <p className="section-tag">03 / GALLO</p>
          <h2>Curious about<br />what technology<br />changes in us.</h2>
          <div className="about-grid">
            <p>I am Gallo, an AI product builder and product designer in Guangzhou. I care about the distance between what a system says, what it intends, and what a person actually feels.</p>
            <div className="about-links">
              <a className="magnetic" href="/resume/gallo-liu-resume-cn.pdf" target="_blank">RESUME ↗</a>
              <a className="magnetic" href="https://github.com/Gallo233" target="_blank" rel="noreferrer">GITHUB ↗</a>
              <a className="magnetic" href="mailto:liujialuo233@gmail.com">EMAIL ↗</a>
            </div>
          </div>
        </section>

        <footer className="gallo-footer">
          <ScrambleText
            className="footer-scramble"
            lines={["LET'S MAKE TECHNOLOGY", "PEOPLE CAN LIVE WITH."]}
          />
          <a className="footer-door magnetic" href="#top">BACK TO TOP ↑</a>
          <span>GALLO · GUANGZHOU · GMT+8</span>
        </footer>
      </main>

      <Script src="/main-site.js" strategy="afterInteractive" />
      <Script src="/particle-prologue.js" strategy="afterInteractive" />
      <Script
        src="/live2d/joi-live2d.js"
        strategy="afterInteractive"
        onError={() => window.dispatchEvent(new CustomEvent("joi-live2d-error", {
          detail: { label: "The Live2D controller could not be loaded" },
        }))}
      />
    </>
  );
}
