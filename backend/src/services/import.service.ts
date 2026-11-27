import { Enrollment, User } from '../models/index.js'
import { HttpError } from '../lib/http-error.js'
import type { SessionUser } from '../types/domain.js'
import { difficulties, questionTypes } from '../types/domain.js'
import { parseCsv, rowsToRecords } from '../utils/csv.js'
import { hashPassword } from './auth.service.js'
import { createQuestion, enrollCandidate } from './exam.service.js'

const DEMO_PASSWORD = 'Candidate123!'

type RowError = { row: number; message: string }

const isDifficulty = (value: string): value is (typeof difficulties)[number] =>
  difficulties.includes(value as (typeof difficulties)[number])

const isType = (value: string): value is (typeof questionTypes)[number] =>
  questionTypes.includes(value as (typeof questionTypes)[number])

export const importQuestions = async (user: SessionUser, format: 'csv' | 'json', content: string) => {
  const errors: RowError[] = []
  let created = 0
  const records = recordsFrom(format, content)

  for (const entry of records) {
    try {
      const parsed = normalizeQuestion(entry.value)
      await createQuestion(user, parsed)
      created += 1
    } catch (error) {
      errors.push({ row: entry.row, message: error instanceof Error ? error.message : 'Invalid row' })
    }
  }

  return { created, errors, policy: 'Valid rows are saved. Invalid rows are listed and skipped.' }
}

export const importCandidates = async (
  user: SessionUser,
  format: 'csv' | 'json',
  content: string,
  examId?: string,
) => {
  const errors: RowError[] = []
  let created = 0
  let enrolled = 0
  const records = recordsFrom(format, content)

  for (const entry of records) {
    try {
      const record = asRecord(entry.value)
      const name = String(record.name ?? '').trim()
      const email = String(record.email ?? '').trim().toLowerCase()
      if (!name || !email.includes('@')) throw new Error('Name and a valid email are required')
      let candidate = await User.findOne({ email })
      if (!candidate) {
        candidate = await User.create({
          name,
          email,
          passwordHash: await hashPassword(DEMO_PASSWORD),
          role: 'candidate',
          active: true,
        })
        created += 1
      } else if (candidate.role !== 'candidate') {
        throw new Error('That email belongs to a staff account')
      }
      if (examId) {
        const before = await Enrollment.findOne({ examId, candidateId: candidate._id })
        await enrollCandidate(user, examId, candidate.id)
        if (!before) enrolled += 1
      }
    } catch (error) {
      errors.push({ row: entry.row, message: error instanceof Error ? error.message : 'Invalid row' })
    }
  }

  return {
    created,
    enrolled,
    errors,
    passwordNote: `New candidates can sign in with ${DEMO_PASSWORD}`,
    policy: 'Valid rows are saved. Invalid rows are listed and skipped.',
  }
}

const recordsFrom = (format: 'csv' | 'json', content: string) => {
  if (format === 'csv') {
    return rowsToRecords(parseCsv(content)).map((row) => ({ row: row.row, value: row.record as unknown }))
  }
  try {
    const parsed = JSON.parse(content) as unknown
    if (!Array.isArray(parsed)) throw new Error('JSON import must be an array')
    return parsed.map((value, index) => ({ row: index + 1, value }))
  } catch (error) {
    if (error instanceof HttpError) throw error
    throw new HttpError(400, error instanceof Error ? error.message : 'That file is not valid JSON')
  }
}

const asRecord = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Each row must be an object')
  return value as Record<string, unknown>
}

const normalizeQuestion = (value: unknown) => {
  const record = asRecord(value)
  const type = String(record.type ?? '').trim()
  const difficulty = String(record.difficulty ?? '').trim()
  if (!isType(type)) throw new Error('Type must be single, multi, or written')
  if (!isDifficulty(difficulty)) throw new Error('Difficulty must be easy, medium, or hard')
  const stem = String(record.stem ?? '').trim()
  const category = String(record.category ?? '').trim()
  const marks = Number(record.marks)
  if (!stem || !category || !Number.isFinite(marks) || marks <= 0) {
    throw new Error('Stem, category, and positive marks are required')
  }

  let choices: { text: string }[] = []
  let correctIndexes: number[] = []
  if (type !== 'written') {
    if (typeof record.choices === 'string') {
      choices = record.choices.split('|').map((text) => ({ text: text.trim() })).filter((choice) => choice.text)
      const letters = String(record.correct ?? '')
        .split('|')
        .map((part) => part.trim().toUpperCase())
        .filter(Boolean)
      correctIndexes = letters.map((letter) => letter.charCodeAt(0) - 65)
    } else if (Array.isArray(record.choices)) {
      choices = record.choices.map((choice) => ({ text: String(choice) }))
      correctIndexes = Array.isArray(record.correct) ? record.correct.map((index) => Number(index)) : []
    }
  }

  return { stem, type, category, difficulty, marks, choices, correctIndexes }
}
