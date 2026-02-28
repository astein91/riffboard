import fs from "node:fs";
import path from "node:path";

export interface BranchMeta {
  name: string;
  displayName: string;
  createdAt: string;
  fromSha: string;
  fromBranch: string;
  description: string;
}

function branchesPath(projectDir: string): string {
  return path.join(projectDir, "branches.json");
}

export function readBranches(projectDir: string): BranchMeta[] {
  const p = branchesPath(projectDir);
  if (!fs.existsSync(p)) return [];
  const raw = fs.readFileSync(p, "utf-8");
  return JSON.parse(raw) as BranchMeta[];
}

export function addBranch(projectDir: string, meta: BranchMeta): void {
  const branches = readBranches(projectDir);
  branches.push(meta);
  fs.writeFileSync(branchesPath(projectDir), JSON.stringify(branches, null, 2));
}

export function removeBranch(projectDir: string, name: string): void {
  const branches = readBranches(projectDir).filter((b) => b.name !== name);
  fs.writeFileSync(branchesPath(projectDir), JSON.stringify(branches, null, 2));
}
