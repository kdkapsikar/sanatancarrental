// Browser entry: the offline engine over a published snapshot. Must not import server modules
// (database driver, Anthropic SDK, proposals).
export { OfflineAssistant } from "./offline";
export { SnapshotData, type AssistantSnapshot } from "./data";
export type { AssistantEvent, QuickReply, Locale } from "./types";
export type { ProposalView } from "./tools";
