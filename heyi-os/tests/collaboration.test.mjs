import test from "node:test";
import assert from "node:assert/strict";
import { activeVotes, initialState, parties, profileStamp, replayEvents, topicStatus } from "../lib/collaboration.ts";

function event(id, kind, actorKey, payload) { return { id, kind, actorKey, payload: JSON.stringify(payload), createdAt: "2026-10-11 08:00:00" }; }
const proposal = event(1, "proposal", "coordinator", { topicId: "emergency", text: "限时审批并复审", reason: "" });
function votes(choices = ["accept", "accept", "accept"]) {
  return parties.map((actorKey, i) => event(i + 2, "vote", actorKey, { topicId: "emergency", proposalId: 1, profileStamp: profileStamp(initialState()), choice: choices[i], note: choices[i] === "accept" ? "" : "具体条件或异议" }));
}
const status = events => { const state = replayEvents(events); return topicStatus(state.topics[2], state).key; };
test("示例立场不自动计为成员确认", () => assert.equal(status([]), "open"));
test("提交提案不自动同意；沉默不表示同意", () => assert.equal(status([proposal, ...votes().slice(0, 2)]), "pending"));
test("三方明确接受才成为已确认方案", () => assert.equal(status([proposal, ...votes()]), "agreed"));
test("附条件接受不能成为有效共识", () => assert.equal(status([proposal, ...votes(["accept", "conditional", "accept"])]), "conditional"));
test("异议与需要信息分别可见", () => { assert.equal(status([proposal, ...votes(["accept", "object", "accept"])]), "conflict"); assert.equal(status([proposal, ...votes(["accept", "info", "accept"])]), "information"); });
test("修订方案重置确认并保留历史", () => { const state = replayEvents([proposal, ...votes(), event(5, "proposal", "hospital", { topicId: "emergency", text: "增加社区复审权", reason: "回应医院条件" })]); assert.equal(topicStatus(state.topics[2], state).key, "pending"); assert.equal(state.topics[2].proposal.version, 2); assert.equal(state.history.length, 5); });
test("共享立场更新使旧确认待复核", () => { const state = replayEvents([proposal, ...votes(), event(5, "profile", "hospital", { profile: { ...initialState().profiles.hospital, concern: "新增担忧" } })]); assert.equal(topicStatus(state.topics[2], state).key, "pending"); assert.equal(Object.keys(activeVotes(state.topics[2], state)).length, 0); assert.equal(state.topics[2].votes.hospital.choice, "accept"); });
test("旧方案的迟到反馈不计入新版", () => { const state = replayEvents([proposal, event(2, "proposal", "coordinator", { topicId: "emergency", text: "新版本", reason: "复审" }), event(3, "vote", "research", { topicId: "emergency", proposalId: 1, profileStamp: profileStamp(initialState()), choice: "accept", note: "" })]); assert.equal(Object.keys(activeVotes(state.topics[2], state)).length, 0); });
