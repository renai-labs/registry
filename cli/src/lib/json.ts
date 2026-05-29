import { readFile, writeFile } from "node:fs/promises"

export async function readJson<T>(path: string): Promise<T> {
  const raw = await readFile(path, "utf8")
  return JSON.parse(raw) as T
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  // Trailing newline keeps editors + git happy.
  const json = JSON.stringify(value, null, 2) + "\n"
  await writeFile(path, json, "utf8")
}

export async function readJsonOr<T>(path: string, fallback: T): Promise<T> {
  try {
    return await readJson<T>(path)
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return fallback
    throw e
  }
}
