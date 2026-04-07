import { source } from "@/lib/source";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { DocsLayoutProps } from "fumadocs-ui/layouts/docs";
import { baseOptions } from "@/lib/layout.shared";

const docsOptions: DocsLayoutProps = {
	...baseOptions(),
	tree: source.getPageTree(),
	sidebar: {
		tabs: false,
	},
};

export default function Layout({ children }: LayoutProps<"/docs">) {
	return <DocsLayout {...docsOptions}>{children}</DocsLayout>;
}
