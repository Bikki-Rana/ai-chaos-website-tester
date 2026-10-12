import { useState } from 'react';
import type { FormEvent } from 'react';
import Button from './Button';
import Modal from './Modal';
import type { ProjectInput } from '../lib/client';
import { errMsg } from '../lib/hooks';

function normalizeUrl(raw: string): string {
  const v = raw.trim();
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`;
}

function validate(name: string, url: string): { name?: string; url?: string } {
  const errors: { name?: string; url?: string } = {};
  if (!name.trim()) errors.name = 'Project name is required.';
  if (!url.trim()) {
    errors.url = 'Target URL is required.';
  } else {
    try {
      const u = new URL(normalizeUrl(url));
      if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('protocol');
    } catch {
      errors.url = 'Enter a valid http(s) URL.';
    }
  }
  return errors;
}

interface NewProjectModalProps {
  onClose: () => void;
  /** Saves the project and navigates away. Throw to show an error in the form. */
  onSubmit: (input: ProjectInput) => Promise<void>;
}

export default function NewProjectModal({ onClose, onSubmit }: NewProjectModalProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [objective, setObjective] = useState('');
  const [errors, setErrors] = useState<{ name?: string; url?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next = validate(name, url);
    setErrors(next);
    if (next.name || next.url) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit({
        name: name.trim(),
        url: normalizeUrl(url),
        description: description.trim() || undefined,
        testing_objective: objective.trim() || undefined,
      });
    } catch (err) {
      setSubmitError(errMsg(err));
      setSubmitting(false);
    }
  }

  return (
    <Modal title="New project" onClose={onClose} busy={submitting}>
      <form onSubmit={submit} noValidate>
        <div className="ct-modal-body">
          <div className="ct-field">
            <label className="ct-label" htmlFor="np-name">
              Project name
            </label>
            <input
              id="np-name"
              className="ct-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Storefront"
              aria-invalid={errors.name ? true : undefined}
              disabled={submitting}
              autoComplete="off"
            />
            {errors.name ? <div className="ct-field-error">{errors.name}</div> : null}
          </div>
          <div className="ct-field">
            <label className="ct-label" htmlFor="np-url">
              Target URL
            </label>
            <input
              id="np-url"
              className="ct-input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              inputMode="url"
              aria-invalid={errors.url ? true : undefined}
              disabled={submitting}
              autoComplete="off"
            />
            {errors.url ? <div className="ct-field-error">{errors.url}</div> : null}
          </div>
          <div className="ct-field">
            <label className="ct-label" htmlFor="np-desc">
              Description <span className="ct-faint">(optional)</span>
            </label>
            <textarea
              id="np-desc"
              className="ct-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="ct-field">
            <label className="ct-label" htmlFor="np-obj">
              Testing objective <span className="ct-faint">(optional)</span>
            </label>
            <textarea
              id="np-obj"
              className="ct-input"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              disabled={submitting}
            />
          </div>
          {submitError ? (
            <div className="ct-field-error" role="alert" style={{ marginBottom: 12 }}>
              {submitError}
            </div>
          ) : null}
        </div>
        <div className="ct-modal-foot">
          <Button onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={submitting}>
            Create project
          </Button>
        </div>
      </form>
    </Modal>
  );
}