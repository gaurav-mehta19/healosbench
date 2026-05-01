import { Hono } from "hono";
import { readFile } from "fs/promises";
import { join, resolve } from "path";

const DATA_DIR = resolve(
  new URL(import.meta.url).pathname,
  "../../../../../../data",
);

const dataRouter = new Hono();

dataRouter.get("/transcripts/:id", async (c) => {
  const id = c.req.param("id");
  if (!/^case_\d+$/.test(id)) return c.text("Not found", 404);
  try {
    const text = await readFile(join(DATA_DIR, "transcripts", `${id}.txt`), "utf-8");
    return c.text(text);
  } catch {
    return c.text("Not found", 404);
  }
});

dataRouter.get("/gold/:id", async (c) => {
  const id = c.req.param("id");
  if (!/^case_\d+$/.test(id)) return c.json({ error: "Not found" }, 404);
  try {
    const text = await readFile(join(DATA_DIR, "gold", `${id}.json`), "utf-8");
    return c.json(JSON.parse(text));
  } catch {
    return c.json({ error: "Not found" }, 404);
  }
});

export { dataRouter };
