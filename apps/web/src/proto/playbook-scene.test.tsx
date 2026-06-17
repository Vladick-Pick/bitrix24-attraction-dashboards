import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { PlaybookScene } from '@/proto/playbook-scene'
import { scenes } from '@/proto/scenes'

describe('PlaybookScene', () => {
  it('renders the playbook HTML inside a sandboxed iframe', () => {
    const { getByTestId, getByTitle } = render(<PlaybookScene />)

    const iframe = getByTitle('Плейбук Комьюнити-Интегратора') as HTMLIFrameElement
    expect(getByTestId('playbook-scene')).toContainElement(iframe)
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts')

    const srcDoc = iframe.getAttribute('srcdoc') ?? ''
    expect(srcDoc).toContain('Плейбук Комьюнити-Интегратора')
    expect(srcDoc).toContain('Поля по этапам')
  })

  it('is registered as a dashboard scene tab', () => {
    const playbook = scenes.find((scene) => scene.id === 'playbook')
    expect(playbook).toBeDefined()
    expect(playbook?.label).toBe('Плейбук КИ')
    expect(playbook?.component).toBe(PlaybookScene)
  })
})
