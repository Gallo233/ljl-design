import "../../../redesign.css";
import "../../../styles.css";
import "../../../experience.css";
import "./project-detail.css";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrivalFade } from "../../../components/ArrivalFade";
import { RevealRoot } from "../../../components/RevealRoot";
import { SiteHUD } from "../../../components/SiteHUD";
import { getProject, projects } from "../../../components/projectData";
import { JoiWebEmbed } from "../../../components/JoiWebEmbed";
import { JoiMobileIPhoneShowcase } from "../../../components/joi-mobile-iphone/JoiMobileIPhoneShowcase";
import { PageScrollState } from "../../../components/PageScrollState";
import { SHARE_CARD, canonicalPath } from "../../site";

/**
 * Project detail — the light editorial layout you land in after stepping out of
 * the CRT.
 *
 * Every content block below is conditional on its data. `components/projectData.ts`
 * currently carries identity only while the project writing is rebuilt, so this
 * page renders as the shell plus, on `/work/joi`, the live Joi session. As data
 * comes back, each block reappears on its own — no template change needed.
 */

type ProjectPageProps = {
  params: Promise<{ slug: string }>;
};

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const sitePath = (path: string) => `${basePath}${path}`;

export function generateStaticParams() {
  return projects.map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({ params }: ProjectPageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) return { title: "Gallo" };
  const url = canonicalPath(`/work/${project.slug}`);
  return {
    title: project.title,
    ...(project.summary ? { description: project.summary } : {}),
    alternates: { canonical: url },
    openGraph: {
      // A page's `openGraph` replaces the layout's rather than merging into it,
      // so the fields that should survive are repeated here.
      type: "article",
      siteName: "Gallo",
      title: project.title,
      ...(project.summary ? { description: project.summary } : {}),
      url,
      images: [SHARE_CARD],
    },
    twitter: {
      // Same replacement rule as `openGraph`: without this the card would still
      // carry the site-level title on every project page.
      card: "summary_large_image",
      title: project.title,
      ...(project.summary ? { description: project.summary } : {}),
      images: [SHARE_CARD.url],
    },
  };
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { slug } = await params;
  if (slug === "joi-map") redirect(sitePath("/work/joi-mobile"));
  const project = getProject(slug);
  if (!project) notFound();

  const hasWebExperience = project.slug === "joi";
  const hasMeta = Boolean(project.date || project.role || project.status || project.stack);
  const hasCaseFrame = Boolean(project.question || project.caseFrame);
  const hasLoop = Boolean(project.loop?.length);
  const hasSections = Boolean(project.sections?.length);
  const hasFigures = Boolean(project.figures?.length);
  const nextHref = project.nextHref ?? (project.nextSlug ? `/work/${project.nextSlug}` : null);
  const hasNext = Boolean(nextHref && project.nextTitle);

  // The metadata card counts what is actually on the page — haoqi's article-card habit.
  const characterCount = [
    project.summary,
    project.summaryZh,
    ...(project.sections?.flatMap((section) => [...section.body, ...section.bodyZh]) ?? []),
    ...(project.loop?.map((step) => step.body) ?? []),
  ]
    .filter(Boolean)
    .join("").length;
  const hasBody = hasLoop || hasSections || hasFigures || hasNext;

  return (
    <main className={`project-page project-page--${project.slug}`}>
      {project.slug === "joi" && <PageScrollState />}
      <ArrivalFade />
      <RevealRoot />
      <SiteHUD />
      <header className="project-detail-nav">
        {/* Internal links are client navigations — a full document load would reboot
            both of the lab's WebGL scenes and replay the loader on the way back. */}
        <Link className="wordmark" href="/">GALLO</Link>
        <nav aria-label="Project navigation">
          <Link href="/selected-work">BACK TO REEL</Link>
          <Link href="/about-me">ABOUT</Link>
          {project.repo && <a href={project.repo} target="_blank" rel="noreferrer">GITHUB</a>}
        </nav>
      </header>

      <article>
        <section className="project-detail-hero">
          <div className="project-detail-hero-top">
            <p className="project-detail-kicker">
              {project.index}{project.kind ? ` / ${project.kind}` : ""}
            </p>
            <h1>{project.title}</h1>
            {project.tagline && <p className="project-detail-tagline">{project.tagline}</p>}
          </div>

          {(project.summary || hasMeta) && (
            <div className="project-detail-summary">
              {project.summary && (
                <div className="project-detail-summary-copy">
                  <p>{project.summary}</p>
                  {project.summaryZh && <p lang="zh-CN">{project.summaryZh}</p>}
                </div>
              )}
              {hasMeta && (
                <dl>
                  {project.date && <div><dt>PERIOD</dt><dd>{project.date}</dd></div>}
                  {project.role && <div><dt>ROLE</dt><dd>{project.role}</dd></div>}
                  {project.status && <div><dt>STATUS</dt><dd>{project.status}</dd></div>}
                  {project.stack && <div><dt>STACK</dt><dd>{project.stack}</dd></div>}
                </dl>
              )}
            </div>
          )}

          {hasCaseFrame && (
            <section className="project-case-frame" aria-label="Case study overview" data-reveal>
              {project.question && (
                <div>
                  <span>01 / PROBLEM</span>
                  <p>{project.question}</p>
                </div>
              )}
              {project.role && (
                <div>
                  <span>02 / RESPONSIBILITY</span>
                  <p>{project.role}</p>
                </div>
              )}
              {project.caseFrame && (
                <>
                  <div>
                    <span>03 / KEY DECISION</span>
                    <p>{project.caseFrame.decision}</p>
                  </div>
                  <div>
                    <span>04 / OUTCOME</span>
                    <p>{project.caseFrame.outcome}</p>
                  </div>
                </>
              )}
            </section>
          )}

          {hasWebExperience ? (
            <JoiWebEmbed />
          ) : project.experience ? (
            <Link className="project-web-experience" href={project.experience.href}>
              <span>{project.experience.eyebrow}</span>
              <div>
                <h2>{project.experience.title}</h2>
                <p>{project.experience.body}</p>
                <p lang="zh-CN">{project.experience.bodyZh}</p>
              </div>
              <strong>{project.experience.action} <b aria-hidden="true">↗</b></strong>
            </Link>
          ) : null}

          {project.interactiveShowcase?.kind === "joi-mobile-native" && (
            <JoiMobileIPhoneShowcase
              poster={sitePath(project.interactiveShowcase.poster)}
              label={project.interactiveShowcase.label}
              caption={project.interactiveShowcase.caption}
            />
          )}

          {project.motion && (
            <figure className="project-detail-motion" data-reveal>
              <video
                autoPlay
                controls
                loop
                muted
                playsInline
                poster={sitePath(project.motion.poster)}
                preload="auto"
                aria-describedby={`${project.slug}-motion-caption`}
              >
                <source src={sitePath(project.motion.src)} type="video/mp4" />
              </video>
              <figcaption id={`${project.slug}-motion-caption`}>
                <span>{project.motion.label}</span>
                <p>{project.motion.caption}</p>
              </figcaption>
            </figure>
          )}
        </section>

        {hasBody && (
          <div className="project-detail-body">
            {hasLoop && (
              <section className="project-detail-loop" aria-labelledby={`${project.slug}-loop-title`} data-reveal>
                <header>
                  <p className="project-detail-kicker">THE PRODUCT LOOP</p>
                  <div>
                    <h2 id={`${project.slug}-loop-title`}>{project.loopTitle}</h2>
                    {project.loopTitleZh && <p lang="zh-CN">{project.loopTitleZh}</p>}
                  </div>
                </header>
                <ol>
                  {project.loop!.map((step) => (
                    <li key={step.index}>
                      <span>{step.index}</span>
                      <strong>{step.label}</strong>
                      <h3>{step.title}</h3>
                      <p>{step.body}</p>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {project.sections?.map((section) => (
              <section className="project-detail-section" key={section.heading} data-reveal>
                <div>
                  <p className="project-detail-kicker">{section.heading}</p>
                  <h2 lang="zh-CN">{section.headingZh}</h2>
                </div>
                <div className="project-detail-section-copy">
                  {section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                  {section.bodyZh.map((paragraph) => <p lang="zh-CN" key={paragraph}>{paragraph}</p>)}
                </div>
              </section>
            ))}

            {hasFigures && (
              <section className="project-detail-gallery" aria-label={`${project.title} project figures`} data-reveal>
                {project.figures!.map((figure, index) => (
                  <figure className={`project-detail-figure project-detail-figure--${index + 1}`} key={figure.src}>
                    <img src={sitePath(figure.src)} alt={figure.alt} loading="lazy" />
                    <figcaption>{figure.caption}</figcaption>
                  </figure>
                ))}
              </section>
            )}

            <aside className="project-meta-card" data-reveal>
              <span className="project-meta-card-label">FILE</span>
              <dl>
                <div><dt>LAST UPDATED</dt><dd>{project.updated ?? "—"}</dd></div>
                <div><dt>CHARACTERS</dt><dd>{characterCount.toLocaleString("en-US")}</dd></div>
                <div><dt>INDEX</dt><dd>{project.index} / {String(projects.length).padStart(2, "0")}</dd></div>
                {project.repo && (
                  <div><dt>SOURCE</dt><dd><a href={project.repo} target="_blank" rel="noreferrer">GITHUB ↗</a></dd></div>
                )}
              </dl>
            </aside>

            {hasNext && (
              <Link className="project-next" href={nextHref!}>
                <span>NEXT PROJECT</span>
                <strong>{project.nextTitle}</strong>
              </Link>
            )}
          </div>
        )}
      </article>
    </main>
  );
}
