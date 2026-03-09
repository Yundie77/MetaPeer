const { buildSeededRandom, shuffleArray, buildDerangement } = require('../utils/random');
const assignmentHelpers = require('./assignmentHelpers');
const { sendError } = require('./helpers/httpResponse');
const { safeNumber } = require('./helpers/parsing');
const { escapeHtml, isLikelyBinary } = require('./helpers/sanitization');
const {
  ensureAssignmentExists,
  ensureAssignmentRecord,
  isAssignmentStartedOrLocked
} = require('./helpers/assignmentStore');
const {
  ensureRosterAssignment,
  cloneRosterTeamsToAssignment,
  replaceAssignmentTeamsFromRoster,
  ensureUserTeam,
  getTeamMembers
} = require('./helpers/rosterTeams');
const {
  fetchSubmission,
  userBelongsToTeam,
  isReviewerOfSubmission,
  ensureSubmissionAccess,
  fetchRevisionContext,
  ensureRevisionPermission
} = require('./helpers/submissionAccess');
const {
  ensureDefaultRubricForAssignment,
  fetchAssignmentRubric,
  calculateRubricScore
} = require('./helpers/rubricService');
const { fetchAssignmentMap } = require('./helpers/assignmentMap');
const { getProfessorSubjects } = require('./helpers/professorSubjects');

module.exports = {
  sendError,
  safeNumber,
  escapeHtml,
  ensureAssignmentExists,
  ensureAssignmentRecord,
  isAssignmentStartedOrLocked,
  ensureRosterAssignment,
  cloneRosterTeamsToAssignment,
  replaceAssignmentTeamsFromRoster,
  ensureUserTeam,
  getTeamMembers,
  fetchSubmission,
  userBelongsToTeam,
  isReviewerOfSubmission,
  ensureSubmissionAccess,
  fetchRevisionContext,
  ensureRevisionPermission,
  isLikelyBinary,
  ensureDefaultRubricForAssignment,
  calculateRubricScore,
  shuffleArray,
  buildSeededRandom,
  buildDerangement,
  ...assignmentHelpers,
  fetchAssignmentRubric,
  fetchAssignmentMap,
  getProfessorSubjects
};
