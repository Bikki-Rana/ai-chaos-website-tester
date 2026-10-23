import { useState } from 'react';
import Button from './Button';
import Modal from './Modal';
import { removeProject } from '../lib/client';
import { removeDraft } from '../lib/drafts';
import { errMsg } from '../lib/hooks';

export interface DeleteTarget {
  id: string;
  name: string;
  /** A guest project kept on this device only. */
  draft: boolean;
}

interface DeleteProjectDialogProps {
  target: DeleteTarget;
  onClose: () => void;
  onDeleted: () => void;
}

export default function DeleteProjectDialog({ target, onClose, onDeleted }: DeleteProjectDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      if (target.draft) removeDraft(target.id);
      else await removeProject(target.id);
      onDeleted();
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  }

  return (
    <Modal title="Delete project?" onClose={onClose} busy={busy}>
      <div className="ct-modal-body">
        <p className="ct-wrap" style={{ margin: 0 }}>
          <strong>{target.name}</strong>{' '}
          {target.draft
            ? 'will be removed from this device.'
            : 'will be deleted together with all of its runs, pages, DOM states, actions and failures.'}{' '}
          This cannot be undone.
        </p>
        {error ? (
          <div className="ct-field-error" role="alert" style={{ marginTop: 12 }}>
            {error}
          </div>
        ) : null}
      </div>
      <div className="ct-modal-foot">
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button className="ct-btn-danger" onClick={confirm} loading={busy}>
          Delete project
        </Button>
      </div>
    </Modal>
  );
}