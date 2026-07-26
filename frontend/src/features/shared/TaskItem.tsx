import type { ComponentPropsWithoutRef, KeyboardEvent, ReactNode } from 'react'

export type TaskItemInteraction =
  | { kind: 'link'; href: string; current?: boolean }
  | { kind: 'button'; onActivate: () => void; pressed?: boolean }
  | { kind: 'option'; onActivate: () => void; selected: boolean }
  | { kind: 'row'; onActivate: () => void; selected: boolean }

export type TaskItemProps = Omit<ComponentPropsWithoutRef<'div'>, 'children'> & {
  accessibleName: string
  identity: ReactNode
  interaction?: TaskItemInteraction
  leading?: ReactNode
  metadata?: ReactNode
  status?: ReactNode
  trailing?: ReactNode
}

export function TaskItem({
  accessibleName,
  className,
  identity,
  interaction,
  leading,
  metadata,
  status,
  trailing,
  ...props
}: TaskItemProps) {
  const content = (
    <>
      {leading ? <span className="task-item__leading">{leading}</span> : null}
      <span className="task-item__body">
        <span className="task-item__identity">{identity}</span>
        {metadata ? <span className="task-item__metadata">{metadata}</span> : null}
      </span>
      {status ? <span className="task-item__status">{status}</span> : null}
      {trailing ? <span className="task-item__trailing">{trailing}</span> : null}
    </>
  )
  const classes = ['task-item', interaction ? 'task-item--interactive' : null, className]
    .filter(Boolean)
    .join(' ')

  if (!interaction) {
    return (
      <div className={classes} {...props}>
        {content}
      </div>
    )
  }

  if (interaction.kind === 'link') {
    return (
      <a
        aria-current={interaction.current ? 'page' : undefined}
        aria-label={accessibleName}
        className={classes}
        href={interaction.href}
      >
        {content}
      </a>
    )
  }

  if (interaction.kind === 'button') {
    return (
      <button
        aria-label={accessibleName}
        aria-pressed={interaction.pressed === undefined ? undefined : interaction.pressed}
        className={classes}
        onClick={interaction.onActivate}
        type="button"
      >
        {content}
      </button>
    )
  }

  const activate = interaction.onActivate
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return
    }

    event.preventDefault()
    activate()
  }

  return (
    <div
      aria-label={accessibleName}
      aria-selected={interaction.selected}
      className={classes}
      onClick={activate}
      onKeyDown={handleKeyDown}
      role={interaction.kind}
      tabIndex={0}
      {...props}
    >
      {content}
    </div>
  )
}
