
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
import { fe8ClientMessengerMediaText } from '../../resources/fe-8-client-messenger-media'


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
        title: fe8ClientMessengerMediaText.clientPhotoSection_title_2fb80bcc,
        message: fe8ClientMessengerMediaText.clientPhotoSection_message_9eb96d58,
        color: 'teal',
      })
    } catch (error) {
      setUploadError(
        error instanceof Error
          ? error.message
          : fe8ClientMessengerMediaText.clientPhotoSection_string_5d9e3868,
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
        title={fe8ClientMessengerMediaText.clientPhotoSection_template_b53a862a(clientName)}
      >
        {previewUrl ? (
          <img
            alt={fe8ClientMessengerMediaText.clientPhotoSection_template_b53a862a(clientName)}
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
              <Text fw={700}>{variant === 'compact' ? fe8ClientMessengerMediaText.clientPhotoSection_string_45c2f1fa : fe8ClientMessengerMediaText.clientPhotoSection_string_75f5b4ed}</Text>
              <Text c="dimmed" size="sm">
                {canUpload
                  ? fe8ClientMessengerMediaText.clientPhotoSection_string_f71f0281
                  : clientId
                    ? fe8ClientMessengerMediaText.clientPhotoSection_string_232091bb
                    : fe8ClientMessengerMediaText.clientPhotoSection_string_6c6732f0}
              </Text>
            </div>
          </Group>

          {variant === 'default' ? (
            <Badge color="var(--crm-brand-primary-soft)" radius="sm" variant="light">
              {canUpload ? fe8ClientMessengerMediaText.clientPhotoSection_string_111213e7 : fe8ClientMessengerMediaText.clientPhotoSection_string_f1163738}
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
                  aria-label={fe8ClientMessengerMediaText.clientPhotoSection_template_8864f585(clientName)}
                  className="client-photo-preview__button"
                  disabled={previewStatus !== 'ready'}
                  onClick={() => setPreviewOpened(true)}
                  type="button"
                >
                  <img
                    alt={fe8ClientMessengerMediaText.clientPhotoSection_template_b53a862a(clientName)}
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
              <Text fw={600}>{fe8ClientMessengerMediaText.clientPhotoSection_jsxText_7ef83fc5}</Text>
              <Text c="dimmed" size="sm" ta="center">
                {clientId
                  ? fe8ClientMessengerMediaText.clientPhotoSection_string_b96af1f1
                  : fe8ClientMessengerMediaText.clientPhotoSection_string_62530367}
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
                {fe8ClientMessengerMediaText.clientPhotoSection_jsxText_69380add}{formatDateTimeValue(photo.uploadedAt)}
              </Badge>
            ) : null}
          </Group>
        ) : null}

        {uploadError ? (
          <Alert
            color="red"
            icon={<IconAlertCircle size={18} />}
            title={fe8ClientMessengerMediaText.clientPhotoSection_title_0f50b2a8}
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
                {photo ? fe8ClientMessengerMediaText.clientPhotoSection_string_f61eb235 : fe8ClientMessengerMediaText.clientPhotoSection_string_bee0c752}
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
              {fe8ClientMessengerMediaText.clientPhotoSection_jsxText_5f0835c4}</Text>
          </Group>
        ) : null}
      </Stack>
    </Paper>
    </>
  )
}
