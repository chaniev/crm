export type SemanticTone =
  | 'danger'
  | 'warning'
  | 'success'
  | 'info'
  | 'neutral'

export type SemanticToneDefinition = {
  tone: SemanticTone
  label: string
  foreground: `var(--crm-status-${string}-fg)`
  background: `var(--crm-status-${string}-bg)`
  border: `var(--crm-status-${string}-border)`
  iconCue: string
  mantineColor: `var(--crm-status-${string}-fg)`
}

export const semanticToneDefinitions: Record<SemanticTone, SemanticToneDefinition> = {
  danger: {
    tone: 'danger',
    label: 'Критично',
    foreground: 'var(--crm-status-danger-fg)',
    background: 'var(--crm-status-danger-bg)',
    border: 'var(--crm-status-danger-border)',
    iconCue: 'alert',
    mantineColor: 'var(--crm-status-danger-fg)',
  },
  warning: {
    tone: 'warning',
    label: 'Требует внимания',
    foreground: 'var(--crm-status-warning-fg)',
    background: 'var(--crm-status-warning-bg)',
    border: 'var(--crm-status-warning-border)',
    iconCue: 'warning',
    mantineColor: 'var(--crm-status-warning-fg)',
  },
  success: {
    tone: 'success',
    label: 'Успешно',
    foreground: 'var(--crm-status-success-fg)',
    background: 'var(--crm-status-success-bg)',
    border: 'var(--crm-status-success-border)',
    iconCue: 'check',
    mantineColor: 'var(--crm-status-success-fg)',
  },
  info: {
    tone: 'info',
    label: 'Информация',
    foreground: 'var(--crm-status-info-fg)',
    background: 'var(--crm-status-info-bg)',
    border: 'var(--crm-status-info-border)',
    iconCue: 'info',
    mantineColor: 'var(--crm-status-info-fg)',
  },
  neutral: {
    tone: 'neutral',
    label: 'Нейтрально',
    foreground: 'var(--crm-status-neutral-fg)',
    background: 'var(--crm-status-neutral-bg)',
    border: 'var(--crm-status-neutral-border)',
    iconCue: 'neutral',
    mantineColor: 'var(--crm-status-neutral-fg)',
  },
}

export function getSemanticToneDefinition(tone: SemanticTone) {
  return semanticToneDefinitions[tone]
}

export function getSemanticToneAttributes(tone: SemanticTone) {
  const definition = getSemanticToneDefinition(tone)

  return {
    'data-semantic-tone': definition.tone,
    'data-semantic-tone-cue': definition.iconCue,
  } as const
}

export function getSemanticToneComponentProps(tone: SemanticTone) {
  const definition = getSemanticToneDefinition(tone)

  return {
    color: definition.mantineColor,
    ...getSemanticToneAttributes(tone),
  } as const
}

