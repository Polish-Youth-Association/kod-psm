export async function triggerSlackDocusignWorkflow(email: string, name: string) {
    const webhookUrl = process.env.SLACK_DOCUSIGN_WORKFLOW_WEBHOOK_URL?.trim();
    if (!webhookUrl) throw new Error("SLACK_DOCUSIGN_WORKFLOW_WEBHOOK_URL not set");
  
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
  
    try {
      const resp = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          EMAIL: email,
          NAME: name
        })
      });
  
      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(`Slack workflow webhook failed (${resp.status}): ${text}`);
      }
    } finally {
      clearTimeout(timeout);
    }
  }