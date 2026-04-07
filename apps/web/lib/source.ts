import { docs } from "collections/server";
import { loader } from "fumadocs-core/source";
import { createElement } from "react";
import {
	BookOpenIcon,
	DownloadIcon,
	PackageIcon,
	ShieldIcon,
	ServerIcon,
	ScanSearchIcon,
} from "lucide-react";

const icons = {
	BookOpenIcon,
	DownloadIcon,
	PackageIcon,
	ShieldIcon,
	ServerIcon,
	ScanSearchIcon,
};

export const source = loader({
	baseUrl: "/docs",
	source: docs.toFumadocsSource(),
	icon(icon) {
		if (!icon) return;
		if (icon in icons)
			return createElement(icons[icon as keyof typeof icons]);
	},
});
