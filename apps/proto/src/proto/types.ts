import type { ComponentType } from 'react'

export interface ProtoComment {
  id: string
  sceneId: string
  x: number
  y: number
  text: string
  status?: 'open' | 'archived'
  archivedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface CompareRange {
  id: string
  start: string
  end: string
}

export interface ProtoFilterState {
  rangeStart: string
  rangeEnd: string
  compareRanges: CompareRange[]
  managers: string[]
  sources: string[]
}

export interface ProtoKpi {
  label: string
  value: string
  note: string
  compare?: string
  delta?: string
  deltaTone?: 'positive' | 'negative' | 'neutral'
}

export interface PickerOption {
  id: string
  label: string
  meta: string
}

export interface SceneComponentProps {
  commentMode: boolean
  filters: ProtoFilterState
}

export interface ProtoScene {
  id: string
  label: string
  description: string
  focus: string
  kpis: ProtoKpi[]
  component: ComponentType<SceneComponentProps>
}

export interface CommentStore {
  comments: ProtoComment[]
  updatedAt: string | null
}
