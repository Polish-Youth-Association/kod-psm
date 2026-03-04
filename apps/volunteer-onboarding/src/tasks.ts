import { CloudTasksClient } from "@google-cloud/tasks";

const client = new CloudTasksClient();

export async function enqueueTask(opts: {
  path: string; // e.g. "/tasks/onboarding/create-user"
  payload: any;
  delaySeconds?: number;
}) {
  const project = process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.TASKS_LOCATION;
  const queue = process.env.TASKS_QUEUE;
  const baseUrl = process.env.CLOUD_RUN_BASE_URL;
  const invokerSa = process.env.TASK_INVOKER_SA;

  if (!project || !location || !queue || !baseUrl || !invokerSa) {
    throw new Error(
      "Missing env vars: GCP_PROJECT, TASKS_LOCATION, TASKS_QUEUE, CLOUD_RUN_BASE_URL, TASK_INVOKER_SA"
    );
  }

  const parent = client.queuePath(project, location, queue);
  const url = baseUrl.replace(/\/$/, "") + opts.path;

  const task: any = {
    httpRequest: {
      httpMethod: "POST",
      url,
      headers: { "Content-Type": "application/json" },
      body: Buffer.from(JSON.stringify(opts.payload)).toString("base64"),
      oidcToken: {
        serviceAccountEmail: invokerSa,
        audience: baseUrl, // helps Cloud Run validate token
      },
    },
  };

  if (opts.delaySeconds && opts.delaySeconds > 0) {
    task.scheduleTime = { seconds: Math.floor(Date.now() / 1000) + opts.delaySeconds };
  }

  const [created] = await client.createTask({ parent, task });
  return created.name;
}