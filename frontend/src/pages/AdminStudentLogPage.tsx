import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Banner, Button, Pagination, Select, TextInput } from '../components/ui'
import { apiRequest } from '../lib/api-client'
import { formatWhen } from '../lib/format'
import type { ExamSummary } from '../types/domain'

type AdminPaperRow = ExamSummary & {
  examinerName: string
  examinerEmail: string
  questionCount: number
  enrolledCount: number
  submittedCount: number
}

type PagedPapers = {
  items: AdminPaperRow[]
  filters: {
    papers: { id: string; title: string }[]
    examiners: { id: string; name: string }[]
  }
  page: number
  limit: number
  total: number
  totalPages: number
}

export function AdminStudentLogPage() {
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [examinerId, setExaminerId] = useState('')

  const papers = useQuery({
    queryKey: ['admin-papers', page, search, examinerId],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '8' })
      if (search.trim()) params.set('search', search.trim())
      if (examinerId) params.set('examinerId', examinerId)
      return apiRequest<PagedPapers>(`/admin/papers?${params.toString()}`)
    },
  })

  return (
    <section className="stack">
      <div>
        <h1 className="page-title">Student log</h1>
        <p className="lede">
          Browse question papers by search or examiner, then open any paper to inspect its questions, examiner, student attempts, marks, and teacher comments.
        </p>
      </div>

      <form
        className="panel stack"
        onSubmit={(event) => {
          event.preventDefault()
          setPage(1)
          setSearch(searchInput)
        }}
      >
        <div className="row">
          <div style={{ flex: 2, minWidth: '220px' }}>
            <TextInput
              aria-label="Search question papers or examiners"
              placeholder="Search question papers or examiners…"
              value={searchInput}
              onChange={(event) => {
                const value = event.target.value
                setSearchInput(value)
                if (value === '') {
                  setPage(1)
                  setSearch('')
                }
              }}
            />
          </div>
          <div style={{ flex: 1, minWidth: '180px' }}>
            <Select
              aria-label="Filter by examiner"
              value={examinerId}
              onChange={(event) => {
                setPage(1)
                setExaminerId(event.target.value)
              }}
            >
              <option value="">All examiners</option>
              {papers.data?.filters.examiners.map((examiner) => (
                <option key={examiner.id} value={examiner.id}>
                  {examiner.name}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" variant="ghost">
            Search
          </Button>
        </div>
      </form>

      {papers.isPending && <p className="meta">Loading question papers…</p>}
      {papers.error && <Banner tone="error">{papers.error.message}</Banner>}

      {papers.data && papers.data.items.length === 0 && (
        <Banner>No question papers matched your search or filters.</Banner>
      )}

      <ul className="list">
        {papers.data?.items.map((paper) => (
          <li className="card" key={paper.id}>
            <Link
              to="/admin/logs/$examId"
              params={{ examId: paper.id }}
              style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
            >
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div>
                  <h2 style={{ marginBottom: '0.2rem' }}>{paper.title}</h2>
                  <div className="meta">
                    Examiner: <strong>{paper.examinerName}</strong> · {paper.questionCount} questions · {paper.totalMarks} marks
                  </div>
                </div>
                <div className="row">
                  <span className="pill">{paper.lifecycle}</span>
                  <span className="pill">{paper.resultsPublished ? 'results published' : 'unpublished'}</span>
                </div>
              </div>
              <div className="row" style={{ justifyContent: 'space-between', marginTop: '0.7rem' }}>
                <span className="meta">
                  {paper.submittedCount} attempted / {paper.enrolledCount} enrolled · closes {formatWhen(paper.windowEnd)}
                </span>
                <span className="btn">View paper &amp; students</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {papers.data && (
        <Pagination
          page={papers.data.page}
          totalPages={papers.data.totalPages}
          total={papers.data.total}
          label="question papers"
          onPageChange={setPage}
        />
      )}
    </section>
  )
}
