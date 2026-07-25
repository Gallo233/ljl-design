import "../../../redesign.css";
import "../../../styles.css";
import "../../../experience.css";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProject, projects } from "../../../components/projectData";
import { JoiMapNativeDemo, JoiNativeDemo } from "../../../components/NativeProjectDemos";
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
    <main className="project-page">
      <Live2DRouteMount />
      <header className="project-detail-nav">
        <a className="wordmark" href={sitePath("/")}>GALLO</a>
        <nav aria-label="Project navigation">
          <a href={sitePath("/selected-work")}>WORK</a>
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
              <div><dt>TYPE</dt><dd>{project.kind}</dd></div>
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

          <div className={`project-detail-live ${project.slug === "joi" ? "is-dark" : "is-light"}`}>
            {project.slug === "joi" ? <JoiNativeDemo /> : <JoiMapNativeDemo />}
          </div>
        </section>

        <div className="project-detail-body">
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
            {project.figures.map((figure) => (
              <figure key={figure.src}>
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
