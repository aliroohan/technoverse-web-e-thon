import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Award, ChevronRight, Clock, FileText, Search, User, Users } from 'lucide-react'
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
      </div>

      <form
        className="panel"
        onSubmit={(event) => {
          event.preventDefault()
          setPage(1)
          setSearch(searchInput)
        }}
      >
        <div className="row">
          <div style={{ flex: 2, minWidth: '220px', position: 'relative' }}>
            <Search
              size={15}
              aria-hidden="true"
              style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-soft)', pointerEvents: 'none' }}
            />
            <TextInput
              className="compact-input"
              style={{ paddingLeft: '2.15rem' }}
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
              className="compact-input"
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
          <Button type="submit" variant="ghost" className="btn-icon" aria-label="Search" title="Search">
            <Search size={16} />
          </Button>
        </div>
      </form>

      {papers.isPending && <p className="meta">Loading…</p>}
      {papers.error && <Banner tone="error">{papers.error.message}</Banner>}

      {papers.data && papers.data.items.length === 0 && <Banner>No matching question papers.</Banner>}

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
                  <h2 style={{ marginBottom: '0.35rem' }}>{paper.title}</h2>
                  <div className="meta-row">
                    <span className="meta-chip">
                      <User size={14} /> <strong>{paper.examinerName}</strong>
                    </span>
                    <span className="meta-chip">
                      <FileText size={14} /> {paper.questionCount}
                    </span>
                    <span className="meta-chip">
                      <Award size={14} /> {paper.totalMarks} pts
                    </span>
                    <span className="meta-chip">
                      <Users size={14} /> {paper.submittedCount}/{paper.enrolledCount}
                    </span>
                    <span className="meta-chip">
                      <Clock size={14} /> {formatWhen(paper.windowEnd)}
                    </span>
                  </div>
                </div>
                <div className="row">
                  <span className="pill">{paper.lifecycle}</span>
                  <span className={paper.resultsPublished ? 'pill ok' : 'pill'}>
                    {paper.resultsPublished ? 'published' : 'unpublished'}
                  </span>
                  <ChevronRight size={18} style={{ color: 'var(--ink-soft)' }} aria-hidden="true" />
                </div>
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
          label="papers"
          onPageChange={setPage}
        />
      )}
    </section>
  )
}
