import type { Operation, OperationMap, Reply, Request } from "./contracts";

export async function sendRequest<K extends Operation>(
  request: Request<K>,
): Promise<OperationMap[K]["output"]> {
  const reply: Reply<OperationMap[K]["output"]> | undefined =
    await chrome.runtime.sendMessage(request);

  if (!reply) throw new Error("The extension did not respond. Reload it and try again.");
  if (!reply.ok) throw new Error(reply.error);
  return reply.data;
}
