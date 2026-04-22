import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

class ResizeObserverMock implements ResizeObserver {
  observe() {}

  unobserve() {}

  disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverMock)

for (const [property, value] of [
  ['clientWidth', 1280],
  ['clientHeight', 780],
  ['offsetWidth', 1280],
  ['offsetHeight', 780],
] as const) {
  Object.defineProperty(HTMLElement.prototype, property, {
    configurable: true,
    get: () => value,
  })
}
