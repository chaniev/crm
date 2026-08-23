
import { useEffect, useId, useState, type ChangeEvent } from 'react'
import { Alert, Badge, Button, Group, Loader, Modal, Paper, Stack, Text, ThemeIcon } from '@mantine/core'
import { IconAlertCircle, IconCamera, IconPhotoOff, IconUpload } from '@tabler/icons-react'
import {
  buildClientPhotoUrl,
  type ClientPhoto,
} from '../../lib/api'
import { showAppNotification } from '../shared/notifications'
import {
  clientPhotoAcceptValue,
  formatDateTimeValue,
  formatFileSize,
  validateClientPhotoFile,
} from './ClientManagement.formatting'

type ClientPhotoSectionProps = {
  canUpload: boolean
  clientId?: string
  clientName: string
  onUpload?: (file: File) => Promise<void>
  photo: ClientPhoto | null
  previewVersion?: string | number | null
  variant?: 'default' | 'compact'
}

export function ClientPhotoSection({
  canUpload,
  clientId,
  clientName,
  onUpload,
  photo,
  previewVersion,
  variant = 'default',
}: ClientPhotoSectionProps) {
  const inputId = useId()
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [previewOpened, setPreviewOpened] = useState(false)
  const [previewStatus, setPreviewStatus] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >(() => (clientId && photo ? 'loading' : 'idle'))
  const previewUrl = clientId && photo
    ? buildClientPhotoUrl(
        clientId,
        previewVersion ?? photo?.uploadedAt ?? photo?.path ?? 'current',
      )
    : null

  useEffect(() => {
    setPreviewStatus(previewUrl ? 'loading' : 'idle')
  }, [previewUrl])

  async function handleFileChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.currentTarget.files?.[0] ?? null
    event.currentTarget.value = ''

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
        title: 'Фотография обновлена',
        message: 'Карточка клиента получила новую фотографию.',
        color: 'teal',
      })
    } catch (error) {
      setUploadError(
        error instanceof Error
          ? error.message
          : 'Не удалось загрузить фотографию клиента.',
      )
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <Modal
        centered
        onClose={() => setPreviewOpened(false)}
        opened={previewOpened && Boolean(previewUrl)}
        radius="8px"
        size="xl"
        title={`Фотография клиента ${clientName}`}
      >
        {previewUrl ? (
          <img
            alt={`Фотография клиента ${clientName}`}
            className="client-photo-modal-image"
            src={previewUrl}
          />
        ) : null}
      </Modal>

      <Paper
        className={`hint-card client-photo-card${variant === 'compact' ? ' client-photo-card--compact' : ''}`}
        radius="8px"
        withBorder
      >
      <Stack gap="md">
        <Group justify="space-between" wrap="wrap">
          <Group gap="sm" wrap="nowrap">
            <ThemeIcon color="var(--crm-action-primary)" radius="xl" size={38} variant="light">
              <IconCamera size={20} />
            </ThemeIcon>
            <div>
              <Text fw={700}>{variant === 'compact' ? 'Фото' : 'Фотография клиента'}</Text>
              <Text c="dimmed" size="sm">
                {canUpload
                  ? 'Можно заменить фото клиента.'
                  : clientId
                    ? 'Фото доступно для просмотра.'
                    : 'Фото можно добавить сразу после первичного сохранения карточки клиента.'}
              </Text>
            </div>
          </Group>

          {variant === 'default' ? (
            <Badge color="var(--crm-brand-primary-soft)" radius="sm" variant="light">
              {canUpload ? 'Загрузка' : 'Просмотр'}
            </Badge>
          ) : null}
        </Group>

        <div className="client-photo-preview">
          {previewUrl ? (
            <>
              {previewStatus === 'loading' ? (
                <Group className="client-photo-placeholder" justify="center">
                  <Loader color="var(--crm-action-primary)" size="sm" />
                </Group>
              ) : null}

              {previewStatus !== 'error' ? (
                <button
                  aria-label={`Открыть фотографию клиента ${clientName}`}
                  className="client-photo-preview__button"
                  disabled={previewStatus !== 'ready'}
                  onClick={() => setPreviewOpened(true)}
                  type="button"
                >
                  <img
                    alt={`Фотография клиента ${clientName}`}
                    className="client-photo-preview__image"
                    onError={() => setPreviewStatus('error')}
                    onLoad={() => setPreviewStatus('ready')}
                    src={previewUrl}
                    style={{
                      display: previewStatus === 'ready' ? 'block' : 'none',
                    }}
                  />
                </button>
              ) : null}
            </>
          ) : null}

          {!previewUrl || previewStatus === 'error' ? (
            <Stack
              align="center"
              className="client-photo-placeholder"
              gap="xs"
              justify="center"
            >
              <ThemeIcon color="gray" radius="xl" size={42} variant="light">
                <IconPhotoOff size={20} />
              </ThemeIcon>
              <Text fw={600}>Фото пока не показано</Text>
              <Text c="dimmed" size="sm" ta="center">
                {clientId
                  ? 'Фотография еще не загружена или недоступна для просмотра.'
                  : 'Сначала сохраните клиента, затем вернитесь в карточку или редактирование, чтобы загрузить фотографию.'}
              </Text>
            </Stack>
          ) : null}
        </div>

        {photo ? (
          <Group className="client-photo-meta" gap="xs" wrap="wrap">
            {photo.contentType ? (
              <Badge color="sand" radius="sm" variant="light">
                {photo.contentType}
              </Badge>
            ) : null}
            {typeof photo.sizeBytes === 'number' ? (
              <Badge color="sand" radius="sm" variant="light">
                {formatFileSize(photo.sizeBytes)}
              </Badge>
            ) : null}
            {photo.uploadedAt ? (
              <Badge color="sand" radius="sm" variant="light">
                Загружено: {formatDateTimeValue(photo.uploadedAt)}
              </Badge>
            ) : null}
          </Group>
        ) : null}

        {uploadError ? (
          <Alert
            color="red"
            icon={<IconAlertCircle size={18} />}
            title="Фото не загружено"
            variant="light"
          >
            {uploadError}
          </Alert>
        ) : null}

        {canUpload ? (
          <Group gap="sm" wrap="wrap">
            <label htmlFor={inputId}>
              <Button
                component="span"
                leftSection={<IconUpload size={18} />}
                loading={uploading}
                variant="light"
              >
                {photo ? 'Заменить фото' : 'Загрузить фото'}
              </Button>
            </label>
            <input
              accept={clientPhotoAcceptValue}
              disabled={uploading}
              id={inputId}
              onChange={(event) => void handleFileChange(event)}
              style={{ display: 'none' }}
              type="file"
            />
            <Text c="dimmed" size="sm">
              JPEG, PNG, WebP, HEIC, HEIF до 10 MB.
            </Text>
          </Group>
        ) : null}
      </Stack>
    </Paper>
    </>
  )
}
