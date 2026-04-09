import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

class ResizeObserverMock implements ResizeObserver {
  observe() {}

  unobserve() {}

  disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverMock)

for (const [property, value] of [
  ['clientWidth', 960],
  ['clientHeight', 320],
  ['offsetWidth', 960],
  ['offsetHeight', 320],
] as const) {
  Object.defineProperty(HTMLElement.prototype, property, {
    configurable: true,
    get: () => value,
  })
}
