/**
 * OCC M8.3 release gate. Evidence has to be supplied by a responsible human
 * from CI, an authorized live smoke test and real domain reviewer records.
 * This function does not enable a feature flag or access production data.
 */
export type OccReleaseEvidence = {
  branchCiGreen: boolean;
  postMergeCiGreen: boolean;
  independentDoubleReviewedCases: number;
  totalEvaluationCases: number;
  unresolvedFabricatedClaims: number;
  unresolvedMeaningChanges: number;
  unresolvedReviewerDisagreements: number;
  realProviderSmokePassed: boolean;
  entitlementAndFlagVerified: boolean;
  privacyAndRetentionApproved: boolean;
  operationalRollbackTested: boolean;
  ownerApprovedRollout: boolean;
};
export type OccReleaseDecision = { ready: boolean; blockers: string[] };
export function evaluateOccRelease(e: OccReleaseEvidence): OccReleaseDecision {
  const blockers: string[] = [];
  if (!e.branchCiGreen || !e.postMergeCiGreen) blockers.push("CI verification is incomplete");
  if (!Number.isInteger(e.totalEvaluationCases) || e.totalEvaluationCases <= 0 ||
      !Number.isInteger(e.independentDoubleReviewedCases) ||
      e.independentDoubleReviewedCases !== e.totalEvaluationCases) {
    blockers.push("Independent double review of all benchmark cases is incomplete");
  }
  if (!Number.isInteger(e.unresolvedFabricatedClaims) || e.unresolvedFabricatedClaims !== 0) blockers.push("Unresolved fabricated claims");
  if (!Number.isInteger(e.unresolvedMeaningChanges) || e.unresolvedMeaningChanges !== 0) blockers.push("Unresolved changes in meaning");
  if (!Number.isInteger(e.unresolvedReviewerDisagreements) || e.unresolvedReviewerDisagreements !== 0) blockers.push("Unresolved reviewer disagreements");
  if (!e.realProviderSmokePassed) blockers.push("Authorized real-provider smoke test is missing");
  if (!e.entitlementAndFlagVerified) blockers.push("Production entitlement and kill-switch controls are unverified");
  if (!e.privacyAndRetentionApproved) blockers.push("Privacy and data retention review is missing");
  if (!e.operationalRollbackTested) blockers.push("Operational rollback is untested");
  if (!e.ownerApprovedRollout) blockers.push("Rollout does not have owner approval");
  return { ready: blockers.length === 0, blockers };
}

/** Current state: all real-world release evidence remains an external task.
 * Synthetic CI success must not silently count as a human or live-provider review.
 */
export const OCC_RELEASE_DEFAULTS: OccReleaseEvidence = {
  branchCiGreen: false,
  postMergeCiGreen: false,
  independentDoubleReviewedCases: 0,
  totalEvaluationCases: 42,
  unresolvedFabricatedClaims: -1,
  unresolvedMeaningChanges: -1,
  unresolvedReviewerDisagreements: -1,
  realProviderSmokePassed: false,
  entitlementAndFlagVerified: false,
  privacyAndRetentionApproved: false,
  operationalRollbackTested: false,
  ownerApprovedRollout: false,
};
