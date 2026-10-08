import type { GenerationJob, Project, ProjectSummary } from "@/types";
import { api, json, StorageError } from "./api";

/**
 * The storage contract.
 *
 * Everything above this line in the application talks to `ProjectRepository`,
 * never to the storage API directly. Projects, artwork and jobs live in
 * SIGIL's server-side database, so they survive browser resets and are the
 * same on every machine.
 */
export interface ProjectRepository {
  list(includeArchived?: boolean): Promise<ProjectSummary[]>;
  get(id: string): Promise<Project | undefined>;
  create(project: Project): Promise<Project>;
  save(project: Project): Promise<Project>;
  duplicate(id: string): Promise<Project | undefined>;
  archive(id: string, archived: boolean): Promise<void>;
  remove(id: string): Promise<void>;

  listJobs(projectId: string): Promise<GenerationJob[]>;
  saveJob(job: GenerationJob): Promise<void>;
  removeJob(jobId: string): Promise<void>;
}

interface Stored {
  project: Project;
  revision: number;
}

class HttpProjectRepository implements ProjectRepository {
  /**
   * The revision each project was last read or written at, in this tab. A save
   * sends it back, and the server refuses the write if someone else saved in
   * between, rather than silently overwriting their work.
   */
  private revisions = new Map<string, number>();

  private remember(stored: Stored): Project {
    this.revisions.set(stored.project.id, stored.revision);
    return stored.project;
  }

  async list(includeArchived = false): Promise<ProjectSummary[]> {
    const { projects } = await api<{ projects: ProjectSummary[] }>(
      `/api/projects${includeArchived ? "?archived=1" : ""}`,
    );
    return projects;
  }

  async get(id: string): Promise<Project | undefined> {
    try {
      return this.remember(await api<Stored>(`/api/projects/${encodeURIComponent(id)}`));
    } catch (err) {
      if (err instanceof StorageError && err.status === 404) return undefined;
      throw err;
    }
  }

  async create(project: Project): Promise<Project> {
    return this.remember(
      await api<Stored>("/api/projects", { method: "POST", body: json({ project }) }),
    );
  }

  async save(project: Project): Promise<Project> {
    const stored = await api<Stored>(`/api/projects/${encodeURIComponent(project.id)}`, {
      method: "PUT",
      body: json({ project, revision: this.revisions.get(project.id) ?? null }),
    });
    return this.remember(stored);
  }

  async duplicate(id: string): Promise<Project | undefined> {
    try {
      return this.remember(
        await api<Stored>(`/api/projects/${encodeURIComponent(id)}/duplicate`, { method: "POST" }),
      );
    } catch (err) {
      if (err instanceof StorageError && err.status === 404) return undefined;
      throw err;
    }
  }

  async archive(id: string, archived: boolean): Promise<void> {
    await updateProject(id, (project) => ({
      ...project,
      status: archived ? "archived" : "active",
      archivedAt: archived ? new Date().toISOString() : undefined,
    }));
  }

  async remove(id: string): Promise<void> {
    await api(`/api/projects/${encodeURIComponent(id)}`, { method: "DELETE" });
    this.revisions.delete(id);
  }

  async listJobs(projectId: string): Promise<GenerationJob[]> {
    const { jobs } = await api<{ jobs: GenerationJob[] }>(
      `/api/projects/${encodeURIComponent(projectId)}/jobs`,
    );
    return jobs;
  }

  async saveJob(job: GenerationJob): Promise<void> {
    await api(`/api/jobs/${encodeURIComponent(job.id)}`, { method: "PUT", body: json({ job }) });
  }

  async removeJob(jobId: string): Promise<void> {
    await api(`/api/jobs/${encodeURIComponent(jobId)}`, { method: "DELETE" });
  }
}

export const projectRepository: ProjectRepository = new HttpProjectRepository();

/**
 * Apply a small change to the latest saved copy of a project. Used where a
 * page holds no long-lived copy of its own (the client presentation, the
 * dashboard), so a change made elsewhere is merged rather than refused.
 */
export async function updateProject(
  id: string,
  mutate: (project: Project) => Project,
): Promise<Project> {
  for (let attempt = 0; ; attempt++) {
    const latest = await projectRepository.get(id);
    if (!latest) throw new StorageError("This project no longer exists.", 404, "NOT_FOUND");
    try {
      return await projectRepository.save(mutate(latest));
    } catch (err) {
      if (!(err instanceof StorageError && err.status === 409) || attempt >= 2) throw err;
    }
  }
}
export { summariseProject } from "./projectData";
