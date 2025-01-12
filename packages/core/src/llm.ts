import type { IMessageLifecycle } from "./types";

export async function generateEmbeddings(
  lifecycle: IMessageLifecycle
): Promise<IMessageLifecycle> {
  return lifecycle;
}

export async function generateText(
  lifecycle: IMessageLifecycle
): Promise<IMessageLifecycle> {
  return lifecycle;
}
