import * as esbuild from "esbuild";

export interface ValidationError {
  file: string;
  line: number;
  column: number;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export async function validatePrototypeFiles(
  files: Record<string, string>,
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];

  for (const [filePath, content] of Object.entries(files)) {
    if (!/\.(jsx|js)$/i.test(filePath)) continue;

    try {
      await esbuild.transform(content, {
        loader: "jsx",
        logLevel: "silent",
      });
    } catch (err) {
      if (err && typeof err === "object" && "errors" in err) {
        const esbuildErr = err as { errors: Array<{ text: string; location?: { line: number; column: number } }> };
        for (const e of esbuildErr.errors) {
          errors.push({
            file: filePath,
            line: e.location?.line ?? 0,
            column: e.location?.column ?? 0,
            message: e.text,
          });
        }
      } else {
        errors.push({
          file: filePath,
          line: 0,
          column: 0,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function formatFixPrompt(validation: ValidationResult): string {
  const errorList = validation.errors
    .map((e) => `  ${e.file}:${e.line}:${e.column} — ${e.message}`)
    .join("\n");

  return `The prototype has syntax errors:\n${errorList}\n\nFix these errors. Make minimal changes — only fix what is broken.`;
}
