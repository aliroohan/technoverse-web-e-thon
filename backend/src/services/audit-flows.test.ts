import assert from 'node:assert/strict'
import { afterEach, describe, it, mock } from 'node:test'
import { Answer, Attempt, Exam, ReportVerification } from '../models/index.js'
import { recordIncident, saveAnswer, saveScratchpad } from './attempt.service.js'
import { gradeWritten, issueCode } from './grading.service.js'
import { verifyReport } from './report.service.js'

const candidateUser = {
  id: 'cand-1',
  name: 'Hana',
  email: 'hana@holdfast.test',
  role: 'candidate' as const,
}

const examinerUser = {
  id: 'exam-owner',
  name: 'Omar',
  email: 'omar@holdfast.test',
  role: 'examiner' as const,
}

describe('attempt and grading safety guards', () => {
  afterEach(() => {
    mock.restoreAll()
  })

  it('rejects saveAnswer when attempt is already finalized', async () => {
    mock.method(Attempt, 'findById', async () => ({
      _id: 'att-1',
      id: 'att-1',
      candidateId: { toString: () => 'cand-1' },
      examId: { toString: () => 'exam-1' },
      status: 'submitted',
      deadlineAt: new Date(Date.now() + 60_000),
      questionSnapshots: [],
    }))

    await assert.rejects(
      () => saveAnswer(candidateUser, 'att-1', { questionId: 'q1', choiceIds: ['c1'] }),
      (err: Error & { status?: number }) => err.status === 409,
    )
  })

  it('rejects saveAnswer when expectedVersion is stale', async () => {
    mock.method(Attempt, 'findById', async () => ({
      _id: 'att-1',
      id: 'att-1',
      candidateId: { toString: () => 'cand-1' },
      examId: { toString: () => 'exam-1' },
      status: 'in_progress',
      deadlineAt: new Date(Date.now() + 60_000),
      questionSnapshots: [
        { questionId: 'q1', type: 'single', choices: [{ id: 'c1', text: 'A' }], correctChoiceIds: ['c1'], marks: 2 },
      ],
    }))
    mock.method(Answer, 'findOne', async () => ({ version: 3 }))

    await assert.rejects(
      () => saveAnswer(candidateUser, 'att-1', { questionId: 'q1', choiceIds: ['c1'], expectedVersion: 1 }),
      (err: Error & { status?: number }) => err.status === 409,
    )
  })

  it('rejects saveScratchpad when attempt is finalized', async () => {
    mock.method(Attempt, 'findById', async () => ({
      _id: 'att-1',
      id: 'att-1',
      candidateId: { toString: () => 'cand-1' },
      examId: { toString: () => 'exam-1' },
      status: 'graded',
      deadlineAt: new Date(Date.now() + 60_000),
    }))

    await assert.rejects(
      () => saveScratchpad(candidateUser, 'att-1', 'notes'),
      (err: Error & { status?: number }) => err.status === 409,
    )
  })

  it('blocks non-sitting staff from recording candidate incidents', async () => {
    mock.method(Attempt, 'findById', async () => ({
      _id: 'att-1',
      id: 'att-1',
      candidateId: { toString: () => 'cand-1' },
      examId: { toString: () => 'exam-1' },
      status: 'in_progress',
    }))
    mock.method(Exam, 'findById', async () => ({
      _id: 'exam-1',
      examinerId: { toString: () => 'exam-owner' },
    }))

    await assert.rejects(
      () => recordIncident(examinerUser, 'att-1', 'blur'),
      (err: Error & { status?: number }) => err.status === 403,
    )
  })

  it('rejects written marks exceeding question maximum', async () => {
    mock.method(Attempt, 'findById', async () => ({
      _id: 'att-1',
      id: 'att-1',
      examId: { toString: () => 'exam-1' },
      isSandbox: false,
      status: 'submitted',
      questionSnapshots: [{ questionId: 'wq1', type: 'written', marks: 5 }],
    }))
    mock.method(Exam, 'findById', async () => ({
      _id: 'exam-1',
      examinerId: { toString: () => 'exam-owner' },
    }))

    await assert.rejects(
      () => gradeWritten(examinerUser, 'att-1', 'wq1', 6, 'too high'),
      (err: Error & { status?: number }) => err.status === 400,
    )
  })

  it('issues verification code idempotently via upsert', async () => {
    mock.method(ReportVerification, 'findOneAndUpdate', async () => ({ code: 'abcd1234' }))
    const code = await issueCode('att-1')
    assert.equal(code, 'abcd1234')
  })

  it('throws 404 when verifying an unknown report code', async () => {
    mock.method(ReportVerification, 'findOne', async () => null)
    await assert.rejects(
      () => verifyReport('unknown99'),
      (err: Error & { status?: number }) => err.status === 404,
    )
  })
})
