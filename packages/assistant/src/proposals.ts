import { and, eq, sql } from "drizzle-orm";
import { assistantProposals, consents, conversations, customers, type Db } from "@cab/db";
import { callbackPayload, normalisePhone } from "./tools";

/** Version of the call-back consent text shown under the chat input / in WhatsApp. */
export const CALLBACK_CONSENT_VERSION = "2026-10-callback-v1";

export type ConfirmResult =
  | { ok: true; result: "callback_requested"; conversationId: string }
  | { ok: false; code: "not_found" | "expired" | "invalid" | "already_handled" };

/**
 * Runs a proposed write, once, for its owner only. The payload stored when the assistant
 * proposed it is re-validated now. Confirming is the consent event: it records an append-only
 * consent row alongside the customer and the hand-off conversation, in one transaction.
 */
export async function confirmProposal(
  db: Db,
  id: string,
  opts: { ownerRef: string | null; now?: Date },
): Promise<ConfirmResult> {
  const now = opts.now ?? new Date();
  return db.transaction(async (tx) => {
    const [p] = await tx
      .select()
      .from(assistantProposals)
      .where(eq(assistantProposals.id, id))
      .for("update")
      .limit(1);
    // Someone else's proposal looks the same as a missing one.
    if (!p || (p.ownerRef ?? null) !== (opts.ownerRef ?? null)) return { ok: false, code: "not_found" } as const;
    if (p.status !== "pending") return { ok: false, code: "already_handled" } as const;
    if (p.expiresAt < now) {
      await tx.update(assistantProposals).set({ status: "cancelled", resolvedAt: now }).where(eq(assistantProposals.id, id));
      return { ok: false, code: "expired" } as const;
    }
    const parsed = callbackPayload.safeParse(p.payload);
    const phone = parsed.success && parsed.data.phone ? normalisePhone(parsed.data.phone) : null;
    if (!parsed.success || !phone) {
      await tx.update(assistantProposals).set({ status: "cancelled", resolvedAt: now }).where(eq(assistantProposals.id, id));
      return { ok: false, code: "invalid" } as const;
    }
    const data = parsed.data;
    const locale = data.preferred_language ?? "en";

    const [customer] = await tx
      .insert(customers)
      .values({ phone, fullName: data.name ?? null, preferredLocale: locale })
      .onConflictDoUpdate({
        target: customers.phone,
        set: { fullName: sql`coalesce(excluded.full_name, ${customers.fullName})`, preferredLocale: locale },
      })
      .returning({ id: customers.id });

    await tx.insert(consents).values({
      customerId: customer!.id,
      phone,
      purpose: "data_processing",
      granted: true,
      source: p.channel === "whatsapp" ? "whatsapp" : "web_chat",
      policyVersion: CALLBACK_CONSENT_VERSION,
      evidence: { proposalId: p.id, action: "confirmed_callback_card" },
    });

    const note = [
      data.trip_summary,
      data.preferred_time ? `Preferred time: ${data.preferred_time}` : null,
      `Language: ${locale}`,
    ]
      .filter(Boolean)
      .join(" · ");
    const thread = p.channel === "whatsapp" && p.ownerRef ? p.ownerRef : `callback-${p.id}`;
    const [conv] = await tx
      .insert(conversations)
      .values({
        channel: p.channel,
        externalThreadId: thread,
        customerId: customer!.id,
        locale,
        handedOffToHuman: true,
        handoffNote: note,
      })
      .onConflictDoUpdate({
        target: [conversations.channel, conversations.externalThreadId],
        set: { customerId: customer!.id, handedOffToHuman: true, handoffNote: note },
      })
      .returning({ id: conversations.id });

    await tx
      .update(assistantProposals)
      .set({ status: "confirmed", resolvedAt: now })
      .where(and(eq(assistantProposals.id, id), eq(assistantProposals.status, "pending")));
    return { ok: true, result: "callback_requested", conversationId: conv!.id } as const;
  });
}

export async function cancelProposal(db: Db, id: string, opts: { ownerRef: string | null; now?: Date }): Promise<boolean> {
  const rows = await db
    .update(assistantProposals)
    .set({ status: "cancelled", resolvedAt: opts.now ?? new Date() })
    .where(
      and(
        eq(assistantProposals.id, id),
        eq(assistantProposals.status, "pending"),
        opts.ownerRef === null ? sql`${assistantProposals.ownerRef} is null` : eq(assistantProposals.ownerRef, opts.ownerRef),
      ),
    )
    .returning({ id: assistantProposals.id });
  return rows.length > 0;
}
