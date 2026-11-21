import type { ComponentProps, ReactNode } from 'react'
import { ClientOverviewSection } from '../../../frontend/src/features/clients/ClientOverviewSection'
import { ClientPhotoSection } from '../../../frontend/src/features/clients/ClientPhotoSection'
import { ClientNotesSection, ClientRelatedSections } from '../../../frontend/src/features/clients/ClientDetailSections'
import { ClientAttendanceHistorySection } from '../../../frontend/src/features/clients/ClientAttendanceHistorySection'
import { ClientMessengerChatSection } from '../../../frontend/src/features/clients/ClientMessengerChatSection'
import { ProfileTabs } from './ProfileTabs'
import { GroupsEditor, InfoEditor } from './ClientEditors'
import { MembershipEditor } from './MembershipEditor'

type Props = ComponentProps<typeof MembershipEditor> & {
  canManage: boolean; backLabel: string; onBack: () => void; actions: ReactNode
  onPhotoUpload: (file: File) => Promise<void>; photoVersion: number | null
}

export function DetailPrototype({ client, canManage, backLabel, onBack, actions, onPhotoUpload, photoVersion, ...membership }: Props) {
  const editorProps = { client, onSaved: membership.onClientChange }
  const groups = canManage ? <GroupsEditor {...editorProps}/> :
    <ClientRelatedSections client={client} canManage={false} onEdit={() => {}}/>
  return <ProfileTabs client={client} canManage={canManage} backLabel={backLabel} onBack={onBack}
    groups={groups} attendance={<ClientAttendanceHistorySection canManage={canManage} client={client}/>}
    memberships={canManage && <MembershipEditor client={client} {...membership}/>}>
    {canManage ? <InfoEditor {...editorProps} actions={actions}
      photo={<ClientPhotoSection canUpload clientId={client.id} clientName={client.fullName} photo={client.photo}
        previewVersion={photoVersion ?? client.updatedAt} onUpload={onPhotoUpload} variant="edit"/>}/> :
      <><ClientOverviewSection client={client} canManage={false} actions={null} photoVersion={photoVersion}/>
        <ClientNotesSection client={client}/></>}
    <ClientMessengerChatSection clientId={client.id}/>
  </ProfileTabs>
}
