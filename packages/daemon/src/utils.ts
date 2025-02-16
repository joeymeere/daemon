import { decodeUTF8 } from "tweetnacl-util";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";

export function checkApproval(
    message: string,
    createdAt: string,
    messageId: string,
    daemonPubkey: string,
    approval: string,
    channelId?: string,
) {
  const messageBytes = decodeUTF8(
    JSON.stringify(
      {
        message: message,
        createdAt: createdAt,
        messageId: messageId,
        channelId: channelId ?? "",
      },
      null,
      0
    )
  );

  const pubkey = new PublicKey(daemonPubkey);
  return nacl.sign.detached.verify(
    messageBytes,
    Uint8Array.from(Buffer.from(approval, "base64")),
    pubkey.toBytes()
  );
}
