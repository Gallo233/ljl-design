import "../../../redesign.css";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ArrivalFade } from "../../../components/ArrivalFade";
import { ProjectJsonLd } from "../../../components/JsonLd";
import { SiteHUD } from "../../../components/SiteHUD";
import {
  WorkExperienceShell,
  type WorkExperienceProject,
} from "../../../components/work-experience/WorkExperienceShell";
import { getProject, projects } from "../../../components/projectData";
import { SHARE_CARD, canonicalPath } from "../../site";
import { fontVariables } from "../../fonts";

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
      type: "article",
      siteName: "Gallo",
      title: `${project.title} — Gallo`,
      ...(project.summary ? { description: project.summary } : {}),
      url,
      images: [SHARE_CARD],
    },
    twitter: {
      card: "summary_large_image",
      title: `${project.title} — Gallo`,
      ...(project.summary ? { description: project.summary } : {}),
      images: [SHARE_CARD.url],
    },
  };
}

function experienceProject(slug: "joi" | "joi-mobile"): WorkExperienceProject {
  if (slug === "joi") {
    return {
      slug,
      index: "01",
      title: "JOI — PRESENCE",
      tagline: "A machine learning how to live with you.",
      kind: "AI COMPANION / LIVE WEB",
      repo: "https://github.com/Gallo233/Joi",
      next: {
        href: "/work/joi-mobile",
        index: "02",
        title: "JOI MOBILE — WITH YOU",
      },
    };
  }
  return {
    slug,
    index: "02",
    title: "JOI MOBILE — WITH YOU",
    tagline: "The same relationship, carried with you.",
    kind: "NATIVE COMPANION / IPHONE",
    repo: "https://github.com/Gallo233/Joi-Mobile",
    poster: sitePath("/work/joi-mobile-home-screen.webp"),
    next: {
      href: "/play/night-tide",
      index: "03",
      title: "GAME CENTER — 游戏厅",
    },
    // Frame 01. `joi` above has no `previous`, being the first frame in the reel.
    previous: {
      href: "/work/joi",
      index: "01",
      title: "JOI",
    },
  };
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { slug } = await params;
  if (slug === "joi-map") redirect(sitePath("/work/joi-mobile/"));
  const project = getProject(slug);
  if (!project || (project.slug !== "joi" && project.slug !== "joi-mobile")) notFound();

  return (
    <div className={fontVariables}>
      <ProjectJsonLd project={project} />
      <ArrivalFade />
      <SiteHUD />
      <WorkExperienceShell project={experienceProject(project.slug)} />
    </div>
  );
}
