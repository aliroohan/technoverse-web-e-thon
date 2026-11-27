export type PaperItem = {
  questionId: string
  category: string
  weight: number
  pinned: boolean
  order: number
}

export type FairSettings = {
  fairPaper: boolean
  questionCount: number | null
  difficultyBudget: number | null
  tolerance: number
  randomizeQuestions: boolean
}

const shuffle = <T>(items: T[], rng: () => number) => {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    const current = copy[i]
    copy[i] = copy[j] as T
    copy[j] = current as T
  }
  return copy
}

const weightOf = (items: PaperItem[]) => items.reduce((sum, item) => sum + item.weight, 0)

const drawSample = (pool: PaperItem[], need: number, budget: number, rng: () => number) => {
  const remaining = [...pool]
  const picked: PaperItem[] = []
  const categories = [...new Set(pool.map((item) => item.category))]

  while (picked.length < need && remaining.length > 0) {
    const category = categories[picked.length % categories.length]
    const inCategory = remaining.filter((item) => item.category === category)
    const bucket = inCategory.length > 0 ? inCategory : remaining
    const current = weightOf(picked)
    const ranked = [...bucket].sort((a, b) => {
      const gapA = Math.abs(current + a.weight - budget)
      const gapB = Math.abs(current + b.weight - budget)
      if (gapA !== gapB) return gapA - gapB
      return rng() - 0.5
    })
    const choice = ranked[0]
    if (!choice) break
    picked.push(choice)
    const index = remaining.findIndex((item) => item.questionId === choice.questionId)
    if (index >= 0) remaining.splice(index, 1)
  }

  return picked
}

export const selectPaper = (
  items: PaperItem[],
  settings: FairSettings,
  rng: () => number = Math.random,
): PaperItem[] => {
  const pinned = [...items.filter((item) => item.pinned)].sort((a, b) => a.order - b.order)
  const pool = items.filter((item) => !item.pinned)

  let selectedPool = pool
  if (settings.fairPaper) {
    const targetCount = settings.questionCount ?? pinned.length + pool.length
    const need = Math.max(0, Math.min(pool.length, targetCount - pinned.length))
    const budget = settings.difficultyBudget ?? need * 2
    let best = drawSample(pool, need, budget, rng)
    let bestDistance = Math.abs(weightOf(best) - budget)

    for (let attempt = 0; attempt < 39; attempt += 1) {
      const sample = drawSample(shuffle(pool, rng), need, budget, rng)
      const distance = Math.abs(weightOf(sample) - budget)
      const sampleCategories = new Set(sample.map((item) => item.category)).size
      const bestCategories = new Set(best.map((item) => item.category)).size
      if (distance < bestDistance || (distance === bestDistance && sampleCategories > bestCategories)) {
        best = sample
        bestDistance = distance
      }
    }
    selectedPool = best
  }

  const paper = [...pinned, ...selectedPool]
  const ordered = settings.randomizeQuestions ? shuffle(paper, rng) : paper
  return ordered.map((item, index) => ({ ...item, order: index }))
}

export const paperWeight = weightOf
