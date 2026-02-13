import fs from "node:fs";
import path from "node:path";
import git from "isomorphic-git";

const SKIP_DIRS = new Set([".git", ".opencode", "node_modules"]);

async function getAllFiles(
  dir: string,
  root: string = dir
): Promise<string[]> {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;

    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      const nested = await getAllFiles(full, root);
      files.push(...nested);
    } else {
      files.push(path.relative(root, full));
    }
  }

  return files;
}

export async function initRepo(dir: string): Promise<void> {
  await git.init({ fs, dir });

  const files = await getAllFiles(dir);
  for (const filepath of files) {
    await git.add({ fs, dir, filepath });
  }

  await git.commit({
    fs,
    dir,
    message: "Initial commit",
    author: { name: "Riffboard", email: "riffboard@local" },
  });
}

export async function autoCommit(
  dir: string,
  message: string
): Promise<string> {
  const protoDir = path.join(dir, "prototype");
  if (fs.existsSync(protoDir)) {
    const protoFiles = await getAllFiles(protoDir, dir);
    for (const filepath of protoFiles) {
      await git.add({ fs, dir, filepath });
    }
  }

  const specPath = path.join(dir, "spec.json");
  if (fs.existsSync(specPath)) {
    await git.add({ fs, dir, filepath: "spec.json" });
  }

  const sha = await git.commit({
    fs,
    dir,
    message,
    author: { name: "Riffboard", email: "riffboard@local" },
  });

  return sha;
}

export async function getLog(
  dir: string
): Promise<Array<{ sha: string; message: string; timestamp: number }>> {
  const commits = await git.log({ fs, dir, depth: 50 });

  return commits.map((entry) => ({
    sha: entry.oid,
    message: entry.commit.message,
    timestamp: entry.commit.author.timestamp,
  }));
}

export async function revertTo(dir: string, sha: string): Promise<string> {
  const { commit } = await git.readCommit({ fs, dir, oid: sha });

  const files = await git.listFiles({ fs, dir, ref: sha });
  for (const filepath of files) {
    const { blob } = await git.readBlob({ fs, dir, oid: sha, filepath });
    const fullPath = path.join(dir, filepath);
    await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.promises.writeFile(fullPath, Buffer.from(blob));
    await git.add({ fs, dir, filepath });
  }

  const currentFiles = await getAllFiles(dir);
  for (const filepath of currentFiles) {
    if (!files.includes(filepath)) {
      await fs.promises.unlink(path.join(dir, filepath));
      await git.remove({ fs, dir, filepath });
    }
  }

  const newSha = await git.commit({
    fs,
    dir,
    message: `Revert to: ${commit.message.trim()} (${sha.slice(0, 7)})`,
    author: { name: "Riffboard", email: "riffboard@local" },
  });

  return newSha;
}
