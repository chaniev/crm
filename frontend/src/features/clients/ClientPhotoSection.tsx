import { useClientAccessError } from './clientAccessBoundary'

import { useRef, useState } from 'react'
import { Alert, Button, FileButton, Group, Modal, Stack, Text } from '@mantine/core'
import { IconAlertCircle, IconCamera, IconZoomIn } from '@tabler/icons-react'
import {
  ApiError,
  buildClientPhotoUrl,
  type ClientPhoto,
} from '../../lib/api'
import { showAppNotification } from '../shared/notifications'
import {
  clientPhotoAcceptValue,
  validateClientPhotoFile,
} from './ClientManagement.formatting'
import { fe8ClientMessengerMediaText } from '../../resources/fe-8-client-messenger-media'


type ClientPhotoSectionProps = {
  canUpload: boolean
  clientId: string
  clientName: string
  onUpload?: (file: File) => Promise<void>
  photo: ClientPhoto | null
  previewVersion?: string | number | null
  variant?: 'edit' | 'compact'
}

export function ClientPhotoSection({
  canUpload,
  clientId,
  clientName,
  onUpload,
  photo,
  previewVersion,
  variant = 'compact',
}: ClientPhotoSectionProps) {
  const reportClientError = useClientAccessError()
  const resetFile = useRef<() => void>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const previewUrl = photo
    ? buildClientPhotoUrl(clientId, previewVersion ?? photo.uploadedAt ?? photo.path ?? 'current')
    : null

  async function handleFileChange(file: File | null) {
    resetFile.current?.()
    if (!file) {
      return
    }

    const validationError = validateClientPhotoFile(file)

    if (validationError) {
      setUploadError(validationError)
      return
    }

    if (!onUpload) {
      return
    }

    setUploading(true)
    setUploadError(null)

    try {
      await onUpload(file)

      showAppNotification({
        id: 'client-photo-upload-success',
        title: fe8ClientMessengerMediaText.clientPhotoSection_title_2fb80bcc,
        message: fe8ClientMessengerMediaText.clientPhotoSection_message_9eb96d58,
        color: 'teal',
      })
    } catch (error) {
      void reportClientError(error)
      setUploadError(
        error instanceof Error
          ? error.message
          : fe8ClientMessengerMediaText.clientPhotoSection_string_5d9e3868,
      )
    } finally {
      setUploading(false)
    }
  }

  if (!previewUrl && !canUpload) return null

  return (
    <Stack className={`client-photo-section client-photo-section--${variant}`} gap="xs">
      <Group gap="sm">
        {previewUrl && <SavedPhoto key={previewUrl} clientName={clientName} url={previewUrl} />}
        {canUpload && (
          <Stack gap={4}>
            {variant === 'edit' && photo && <Text fw={700}>{fe8ClientMessengerMediaText.clientPhotoSection_string_75f5b4ed}</Text>}
            <FileButton accept={clientPhotoAcceptValue} onChange={handleFileChange} resetRef={resetFile}>
              {props => (
                <Button {...props} type="button" w="fit-content" leftSection={<IconCamera size={16} />} loading={uploading} variant="default">
                  {photo ? fe8ClientMessengerMediaText.clientPhotoSection_string_f61eb235 : fe8ClientMessengerMediaText.clientPhotoSection_string_bee0c752}
                </Button>
              )}
            </FileButton>
            <Text c="dimmed" size="xs">{fe8ClientMessengerMediaText.clientPhotoSection_jsxText_5f0835c4}</Text>
          </Stack>
        )}
      </Group>
      {uploadError && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} title={fe8ClientMessengerMediaText.clientPhotoSection_title_0f50b2a8}>
          {uploadError}
        </Alert>
      )}
    </Stack>
  )
}

function SavedPhoto({ clientName, url }: { clientName: string; url: string }) {
  const reportClientError = useClientAccessError()
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)
  const [opened, setOpened] = useState(false)
  const opener = useRef<HTMLButtonElement>(null)
  const src = attempt ? `${url}&retry=${attempt}` : url
  const title = fe8ClientMessengerMediaText.clientPhotoSection_template_b53a862a(clientName)

  function handleReadError() {
    setStatus('error')
    setOpened(false)
    void reportClientError(new ApiError('', 404))
  }

  if (status === 'error') {
    return (
      <Alert color="yellow" icon={<IconAlertCircle size={18} />} title={fe8ClientMessengerMediaText.photoReadError}>
        <Button type="button" variant="default" onClick={() => {
          setAttempt(value => value + 1)
          setStatus('loading')
        }}>
          {fe8ClientMessengerMediaText.retryPhoto}
        </Button>
      </Alert>
    )
  }

  return (
    <>
      <button ref={opener} type="button" className="client-photo-preview__button"
        aria-label={fe8ClientMessengerMediaText.clientPhotoSection_template_8864f585(clientName)}
        disabled={status !== 'ready'} onClick={() => setOpened(true)}>
        <img src={src} alt={title} onLoad={() => setStatus('ready')} onError={handleReadError} />
        <IconZoomIn size={18} aria-hidden="true" />
      </button>
      <Modal centered opened={opened} onClose={() => setOpened(false)} title={title} size="xl"
        closeButtonProps={{ 'aria-label': fe8ClientMessengerMediaText.closePhoto }}
        returnFocus={false} onExitTransitionEnd={() => opener.current?.focus()}>
        {opened && <img alt={title} className="client-photo-modal-image" src={src} onError={handleReadError} />}
      </Modal>
    </>
  )
}
