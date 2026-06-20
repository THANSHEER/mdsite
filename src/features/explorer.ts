import { urlForSlug } from '../parser/links.js';
import { humanizeSlug } from '../utils.js';
import type { Page } from '../types.js';

/** Tree node representation. */
export interface TreeNode {
  /** Display label (folder name humanized, or the note title). */
  name: string;
  /** Slug path from the content root (no base), e.g. "concepts" or "a/b". */
  slug: string;
  /** Root-relative, base-prefixed URL (the folder index or the note). */
  url: string;
  isFolder: boolean;
  /** The note at this path, if any (a folder can carry its own index page). */
  page?: Page;
  children: TreeNode[];
}

/** Build explorer tree from pages. */
export function buildTree(pages: Page[]): TreeNode[] {
  const root: TreeNode = { name: '', slug: '', url: urlForSlug(''), isFolder: true, children: [] };
  const byPath = new Map<string, TreeNode>([['', root]]);

  for (const page of pages) {
    if (page.slug === '') continue;
    const segs = page.slug.split('/');
    let acc = '';
    let parent = root;
    for (const seg of segs) {
      acc = acc ? `${acc}/${seg}` : seg;
      let node = byPath.get(acc);
      if (!node) {
        node = { name: humanizeSlug(seg), slug: acc, url: urlForSlug(acc), isFolder: false, children: [] };
        byPath.set(acc, node);
        parent.children.push(node);
      }
      parent = node;
    }
    parent.page = page;
    parent.name = page.title; // prefer the real note title for the leaf
  }

  finalize(root);
  return root.children;
}

/** List all folder nodes recursively. */
export function listFolders(nodes: TreeNode[]): TreeNode[] {
  const out: TreeNode[] = [];
  for (const node of nodes) {
    if (node.isFolder) {
      out.push(node);
      out.push(...listFolders(node.children));
    }
  }
  return out;
}

/** Finalize folder nodes status and sort children. */
function finalize(node: TreeNode): void {
  if (node.children.length > 0) node.isFolder = true;
  node.children.sort((a, b) => {
    const af = a.children.length > 0;
    const bf = b.children.length > 0;
    if (af !== bf) return af ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const child of node.children) finalize(child);
}
