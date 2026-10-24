import { useState } from 'react';
import { createPortal } from 'react-dom';
import ActionMenu from './ActionMenu';
import type { MenuItem } from './ActionMenu';
import DeleteProjectDialog from './DeleteProjectDialog';
import RenameDialog from './RenameDialog';
import { moveProject, setProjectPinned } from '../lib/client';
import { errMsg } from '../lib/hooks';

export interface OrderEntry {
  id: string;
  pinned: boolean;
}

interface ProjectActionMenuProps {
  project: { id: string; name: string; url: string; pinned?: boolean };
  /** A guest project (kept on this device): fewer actions. */
  draft?: boolean;
  /** The projects in the order they are shown, used by Move up / Move down. */
  order?: OrderEntry[];
  onDeleted?: () => void;
  className?: string;
}

export default function ProjectActionMenu({
  project,
  draft = false,
  order = [],
  onDeleted,
  className = '',
}: ProjectActionMenuProps) {
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const pinned = Boolean(project.pinned);
  const index = order.findIndex((o) => o.id === project.id);
  const canMove = (step: number): boolean => {
    const here = order[index];
    const other = order[index + step];
    return index >= 0 && here !== undefined && other !== undefined && here.pinned === other.pinned;
  };

  const run = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (err) {
      window.alert(errMsg(err));
    }
  };

  const items: MenuItem[] = [
    { key: 'rename', label: 'Rename', onSelect: () => setRenaming(true) },
    ...(draft
      ? []
      : [
          {
            key: 'pin',
            label: pinned ? 'Unpin' : 'Pin to top',
            onSelect: () => void run(() => setProjectPinned(project.id, !pinned)),
          },
          {
            key: 'up',
            label: 'Move up',
            disabled: !canMove(-1),
            onSelect: () => void run(() => moveProject(order, project.id, 'up')),
          },
          {
            key: 'down',
            label: 'Move down',
            disabled: !canMove(1),
            onSelect: () => void run(() => moveProject(order, project.id, 'down')),
          },
        ]),
    {
      key: 'copy',
      label: 'Copy site URL',
      separatorBefore: true,
      onSelect: () => void navigator.clipboard.writeText(project.url).catch(() => undefined),
    },
    {
      key: 'open',
      label: 'Open site in new tab',
      onSelect: () => void window.open(project.url, '_blank', 'noopener,noreferrer'),
    },
    { key: 'delete', label: 'Delete', danger: true, separatorBefore: true, onSelect: () => setDeleting(true) },
  ];

  return (
    <>
      <ActionMenu items={items} label={`Actions for ${project.name}`} className={className} />
      {renaming
        ? createPortal(
            <RenameDialog id={project.id} name={project.name} draft={draft} onClose={() => setRenaming(false)} />,
            document.body,
          )
        : null}
      {deleting
        ? createPortal(
            <DeleteProjectDialog
              target={{ id: project.id, name: project.name, draft }}
              onClose={() => setDeleting(false)}
              onDeleted={() => {
                setDeleting(false);
                onDeleted?.();
              }}
            />,
            document.body,
          )
        : null}
    </>
  );
}