import { decodeUTF8 } from "tweetnacl-util";
import type { IMessageLifecycle } from "./types";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";

export function checkApproval(lifecycle: IMessageLifecycle) {
  const messageBytes = decodeUTF8(
    JSON.stringify(
      {
        message: lifecycle.message,
        createdAt: lifecycle.createdAt,
        messageId: lifecycle.messageId,
      },
      null,
      0
    )
  );

  const pubkey = new PublicKey(lifecycle.daemonPubkey);
  return nacl.sign.detached.verify(
    messageBytes,
    Uint8Array.from(Buffer.from(lifecycle.approval, "base64")),
    pubkey.toBytes()
  );
}
