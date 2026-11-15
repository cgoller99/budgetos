import { mkdir, readFile, rename, open, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  approveBusinessTask,
  claimDueBusinessTask,
  createBusinessTask,
  isBusinessScope,
  rejectBusinessTask,
} from "../lib/jarvis/autonomousQueue.ts";

const [command, ...args] = process.argv.slice(2);
const queuePath = resolve(process.env.JARVIS_BUSINESS_QUEUE_PATH ?? "data/jarvis-business-queue.json");
const lockPath = `${queuePath}.lock`;

async function load() {
  try {
    const tasks = JSON.parse(await readFile(queuePath, "utf8"));
    if (!Array.isArray(tasks)) throw new Error("Invalid business queue");
    return tasks;
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function locked(operation) {
  await mkdir(dirname(queuePath), { recursive: true });
  let handle;
  try {
    handle = await open(lockPath, "wx", 0o600);
  } catch (error) {
    if (error.code === "EEXIST") throw new Error("Business queue locked; retry later");
    throw error;
  }
  try {
    const tasks = await load();
    const result = await operation(tasks);
    const tempPath = `${queuePath}.${process.pid}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(tasks, null, 2)}\n`, { mode: 0o600 });
    await rename(tempPath, queuePath);
    return result;
  } finally {
    await handle.close();
    await unlink(lockPath);
  }
}

function usage() {
  throw new Error(
    "Usage: add <id> <business> <kind> <risk> <scheduledFor> <title> --objective <text> | approve <id> <actor> | reject <id> <actor> <reason> | claim [now] | list",
  );
}

if (command === "list") {
  console.log(JSON.stringify(await load(), null, 2));
} else if (command === "add") {
  const [id, business, kind, risk, scheduledFor, title, objectiveFlag, ...objectiveWords] = args;
  if (!id || !isBusinessScope(business) || !["observe", "draft", "external", "financial", "customer_data"].includes(risk)
    || !scheduledFor || !title || objectiveFlag !== "--objective" || !objectiveWords.length) usage();
  await locked((tasks) => {
    if (tasks.some((task) => task.id === id)) throw new Error("Task already exists");
    if (tasks.length >= 500) throw new Error("Business queue capacity reached");
    const task = createBusinessTask({
      id,
      business,
      title,
      objective: objectiveWords.join(" "),
      risk,
      scheduledFor,
      env: process.env,
    });
    if (kind && kind !== task.kind) throw new Error(`Task kind mismatch; deterministic kind is ${task.kind}`);
    tasks.push(task);
    console.log(JSON.stringify(task, null, 2));
  });
} else if (command === "approve" || command === "reject") {
  const [id, actor, ...rest] = args;
  await locked((tasks) => {
    const task = tasks.find((entry) => entry.id === id);
    if (!task) throw new Error("Task not found");
    if (command === "approve") approveBusinessTask(task, actor || "operator");
    else rejectBusinessTask(task, actor || "operator", rest.join(" ") || "Rejected by operator");
  });
  console.log(`Business task ${command}d; no external action performed.`);
} else if (command === "claim") {
  const [now] = args;
  const task = await locked((tasks) => claimDueBusinessTask(tasks, now));
  console.log(JSON.stringify(task, null, 2));
} else {
  usage();
}
