export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled'

export interface ShareFile {
  name: string
  type: string
  content: string
}

/** Телефоны и планшеты: там файл удобнее отдать в системное меню «Поделиться». */
function prefersShareSheet(): boolean {
  try {
    return window.matchMedia('(pointer: coarse)').matches
  } catch {
    return false
  }
}

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.rel = 'noopener'
  link.hidden = true
  document.body.append(link)
  link.click()
  link.remove()
  // Safari на iOS читает blob после click асинхронно — не отзываем ссылку сразу.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/**
 * На iPhone скачивание сгенерированного файла из PWA работает ненадёжно,
 * поэтому сначала пробуем share sheet (Календарь, «Сохранить в Файлы», Почта).
 * Вызывать прямо из обработчика клика: share требует жеста пользователя.
 */
export async function shareOrDownload(file: ShareFile): Promise<ShareOutcome> {
  const blob = new Blob([file.content], { type: file.type })

  if (prefersShareSheet() && typeof navigator.share === 'function' && typeof navigator.canShare === 'function') {
    const shareable = new File([blob], file.name, { type: file.type })
    if (navigator.canShare({ files: [shareable] })) {
      try {
        await navigator.share({ files: [shareable], title: file.name })
        return 'shared'
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
        // NotAllowedError и прочее — пробуем обычное скачивание.
      }
    }
  }

  download(blob, file.name)
  return 'downloaded'
}
