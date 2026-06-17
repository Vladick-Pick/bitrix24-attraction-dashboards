import playbookHtml from '../../../../docs/modules/attraction/playbook/playbook-ki.html?raw'

// Самодостаточный HTML-плейбук (вкладки, фильтры и стили внутри файла) рендерим
// в sandboxed-iframe через srcDoc. Источник правды — docs/modules/attraction/playbook,
// файл подтягивается импортом `?raw` (без копий и рассинхрона). allow-scripts нужен,
// чтобы работали внутренние вкладки и фильтр плейбука.
export function PlaybookScene() {
  return (
    <section className="panel overflow-hidden p-0" data-testid="playbook-scene">
      <iframe
        title="Плейбук Комьюнити-Интегратора"
        srcDoc={playbookHtml}
        sandbox="allow-scripts"
        className="h-[calc(100vh-180px)] min-h-[640px] w-full border-0"
      />
    </section>
  )
}
