import mongoose, { Schema, type InferSchemaType, type Types } from 'mongoose'

const choiceSchema = new Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
  },
  { _id: false },
)

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, required: true, enum: ['admin', 'examiner', 'candidate'] },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
)

const questionSchema = new Schema(
  {
    stem: { type: String, required: true, trim: true },
    type: { type: String, required: true, enum: ['single', 'multi', 'written'] },
    choices: { type: [choiceSchema], default: [] },
    correctChoiceIds: { type: [String], default: [] },
    marks: { type: Number, required: true, min: 0 },
    category: { type: String, required: true, trim: true },
    difficulty: { type: String, required: true, enum: ['easy', 'medium', 'hard'] },
    weight: { type: Number, required: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
)

const settingsSchema = new Schema(
  {
    randomizeQuestions: { type: Boolean, default: true },
    randomizeChoices: { type: Boolean, default: true },
    fairPaper: { type: Boolean, default: false },
    questionCount: { type: Number, default: null },
    difficultyBudget: { type: Number, default: null },
    tolerance: { type: Number, default: 1 },
  },
  { _id: false },
)

const examSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    instructions: { type: String, required: true },
    windowStart: { type: Date, required: true },
    windowEnd: { type: Date, required: true },
    durationMinutes: { type: Number, required: true, min: 1 },
    totalMarks: { type: Number, required: true, min: 0 },
    examinerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    publication: { type: String, required: true, enum: ['draft', 'published'], default: 'draft' },
    resultsPublished: { type: Boolean, default: false },
    settings: { type: settingsSchema, required: true },
  },
  { timestamps: true },
)

const examQuestionSchema = new Schema(
  {
    examId: { type: Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
    questionId: { type: Schema.Types.ObjectId, ref: 'Question', required: true },
    marks: { type: Number, required: true, min: 0 },
    pinned: { type: Boolean, default: false },
    order: { type: Number, required: true },
  },
  { timestamps: true },
)
examQuestionSchema.index({ examId: 1, questionId: 1 }, { unique: true })

const enrollmentSchema = new Schema(
  {
    examId: { type: Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
    candidateId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true },
)
enrollmentSchema.index({ examId: 1, candidateId: 1 }, { unique: true })

const snapshotSchema = new Schema(
  {
    questionId: { type: String, required: true },
    order: { type: Number, required: true },
    stem: { type: String, required: true },
    type: { type: String, required: true, enum: ['single', 'multi', 'written'] },
    choices: { type: [choiceSchema], default: [] },
    correctChoiceIds: { type: [String], default: [] },
    marks: { type: Number, required: true },
    category: { type: String, required: true },
    difficulty: { type: String, required: true, enum: ['easy', 'medium', 'hard'] },
    weight: { type: Number, required: true },
  },
  { _id: false },
)

const attemptSchema = new Schema(
  {
    examId: { type: Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
    candidateId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    isSandbox: { type: Boolean, default: false, index: true },
    startedAt: { type: Date, required: true },
    deadlineAt: { type: Date, required: true },
    submittedAt: { type: Date, default: null },
    status: {
      type: String,
      required: true,
      enum: ['in_progress', 'submitted', 'expired', 'graded'],
      default: 'in_progress',
    },
    gradingStatus: {
      type: String,
      enum: ['pending_subjective', 'ready'],
      default: null,
    },
    questionSnapshots: { type: [snapshotSchema], required: true },
    objectiveScore: { type: Number, default: 0 },
    writtenScore: { type: Number, default: 0 },
    totalScore: { type: Number, default: 0 },
    teacherComment: { type: String, default: '' },
  },
  { timestamps: true },
)
attemptSchema.index(
  { examId: 1, candidateId: 1 },
  { unique: true, partialFilterExpression: { isSandbox: false } },
)

const answerSchema = new Schema(
  {
    attemptId: { type: Schema.Types.ObjectId, ref: 'Attempt', required: true, index: true },
    questionId: { type: String, required: true },
    choiceIds: { type: [String], default: [] },
    text: { type: String, default: '' },
    flaggedForReview: { type: Boolean, default: false },
    savedAt: { type: Date, required: true },
    version: { type: Number, required: true },
  },
  { timestamps: true },
)
answerSchema.index({ attemptId: 1, questionId: 1 }, { unique: true })

const incidentSchema = new Schema(
  {
    attemptId: { type: Schema.Types.ObjectId, ref: 'Attempt', required: true, index: true },
    examId: { type: Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
    type: {
      type: String,
      required: true,
      enum: ['disconnect', 'reconnect', 'blur', 'focus', 'autosave_failed'],
    },
    at: { type: Date, required: true },
    note: { type: String, default: '' },
    conclusive: { type: Boolean, default: false },
  },
  { timestamps: false },
)

const announcementSchema = new Schema(
  {
    examId: { type: Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
    body: { type: String, required: true, trim: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: () => new Date() },
  },
  { timestamps: false },
)

const gradeSchema = new Schema(
  {
    attemptId: { type: Schema.Types.ObjectId, ref: 'Attempt', required: true, index: true },
    questionId: { type: String, required: true },
    awardedMarks: { type: Number, required: true, min: 0 },
    comment: { type: String, default: '' },
    graderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
)
gradeSchema.index({ attemptId: 1, questionId: 1 }, { unique: true })

const preferenceSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    fontScale: { type: String, enum: ['sm', 'md', 'lg'], default: 'md' },
    contrast: { type: String, enum: ['default', 'high'], default: 'default' },
    navigator: { type: String, enum: ['side', 'bottom'], default: 'side' },
  },
  { timestamps: true },
)

const scratchpadSchema = new Schema(
  {
    attemptId: { type: Schema.Types.ObjectId, ref: 'Attempt', required: true, unique: true },
    text: { type: String, default: '' },
    updatedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: false },
)

const verificationSchema = new Schema(
  {
    attemptId: { type: Schema.Types.ObjectId, ref: 'Attempt', required: true, unique: true },
    code: { type: String, required: true },
    codeHash: { type: String, required: true, unique: true },
    issuedAt: { type: Date, required: true },
    revoked: { type: Boolean, default: false },
  },
  { timestamps: false },
)

export const User = mongoose.model('User', userSchema)
export const Question = mongoose.model('Question', questionSchema)
export const Exam = mongoose.model('Exam', examSchema)
export const ExamQuestion = mongoose.model('ExamQuestion', examQuestionSchema)
export const Enrollment = mongoose.model('Enrollment', enrollmentSchema)
export const Attempt = mongoose.model('Attempt', attemptSchema)
export const Answer = mongoose.model('Answer', answerSchema)
export const Incident = mongoose.model('Incident', incidentSchema)
export const Announcement = mongoose.model('Announcement', announcementSchema)
export const Grade = mongoose.model('Grade', gradeSchema)
export const WorkspacePreference = mongoose.model('WorkspacePreference', preferenceSchema)
export const Scratchpad = mongoose.model('Scratchpad', scratchpadSchema)
export const ReportVerification = mongoose.model('ReportVerification', verificationSchema)

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: Types.ObjectId }
export type QuestionDoc = InferSchemaType<typeof questionSchema> & { _id: Types.ObjectId }
export type ExamDoc = InferSchemaType<typeof examSchema> & { _id: Types.ObjectId }
export type AttemptDoc = InferSchemaType<typeof attemptSchema> & { _id: Types.ObjectId }
