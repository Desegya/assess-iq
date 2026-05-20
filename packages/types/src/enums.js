"use strict";
// ─── User & Organization ──────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIModel = exports.AIAction = exports.IntegritySeverity = exports.IntegrityEventType = exports.DocumentType = exports.DocumentStatus = exports.AttemptStatus = exports.AssessmentStatus = exports.BloomLevel = exports.QuestionStatus = exports.QuestionDifficulty = exports.QuestionType = exports.SubscriptionPlan = exports.OrgType = exports.UserStatus = exports.UserRole = void 0;
var UserRole;
(function (UserRole) {
    UserRole["SUPER_ADMIN"] = "SUPER_ADMIN";
    UserRole["ORG_ADMIN"] = "ORG_ADMIN";
    UserRole["TEACHER"] = "TEACHER";
    UserRole["STUDENT"] = "STUDENT";
})(UserRole || (exports.UserRole = UserRole = {}));
var UserStatus;
(function (UserStatus) {
    UserStatus["ACTIVE"] = "ACTIVE";
    UserStatus["INACTIVE"] = "INACTIVE";
    UserStatus["SUSPENDED"] = "SUSPENDED";
    UserStatus["PENDING"] = "PENDING";
})(UserStatus || (exports.UserStatus = UserStatus = {}));
var OrgType;
(function (OrgType) {
    OrgType["PRIMARY_SCHOOL"] = "PRIMARY_SCHOOL";
    OrgType["SECONDARY_SCHOOL"] = "SECONDARY_SCHOOL";
    OrgType["UNIVERSITY"] = "UNIVERSITY";
    OrgType["TUTORIAL_CENTER"] = "TUTORIAL_CENTER";
    OrgType["TRAINING_INSTITUTION"] = "TRAINING_INSTITUTION";
    OrgType["EXAM_BODY"] = "EXAM_BODY";
    OrgType["OTHER"] = "OTHER";
})(OrgType || (exports.OrgType = OrgType = {}));
var SubscriptionPlan;
(function (SubscriptionPlan) {
    SubscriptionPlan["FREE_TRIAL"] = "FREE_TRIAL";
    SubscriptionPlan["ACTIVE"] = "ACTIVE";
    SubscriptionPlan["EXPIRED"] = "EXPIRED";
    SubscriptionPlan["SUSPENDED"] = "SUSPENDED";
})(SubscriptionPlan || (exports.SubscriptionPlan = SubscriptionPlan = {}));
// ─── Questions & Assessments ──────────────────────────────────────────────────
var QuestionType;
(function (QuestionType) {
    QuestionType["MCQ"] = "MCQ";
    QuestionType["SHORT_ANSWER"] = "SHORT_ANSWER";
    QuestionType["THEORY"] = "THEORY";
    QuestionType["TRUE_FALSE"] = "TRUE_FALSE";
})(QuestionType || (exports.QuestionType = QuestionType = {}));
var QuestionDifficulty;
(function (QuestionDifficulty) {
    QuestionDifficulty["EASY"] = "EASY";
    QuestionDifficulty["MEDIUM"] = "MEDIUM";
    QuestionDifficulty["HARD"] = "HARD";
})(QuestionDifficulty || (exports.QuestionDifficulty = QuestionDifficulty = {}));
var QuestionStatus;
(function (QuestionStatus) {
    QuestionStatus["DRAFT"] = "DRAFT";
    QuestionStatus["PENDING_REVIEW"] = "PENDING_REVIEW";
    QuestionStatus["APPROVED"] = "APPROVED";
    QuestionStatus["REJECTED"] = "REJECTED";
    QuestionStatus["ARCHIVED"] = "ARCHIVED";
})(QuestionStatus || (exports.QuestionStatus = QuestionStatus = {}));
var BloomLevel;
(function (BloomLevel) {
    BloomLevel["REMEMBER"] = "REMEMBER";
    BloomLevel["UNDERSTAND"] = "UNDERSTAND";
    BloomLevel["APPLY"] = "APPLY";
    BloomLevel["ANALYZE"] = "ANALYZE";
    BloomLevel["EVALUATE"] = "EVALUATE";
    BloomLevel["CREATE"] = "CREATE";
})(BloomLevel || (exports.BloomLevel = BloomLevel = {}));
var AssessmentStatus;
(function (AssessmentStatus) {
    AssessmentStatus["DRAFT"] = "DRAFT";
    AssessmentStatus["PUBLISHED"] = "PUBLISHED";
    AssessmentStatus["ACTIVE"] = "ACTIVE";
    AssessmentStatus["CLOSED"] = "CLOSED";
    AssessmentStatus["ARCHIVED"] = "ARCHIVED";
})(AssessmentStatus || (exports.AssessmentStatus = AssessmentStatus = {}));
// ─── Attempts ─────────────────────────────────────────────────────────────────
var AttemptStatus;
(function (AttemptStatus) {
    AttemptStatus["IN_PROGRESS"] = "IN_PROGRESS";
    AttemptStatus["SUBMITTED"] = "SUBMITTED";
    AttemptStatus["AUTO_SUBMITTED"] = "AUTO_SUBMITTED";
    AttemptStatus["GRADED"] = "GRADED";
    AttemptStatus["ABANDONED"] = "ABANDONED";
})(AttemptStatus || (exports.AttemptStatus = AttemptStatus = {}));
// ─── Documents ────────────────────────────────────────────────────────────────
var DocumentStatus;
(function (DocumentStatus) {
    DocumentStatus["UPLOADING"] = "UPLOADING";
    DocumentStatus["PROCESSING"] = "PROCESSING";
    DocumentStatus["READY"] = "READY";
    DocumentStatus["FAILED"] = "FAILED";
})(DocumentStatus || (exports.DocumentStatus = DocumentStatus = {}));
var DocumentType;
(function (DocumentType) {
    DocumentType["PDF"] = "PDF";
    DocumentType["DOCX"] = "DOCX";
    DocumentType["TXT"] = "TXT";
})(DocumentType || (exports.DocumentType = DocumentType = {}));
// ─── Integrity ────────────────────────────────────────────────────────────────
var IntegrityEventType;
(function (IntegrityEventType) {
    IntegrityEventType["TAB_SWITCH"] = "TAB_SWITCH";
    IntegrityEventType["WINDOW_BLUR"] = "WINDOW_BLUR";
    IntegrityEventType["FULLSCREEN_EXIT"] = "FULLSCREEN_EXIT";
    IntegrityEventType["COPY_ATTEMPT"] = "COPY_ATTEMPT";
    IntegrityEventType["PASTE_ATTEMPT"] = "PASTE_ATTEMPT";
    IntegrityEventType["RIGHT_CLICK"] = "RIGHT_CLICK";
    IntegrityEventType["DEV_TOOLS_OPEN"] = "DEV_TOOLS_OPEN";
    IntegrityEventType["IDLE_WARNING"] = "IDLE_WARNING";
})(IntegrityEventType || (exports.IntegrityEventType = IntegrityEventType = {}));
var IntegritySeverity;
(function (IntegritySeverity) {
    IntegritySeverity["LOW"] = "LOW";
    IntegritySeverity["MEDIUM"] = "MEDIUM";
    IntegritySeverity["HIGH"] = "HIGH";
})(IntegritySeverity || (exports.IntegritySeverity = IntegritySeverity = {}));
// ─── AI ───────────────────────────────────────────────────────────────────────
var AIAction;
(function (AIAction) {
    AIAction["GENERATE_QUESTIONS"] = "GENERATE_QUESTIONS";
    AIAction["GENERATE_SUMMARY"] = "GENERATE_SUMMARY";
    AIAction["GENERATE_FLASHCARDS"] = "GENERATE_FLASHCARDS";
    AIAction["EXTRACT_TOPICS"] = "EXTRACT_TOPICS";
    AIAction["REVIEW_QUALITY"] = "REVIEW_QUALITY";
    AIAction["WEAK_TOPIC_SUGGESTION"] = "WEAK_TOPIC_SUGGESTION";
})(AIAction || (exports.AIAction = AIAction = {}));
var AIModel;
(function (AIModel) {
    AIModel["HAIKU"] = "claude-haiku-4-5-20251001";
    AIModel["SONNET"] = "claude-sonnet-4-6";
    AIModel["OPUS"] = "claude-opus-4-7";
})(AIModel || (exports.AIModel = AIModel = {}));
//# sourceMappingURL=enums.js.map