// @ts-nocheck
import { browser } from 'fumadocs-mdx/runtime/browser';
import type * as Config from '../source.config';

const create = browser<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>();
const browserCollections = {
  docs: create.doc("docs", {"block-rules.mdx": () => import("../content/docs/block-rules.mdx?collection=docs"), "how-it-works.mdx": () => import("../content/docs/how-it-works.mdx?collection=docs"), "index.mdx": () => import("../content/docs/index.mdx?collection=docs"), "installation.mdx": () => import("../content/docs/installation.mdx?collection=docs"), "package-managers.mdx": () => import("../content/docs/package-managers.mdx?collection=docs"), }),
};
export default browserCollections;