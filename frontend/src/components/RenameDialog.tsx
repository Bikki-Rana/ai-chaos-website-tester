import { useState } from 'react';
import type { FormEvent } from 'react';
import Button from './Button';
import Modal from './Modal';
import { renameProject } from '../lib/client';
import { renameDraft } from '../lib/drafts';
import { errMsg } from '../lib/hooks';

interface RenameDialogProps {
  id: string;
  name: string;
  draft: boolean;
  onClose: () => void;
}

export default function RenameDialog({ id, name, draft, onClose }: RenameDialogProps) {
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next = value.trim();
    if (!next) {
      setError('Project name is required.');
      return;
    }
    if (next.length > 255) {
      setError('Use 255 characters or fewer.');
      return;
    }
    if (next === name) {
      onClose();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (draft) renameDraft(id, next);
      else await renameProject(id, next);
      onClose();
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  }

  return (
    <Modal title="Rename project" onClose={onClose} busy={busy}>
      <form onSubmit={submit} noValidate>
        <div className="ct-modal-body">
          <div className="ct-field">
            <label className="ct-label" htmlFor="rename-input">
              Project name
            </label>
            <input
              id="rename-input"
              className="ct-input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              aria-invalid={error ? true : undefined}
              disabled={busy}
              autoComplete="off"
            />
            {error ? (
              <div className="ct-field-error" role="alert">
                {error}
              </div>
            ) : null}
          </div>
        </div>
        <div className="ct-modal-foot">
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={busy}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}