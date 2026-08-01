import "../../../redesign.css";
import "../../../styles.css";
import "../../../experience.css";
import "./project-detail.css";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProject, projects } from "../../../components/projectData";
import { Live2DRouteMount } from "../../../components/Live2DRouteMount";

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
  return {
    title: project.title,
    description: project.summary,
  };
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();

  return (
    <main className={`project-page project-page--${project.slug}`}>
      {project.slug === "joi" && <Live2DRouteMount />}
      <header className="project-detail-nav">
        <a className="wordmark" href={sitePath("/")}>GALLO</a>
        <nav aria-label="Project navigation">
          <a href={sitePath("/selected-work")}>BACK TO REEL</a>
          <a href={sitePath("/about-me")}>ABOUT</a>
          <a href={project.repo} target="_blank" rel="noreferrer">GITHUB</a>
        </nav>
      </header>

      <article>
        <section className="project-detail-hero">
          <div className="project-detail-hero-top">
            <p className="project-detail-kicker">{project.index} / {project.kind}</p>
            <h1>{project.title}</h1>
            {project.tagline && <p className="project-detail-tagline">{project.tagline}</p>}
          </div>

          <div className="project-detail-summary">
            <div className="project-detail-summary-copy">
              <p>{project.summary}</p>
              <p lang="zh-CN">{project.summaryZh}</p>
            </div>
            <dl>
              <div><dt>PERIOD</dt><dd>{project.date}</dd></div>
              <div><dt>ROLE</dt><dd>{project.role}</dd></div>
              <div><dt>STATUS</dt><dd>{project.status}</dd></div>
              <div><dt>STACK</dt><dd>{project.stack}</dd></div>
            </dl>
          </div>

          <section className="project-case-frame" aria-label="Case study overview">
            <div>
              <span>01 / PROBLEM</span>
              <p>{project.question}</p>
            </div>
            <div>
              <span>02 / RESPONSIBILITY</span>
              <p>{project.role}</p>
            </div>
            <div>
              <span>03 / KEY DECISION</span>
              <p>{project.caseFrame.decision}</p>
            </div>
            <div>
              <span>04 / OUTCOME</span>
              <p>{project.caseFrame.outcome}</p>
            </div>
          </section>

          <figure className="project-detail-motion">
            <video
              autoPlay
              controls
              loop
              muted
              playsInline
              poster={sitePath(project.motion.poster)}
              preload="metadata"
              aria-describedby={`${project.slug}-motion-caption`}
            >
              <source src={sitePath(project.motion.src)} type="video/mp4" />
            </video>
            <figcaption id={`${project.slug}-motion-caption`}>
              <span>{project.motion.label}</span>
              <p>{project.motion.caption}</p>
            </figcaption>
          </figure>
        </section>

        <div className="project-detail-body">
          <section className="project-detail-loop" aria-labelledby={`${project.slug}-loop-title`}>
            <header>
              <p className="project-detail-kicker">THE PRODUCT LOOP</p>
              <div>
                <h2 id={`${project.slug}-loop-title`}>{project.loopTitle}</h2>
                <p lang="zh-CN">{project.loopTitleZh}</p>
              </div>
            </header>
            <ol>
              {project.loop.map((step) => (
                <li key={step.index}>
                  <span>{step.index}</span>
                  <strong>{step.label}</strong>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </li>
              ))}
            </ol>
          </section>

          {project.sections.map((section) => (
            <section className="project-detail-section" key={section.heading}>
              <div>
                <p className="project-detail-kicker">{section.heading}</p>
                <h2>{section.headingZh}</h2>
              </div>
              <div className="project-detail-section-copy">
                {section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                {section.bodyZh.map((paragraph) => <p lang="zh-CN" key={paragraph}>{paragraph}</p>)}
              </div>
            </section>
          ))}

          <section className="project-detail-gallery" aria-label={`${project.title} project figures`}>
            {project.figures.map((figure, index) => (
              <figure className={`project-detail-figure project-detail-figure--${index + 1}`} key={figure.src}>
                <img src={sitePath(figure.src)} alt={figure.alt} loading="lazy" />
                <figcaption>{figure.caption}</figcaption>
              </figure>
            ))}
          </section>

          <a className="project-next" href={sitePath(`/work/${project.nextSlug}`)}>
            <span>NEXT PROJECT</span>
            <strong>{project.nextTitle}</strong>
          </a>
        </div>
      </article>
    </main>
  );
}
