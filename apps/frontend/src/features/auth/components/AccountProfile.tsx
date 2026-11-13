import { useState } from 'react'

import { Button } from '../../../shared/ui/Button'
import { Dialog } from '../../../shared/ui/Dialog'
import { Input } from '../../../shared/ui/Input'
import { useAccountProfile } from '../hooks/useAccountProfile'
import { avatarInitial, type Profile } from '../model/profile'

function Avatar({
  profile,
  large = false,
}: {
  profile: Profile
  large?: boolean
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-wash font-semibold text-brand ${large ? 'size-16 text-2xl' : 'size-7 text-xs'}`}
    >
      {avatarInitial(profile.displayName)}
    </span>
  )
}
export function AccountProfile({ userId }: { userId: string }) {
  const { profile, loaded, loadError, retry, saveProfile } =
    useAccountProfile(userId)
  const [editing, setEditing] = useState(false)
  return (
    <>
      <button
        type="button"
        aria-label="プロフィールを編集"
        title="プロフィールを編集"
        onClick={() => setEditing(true)}
        className="flex min-h-9 items-center gap-2 rounded-lg p-1 text-left hover:bg-canvas focus-visible:outline-2 focus-visible:outline-brand"
      >
        <Avatar profile={profile} />
        <span className="hidden max-w-32 truncate text-xs sm:inline">
          {profile.displayName}
        </span>
      </button>
      {editing &&
        (loaded ? (
          <ProfileEditor
            initial={profile}
            userId={userId}
            onClose={() => setEditing(false)}
            onSave={saveProfile}
          />
        ) : (
          <Dialog title="プロフィールを編集" onClose={() => setEditing(false)}>
            {loadError ? (
              <>
                <p role="alert" className="mb-4 text-sm text-red-600">
                  {loadError}
                </p>
                <Button onClick={retry}>再試行</Button>
              </>
            ) : (
              <p role="status" className="text-sm text-muted">
                プロフィールを読み込んでいます…
              </p>
            )}
          </Dialog>
        ))}
    </>
  )
}
function ProfileEditor({
  initial,
  userId,
  onClose,
  onSave,
}: {
  initial: Profile
  userId: string
  onClose: () => void
  onSave: (profile: Profile) => Promise<void>
}) {
  const [draft, setDraft] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function save() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await onSave(draft)
      onClose()
    } catch (error) {
      setError(
        `保存できませんでした。入力内容を保持しています。${error instanceof Error ? error.message : 'もう一度お試しください。'}`,
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog
      title="プロフィールを編集"
      busy={busy}
      onClose={() => {
        if (!busy) onClose()
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void save()
        }}
      >
        <div className="mb-6 flex items-center gap-4 rounded-xl bg-canvas p-4">
          <Avatar profile={draft} large />
          <div className="min-w-0">
            <p className="truncate font-semibold">
              {draft.displayName || 'あなたの名前'}
            </p>
            <p className="mt-1 text-xs text-muted">ログインID：{userId}</p>
          </div>
        </div>
        <label className="mb-5 flex flex-col gap-2 text-sm font-medium">
          表示名
          <Input
            required
            maxLength={40}
            value={draft.displayName}
            disabled={busy}
            onChange={(event) =>
              setDraft({ ...draft, displayName: event.target.value })
            }
          />
        </label>
        <p className="mb-4 text-xs text-muted">
          アイコンには表示名の先頭文字を表示します。
        </p>
        <p className="mb-5 text-xs leading-5 text-muted">
          変更はアカウントに保存され、他の端末でも反映されます。ログインIDは変わりません。
        </p>
        {error && (
          <p role="alert" className="mb-4 text-sm text-red-600">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button disabled={busy} onClick={onClose}>
            キャンセル
          </Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? '保存中…' : '変更を保存'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
