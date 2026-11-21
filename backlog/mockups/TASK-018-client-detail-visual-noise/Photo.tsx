import { useRef, useState } from 'react'
import { Alert, FileButton, Group, Modal } from '@mantine/core'
import { IconAlertCircle, IconCamera, IconZoomIn } from '@tabler/icons-react'
import { Button } from '../../../frontend/src/features/shared/Button'
import { clientPhotoAcceptValue, validateClientPhotoFile } from '../../../frontend/src/features/clients/ClientManagement.formatting'
import { demoPhoto } from './fixtures'

export type PhotoValue = { src: string | null; broken: boolean }
export function Photo({ value, onChange, name, manage, failNextUpload }: {
  value: PhotoValue; onChange: (value: PhotoValue) => void; name: string; manage: boolean
  failNextUpload: { current: boolean }
}) {
  const [opened, setOpened] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const opener = useRef<HTMLButtonElement>(null)
  const resetFile = useRef<() => void>(null)
  const exists = Boolean(value.src) || value.broken
  async function upload(file: File | null) {
    if (!file) return
    resetFile.current?.()
    setMessage('')
    const validation = validateClientPhotoFile(file)
    setError(validation || '')
    if (validation) return
    setBusy(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 350))
      if (failNextUpload.current) {
        failNextUpload.current = false
        throw new Error('Не удалось отправить файл. Выберите фотографию ещё раз.')
      }
      const src = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(new Error('Не удалось прочитать файл. Выберите его ещё раз.'))
        reader.readAsDataURL(file)
      })
      onChange({ src, broken: false })
      setMessage('Фотография обновлена.')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  if (!manage && !exists) return null
  return <section className="photo" aria-label="Фото клиента">
    <Group gap="sm">
      {value.src && !value.broken && <button ref={opener} className="thumbnail" aria-label="Открыть фотографию" onClick={() => setOpened(true)} type="button">
        <img alt="" src={value.src} onError={() => onChange({ ...value, broken: true })}/><IconZoomIn size={14}/>
      </button>}
      {manage && <FileButton accept={clientPhotoAcceptValue} onChange={upload} resetRef={resetFile}>
        {props => <Button {...props} type="button" variant="secondary" loading={busy} leftSection={<IconCamera size={16}/>}>
          {exists ? 'Заменить фото' : 'Добавить фото'}
        </Button>}
      </FileButton>}
      {manage && <small>JPEG, PNG, WebP, HEIC, HEIF · до 10 МБ</small>}
    </Group>
    {value.broken && <Alert color="yellow" icon={<IconAlertCircle size={18}/>} title="Не удалось показать сохранённое фото">
      <Button type="button" variant="secondary" onClick={() => onChange({ src: value.src || demoPhoto(), broken: false })}>Повторить просмотр</Button>
    </Alert>}
    {error && <Alert color="red" title="Фотография не обновлена" icon={<IconAlertCircle size={18}/>}>{error}</Alert>}
    {message && <small role="status">{message}</small>}
    <Modal returnFocus={false} onExitTransitionEnd={() => opener.current?.focus()} opened={opened} onClose={() => setOpened(false)} title={'Фото · ' + name} centered closeButtonProps={{ 'aria-label': 'Закрыть фотографию' }}>
      {value.src && <img className="full-photo" src={value.src} alt={'Фотография клиента ' + name}/>}
    </Modal>
  </section>
}
