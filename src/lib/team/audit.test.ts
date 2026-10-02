import { describe, it, expect } from "vitest";
import { auditSentence } from "./audit";

describe("auditSentence", () => {
  it("describes team creation and rename", () => {
    expect(
      auditSentence({ action: "team.created", actorName: "Ada", targetName: null, detail: "Acme" }),
    ).toBe("Ada created the team “Acme”.");
    expect(
      auditSentence({ action: "team.renamed", actorName: "Ada", targetName: null, detail: "“A” → “B”" }),
    ).toBe("Ada renamed the team (“A” → “B”).");
  });

  it("describes invites and revokes", () => {
    expect(
      auditSentence({ action: "member.invited", actorName: "Ada", targetName: "bo@x.com", detail: null }),
    ).toBe("Ada invited bo@x.com.");
    expect(
      auditSentence({ action: "invite.revoked", actorName: "Ada", targetName: "bo@x.com", detail: null }),
    ).toBe("Ada revoked the invite for bo@x.com.");
  });

  it("describes joins, removals and leaves", () => {
    expect(auditSentence({ action: "member.joined", actorName: "Bo", targetName: null, detail: null })).toBe(
      "Bo joined the team.",
    );
    expect(
      auditSentence({ action: "member.removed", actorName: "Ada", targetName: "Bo", detail: null }),
    ).toBe("Ada removed Bo.");
    expect(auditSentence({ action: "member.left", actorName: "Bo", targetName: null, detail: null })).toBe(
      "Bo left the team.",
    );
  });

  it("describes role changes and ownership transfer", () => {
    expect(
      auditSentence({ action: "role.changed", actorName: "Ada", targetName: "Bo", detail: "member → admin" }),
    ).toBe("Ada changed Bo’s role (member → admin).");
    expect(
      auditSentence({ action: "ownership.transferred", actorName: "Ada", targetName: "Bo", detail: null }),
    ).toBe("Ada transferred ownership to Bo.");
  });

  it("falls back gracefully on unknown actions and missing names", () => {
    expect(auditSentence({ action: "whatever", actorName: "", targetName: null, detail: null })).toBe(
      "Someone performed an action.",
    );
    expect(
      auditSentence({ action: "member.removed", actorName: "Ada", targetName: null, detail: null }),
    ).toBe("Ada removed a member.");
  });
});
